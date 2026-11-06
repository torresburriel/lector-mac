"use strict";
const { app, BrowserWindow, Menu, shell, ipcMain, nativeTheme, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { signInInBrowser, storageKey } = require("./auth-bridge");

const HOME = process.env.LECTOR_URL || "https://reader.torresburriel.es";
const HOME_ORIGIN = new URL(HOME).origin;

// Dominios que deben abrirse DENTRO de la app (login con Google vía Lovable/Supabase).
const AUTH_HOSTS = [
  /(^|\.)lovable\.app$/, /(^|\.)lovable\.dev$/, /(^|\.)supabase\.co$/,
  /^accounts\.google\.com$/, /^accounts\.youtube\.com$/, /(^|\.)google\.[a-z.]+$/, /(^|\.)gstatic\.com$/,
];
const isInternal = (u) => {
  try {
    const url = new URL(u);
    if (url.protocol === "file:" || url.protocol === "about:") return true;
    if (url.origin === HOME_ORIGIN) return true;
    return AUTH_HOSTS.some((re) => re.test(url.hostname));
  } catch { return false; }
};

// UA de Chrome “limpio”: Google rechaza el login en navegadores embebidos que se identifican como Electron.
app.userAgentFallback =
  `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`;
app.setName("Lector");

// ---------- estado de la ventana ----------
const statePath = () => path.join(app.getPath("userData"), "window-state.json");
function loadState() {
  try { return JSON.parse(fs.readFileSync(statePath(), "utf8")); } catch { return { width: 1280, height: 820 }; }
}
function saveState(win) {
  try {
    const b = win.getNormalBounds();
    fs.writeFileSync(statePath(), JSON.stringify({ ...b, maximized: win.isMaximized(), lastUrl: lastGoodUrl }));
  } catch {}
}

let win = null;
let lastGoodUrl = null;
let quitting = false;
let inAppLoginOnce = false; // alternativa: login dentro de la ventana (sin passkeys)

function createWindow() {
  const st = loadState();
  win = new BrowserWindow({
    x: st.x, y: st.y, width: st.width || 1280, height: st.height || 820,
    minWidth: 720, minHeight: 480,
    title: "Lector",
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#1f1f1f" : "#ffffff",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });
  if (st.maximized) win.maximize();
  win.once("ready-to-show", () => win.show());

  const wc = win.webContents;

  // Enlaces a artículos y webs externas → navegador por defecto.
  wc.setWindowOpenHandler(({ url }) => {
    if (isInternal(url) && !url.startsWith(HOME_ORIGIN)) return { action: "allow" }; // popups de auth
    if (url.startsWith(HOME_ORIGIN)) { wc.loadURL(url); return { action: "deny" }; }
    if (/^(https?|mailto):/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  wc.on("will-navigate", (e, url) => {
    if (url.startsWith(HOME_ORIGIN + "/~oauth/initiate")) {
      if (inAppLoginOnce) { inAppLoginOnce = false; return; }
      e.preventDefault();
      const provider = new URL(url).searchParams.get("provider") || "google";
      return browserLogin(provider);
    }
    if (!isInternal(url)) { e.preventDefault(); shell.openExternal(url); }
  });

  wc.on("did-navigate", (_e, url) => { if (url.startsWith(HOME_ORIGIN)) lastGoodUrl = url; });
  wc.on("did-navigate-in-page", (_e, url) => { if (url.startsWith(HOME_ORIGIN)) lastGoodUrl = url; });

  // Sin conexión → página local con reintento.
  wc.on("did-fail-load", (_e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3 /* ABORTED */) return;
    win.loadFile(path.join(__dirname, "offline.html"), { query: { url: url || HOME, err: desc } });
  });

  // El título de la ventana sigue a la vista activa del lector.
  wc.on("page-title-updated", (e, title) => { e.preventDefault(); win.setTitle(title.replace(/^Lector — /, "Lector · ")); });

  win.on("close", (e) => {
    saveState(win);
    if (process.platform === "darwin" && !quitting) { e.preventDefault(); win.hide(); }
  });

  const startUrl = st.lastUrl && st.lastUrl.startsWith(HOME_ORIGIN) ? st.lastUrl : HOME;
  win.loadURL(startUrl);
}

// ---------- login en el navegador del sistema ----------
const banner = (text) => `(() => {
  let b = document.getElementById("__lector_banner");
  if (!${JSON.stringify(text)}) { if (b) b.remove(); return; }
  if (!b) { b = document.createElement("div"); b.id = "__lector_banner";
    b.style.cssText = "position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:2147483647;background:#222;color:#fff;padding:10px 16px;border-radius:4px;font:13px Arial,sans-serif;box-shadow:0 2px 12px rgba(0,0,0,.3)";
    document.body.appendChild(b); }
  b.textContent = ${JSON.stringify(text)};
})()`;
const showBanner = (t) => win && win.webContents.executeJavaScript(banner(t)).catch(() => {});

async function browserLogin(provider) {
  showBanner("Completa el inicio de sesión en tu navegador. Lector se actualizará solo.");
  try {
    const session = await signInInBrowser(HOME_ORIGIN, provider);
    if (!win) return;
    if (!win.webContents.getURL().startsWith(HOME_ORIGIN)) await win.loadURL(HOME_ORIGIN + "/auth");
    await win.webContents.executeJavaScript(
      `localStorage.setItem(${JSON.stringify(storageKey())}, ${JSON.stringify(JSON.stringify(session))}); true`);
    await win.loadURL(HOME_ORIGIN + "/reader");
    win.show(); win.focus(); app.focus({ steal: true });
  } catch (err) {
    showBanner("");
    if (!win) return;
    const r = await dialog.showMessageBox(win, {
      type: "warning", buttons: ["Reintentar en el navegador", "Iniciar sesión dentro de la app", "Cancelar"],
      defaultId: 0, cancelId: 2,
      message: "No se ha podido completar el inicio de sesión en el navegador.",
      detail: `${err.message || err}\n\nDentro de la app el login funciona, pero sin passkeys: tendrás que usar contraseña u otro método en Google.`,
    });
    if (r.response === 0) browserLogin(provider);
    if (r.response === 1) inAppLogin();
  }
}
function inAppLogin() { inAppLoginOnce = true; goPath("/auth"); }

// ---------- puente con la web: atajos y contador ----------
function press(key, opts = {}) {
  if (!win) return;
  win.show();
  const js = `(() => {
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: ${JSON.stringify(key)}, shiftKey: ${!!opts.shift}, bubbles: true, cancelable: true }));
  })()`;
  win.webContents.executeJavaScript(js).catch(() => {});
}
function sequence(...keys) { keys.forEach((k, i) => setTimeout(() => press(k), i * 60)); }
function goPath(p) { if (win) { win.show(); win.loadURL(HOME_ORIGIN + p); } }

ipcMain.on("lector:unread", (_e, n) => {
  if (process.platform !== "darwin" || !app.dock) return;
  app.dock.setBadge(n > 0 ? (n > 999 ? "999+" : String(n)) : "");
});
ipcMain.on("lector:retry", (_e, url) => {
  if (win) win.loadURL(url && /^https?:/.test(url) ? url : HOME);
});

// ---------- menú nativo ----------
function buildMenu() {
  const isMac = process.platform === "darwin";
  const tpl = [
    ...(isMac ? [{
      label: "Lector",
      submenu: [
        { role: "about", label: "Acerca de Lector" },
        { type: "separator" },
        { label: "Ajustes…", accelerator: "Cmd+,", click: () => goPath("/settings") },
        { type: "separator" },
        { role: "services", label: "Servicios" },
        { type: "separator" },
        { role: "hide", label: "Ocultar Lector" },
        { role: "hideOthers", label: "Ocultar otros" },
        { role: "unhide", label: "Mostrar todo" },
        { type: "separator" },
        { role: "quit", label: "Salir de Lector" },
      ],
    }] : []),
    {
      label: "Archivo",
      submenu: [
        { label: "Añadir suscripción…", accelerator: "CmdOrCtrl+N", click: () => press("a") },
        { label: "Actualizar feeds", accelerator: "CmdOrCtrl+R", click: () => press("r") },
        { label: "Marcar todo como leído", accelerator: "CmdOrCtrl+Shift+A", click: () => press("A", { shift: true }) },
        { type: "separator" },
        { label: "Buscar", accelerator: "CmdOrCtrl+F", click: () => press("/") },
        { type: "separator" },
        { label: "Abrir en el navegador", accelerator: "CmdOrCtrl+Shift+O", click: () => shell.openExternal(lastGoodUrl || HOME) },
        { label: "Copiar enlace de la vista", accelerator: "CmdOrCtrl+Shift+C", click: () => require("electron").clipboard.writeText(lastGoodUrl || HOME) },
        { type: "separator" },
        isMac ? { role: "close", label: "Cerrar ventana" } : { role: "quit", label: "Salir" },
      ],
    },
    {
      label: "Edición",
      submenu: [
        { role: "undo", label: "Deshacer" }, { role: "redo", label: "Rehacer" },
        { type: "separator" },
        { role: "cut", label: "Cortar" }, { role: "copy", label: "Copiar" }, { role: "paste", label: "Pegar" },
        { role: "selectAll", label: "Seleccionar todo" },
      ],
    },
    {
      label: "Ver",
      submenu: [
        { label: "Todos los elementos", accelerator: "CmdOrCtrl+Shift+1", click: () => sequence("g", "a") },
        { label: "Destacados", accelerator: "CmdOrCtrl+Shift+2", click: () => sequence("g", "s") },
        { type: "separator" },
        { label: "Vista expandida", accelerator: "CmdOrCtrl+1", click: () => press("1") },
        { label: "Vista de lista", accelerator: "CmdOrCtrl+2", click: () => press("2") },
        { type: "separator" },
        { label: "Recargar la página", accelerator: "CmdOrCtrl+Shift+R", click: () => win && win.webContents.reload() },
        { type: "separator" },
        { role: "resetZoom", label: "Tamaño real" },
        { role: "zoomIn", label: "Ampliar" },
        { role: "zoomOut", label: "Reducir" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Pantalla completa" },
        { role: "toggleDevTools", label: "Herramientas de desarrollo" },
      ],
    },
    {
      label: "Ir",
      submenu: [
        { label: "Siguiente elemento", accelerator: "CmdOrCtrl+Down", click: () => press("j") },
        { label: "Elemento anterior", accelerator: "CmdOrCtrl+Up", click: () => press("k") },
        { label: "Abrir / cerrar elemento", accelerator: "CmdOrCtrl+Return", click: () => press("o") },
        { type: "separator" },
        { label: "Destacar elemento", accelerator: "CmdOrCtrl+D", click: () => press("s") },
        { label: "Marcar como leído / no leído", accelerator: "CmdOrCtrl+U", click: () => press("m") },
        { label: "Ver original", accelerator: "CmdOrCtrl+Shift+V", click: () => press("v") },
        { type: "separator" },
        { label: "Atrás", accelerator: "CmdOrCtrl+[", click: () => win && win.webContents.navigationHistory.goBack() },
        { label: "Adelante", accelerator: "CmdOrCtrl+]", click: () => win && win.webContents.navigationHistory.goForward() },
      ],
    },
    { role: "windowMenu", label: "Ventana" },
    {
      role: "help", label: "Ayuda",
      submenu: [
        { label: "Atajos de teclado", accelerator: "CmdOrCtrl+/", click: () => press("?") },
        { label: "Guía", click: () => goPath("/guide") },
        { label: "Novedades", click: () => goPath("/changelog") },
        { type: "separator" },
        { label: "Iniciar sesión con Google en el navegador", click: () => browserLogin("google") },
        { label: "Iniciar sesión dentro de la app (sin passkey)", click: inAppLogin },
        { type: "separator" },
        { label: "Cerrar sesión y borrar datos locales…", click: resetData },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

async function resetData() {
  const r = await dialog.showMessageBox(win, {
    type: "warning", buttons: ["Cancelar", "Borrar"], defaultId: 0, cancelId: 0,
    message: "¿Borrar la sesión y los datos guardados en esta app?",
    detail: "Se cierra la sesión de Google y se elimina el modo de prueba local. Las suscripciones de tu cuenta siguen en el servidor.",
  });
  if (r.response !== 1) return;
  await win.webContents.session.clearStorageData();
  win.loadURL(HOME);
}

// ---------- ciclo de vida ----------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => { if (win) { win.show(); win.focus(); } });
  app.whenReady().then(() => {
    app.setAboutPanelOptions({
      applicationName: "Lector",
      applicationVersion: app.getVersion(),
      copyright: "© Daniel Torres Burriel · GPL-3.0\ngithub.com/torresburriel/lector-mac",
    });
    buildMenu();
    createWindow();
  });
  app.on("activate", () => { if (win) win.show(); else createWindow(); });
  app.on("before-quit", () => { quitting = true; if (win) saveState(win); });
  app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
}
