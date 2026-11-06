"use strict";
const { ipcRenderer } = require("electron");

// Lee el contador de “All items (N)” de la barra lateral y lo envía al Dock.
let last = -1, timer = null;
function readUnread() {
  const btns = document.querySelectorAll("button");
  for (const b of btns) {
    const spans = b.querySelectorAll("span");
    if (!spans.length || spans[0].textContent.trim() !== "All items") continue;
    const m = (spans[1]?.textContent || "").match(/\((\d+)(\+)?\)/);
    return m ? (m[2] ? 1000 : parseInt(m[1], 10)) : 0;
  }
  return null; // fuera del lector (login, ajustes…): no tocar el badge
}
function tick() {
  timer = null;
  const n = readUnread();
  if (n !== null && n !== last) { last = n; ipcRenderer.send("lector:unread", n); }
}
window.addEventListener("DOMContentLoaded", () => {
  new MutationObserver(() => { if (!timer) timer = setTimeout(tick, 400); })
    .observe(document.body, { subtree: true, childList: true, characterData: true });
  tick();

  // Botón de reintento de la página sin conexión.
  const retry = document.getElementById("retry");
  if (retry) retry.addEventListener("click", () => ipcRenderer.send("lector:retry", retry.dataset.url));
});
