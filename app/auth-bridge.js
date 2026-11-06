"use strict";
// Login con Google en el navegador del sistema (donde funcionan las passkeys de iCloud / Touch ID)
// y entrega de la sesión a la app por loopback (127.0.0.1), el mismo mecanismo que usa la app de
// escritorio de Lovable con su broker OAuth.
const http = require("http");
const crypto = require("crypto");
const { shell, net } = require("electron");
const cfg = require("./config.json");
const supabaseUrl = process.env.LECTOR_SUPABASE_URL || cfg.supabaseUrl; // variable solo para pruebas
const { supabaseKey } = cfg;

const CALLBACK_PATH = "/iframe-oauth/callback";
const DONE_PATH = "/iframe-oauth/done";
const TIMEOUT_MS = 5 * 60 * 1000;

const page = (title, body, script = "") => `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>${title}</title><style>
body{font:15px/1.5 -apple-system,BlinkMacSystemFont,Arial,sans-serif;display:grid;place-items:center;height:100vh;margin:0;background:#fff;color:#222}
@media(prefers-color-scheme:dark){body{background:#1f1f1f;color:#eee}}
div{max-width:380px;text-align:center}h1{font-size:18px;margin:0 0 8px}p{color:#888;margin:0}</style></head>
<body><div><h1>${title}</h1><p>${body}</p></div>${script ? `<script>${script}</script>` : ""}</body></html>`;

// Recoge los parámetros de la query o del fragmento (#) y los manda al servidor local.
const RELAY = `
const q=new URLSearchParams(location.search), h=new URLSearchParams(location.hash.replace(/^#/,""));
const o={}; for (const [k,v] of [...q,...h]) o[k]=v;
fetch("${DONE_PATH}",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(o)})
 .then(r=>r.text()).then(t=>{document.body.innerHTML=t;});`;

let active = null;

function listen(port) {
  return new Promise((resolve, reject) => {
    const srv = http.createServer();
    srv.once("error", reject);
    srv.listen(port, "127.0.0.1", () => resolve(srv));
  });
}

async function userFor(accessToken) {
  const r = await net.fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error(`Supabase /user ${r.status}`);
  return r.json();
}

function jwtExp(token) {
  try { return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).exp; } catch { return null; }
}

/**
 * Abre el login en el navegador por defecto y resuelve con una sesión de Supabase lista para guardar.
 * @param {string} origin  origen del lector (https://reader.torresburriel.es)
 * @param {string} provider  "google"
 */
async function signInInBrowser(origin, provider = "google") {
  if (active) { shell.openExternal(active.url); return active.promise; }

  const state = crypto.randomBytes(16).toString("hex");
  // El broker de Lovable acepta http://127.0.0.1/iframe-oauth/callback (puerto 80). En macOS
  // cualquier usuario puede escuchar en puertos bajos desde Mojave.
  let srv, redirectUri;
  try {
    srv = await listen(80);
    redirectUri = `http://127.0.0.1${CALLBACK_PATH}`;
  } catch {
    srv = await listen(0);
    redirectUri = `http://127.0.0.1:${srv.address().port}${CALLBACK_PATH}`;
  }

  const params = new URLSearchParams({ provider, redirect_uri: redirectUri, state });
  const url = `${origin}/~oauth/initiate?${params}`;

  let finish;
  const promise = new Promise((resolve, reject) => { finish = { resolve, reject }; });
  const timer = setTimeout(() => finish.reject(new Error("Se ha agotado el tiempo de espera del login.")), TIMEOUT_MS);

  srv.on("request", (req, res) => {
    const u = new URL(req.url, "http://127.0.0.1");
    const html = (code, t, b, s) => { res.writeHead(code, { "content-type": "text/html; charset=utf-8" }); res.end(page(t, b, s)); };

    if (req.method === "GET" && u.pathname === CALLBACK_PATH) {
      return html(200, "Conectando con Lector…", "Un momento.", RELAY);
    }
    if (req.method === "POST" && u.pathname === DONE_PATH) {
      let raw = "";
      req.on("data", (c) => { raw += c; if (raw.length > 64 * 1024) req.destroy(); });
      req.on("end", async () => {
        const send = (ok, msg) => { res.writeHead(ok ? 200 : 400, { "content-type": "text/html; charset=utf-8" });
          res.end(`<h1 style="font-size:18px">${ok ? "Listo" : "No se ha podido iniciar sesión"}</h1><p style="color:#888">${msg}</p>`); };
        try {
          const d = JSON.parse(raw || "{}");
          if (d.state !== state) throw new Error("La respuesta no corresponde a esta solicitud (state).");
          if (d.error) throw new Error(d.error_description || d.error);
          if (!d.access_token || !d.refresh_token) throw new Error("No han llegado los tokens de sesión.");
          const user = await userFor(d.access_token);
          const exp = jwtExp(d.access_token) || Math.floor(Date.now() / 1000) + 3600;
          const session = {
            access_token: d.access_token, refresh_token: d.refresh_token, token_type: "bearer",
            expires_in: Math.max(0, exp - Math.floor(Date.now() / 1000)), expires_at: exp, user,
          };
          send(true, "Ya puedes cerrar esta pestaña y volver a Lector.");
          finish.resolve(session);
        } catch (e) {
          send(false, String(e.message || e));
          finish.reject(e);
        }
      });
      return;
    }
    html(404, "Lector", "Nada que ver aquí.");
  });

  active = { url, promise };
  promise.finally(() => { clearTimeout(timer); active = null; setTimeout(() => srv.close(), 1500); }).catch(() => {});
  await shell.openExternal(url);
  return promise;
}

// Clave de localStorage que usa supabase-js v2: sb-<ref>-auth-token
const storageKey = () => `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;

module.exports = { signInInBrowser, storageKey };
