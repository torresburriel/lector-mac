# Lector para Mac

App de escritorio para macOS de [Lector](https://reader.torresburriel.es), un lector de RSS inspirado en Google Reader: mismo diseño, mismos atajos de teclado, y subrayado y notas como añadido.

La app abre Lector en una ventana nativa de Mac. Tus suscripciones, tus subrayados y tu cuenta son los mismos que en la web.

**[⬇ Descargar la última versión](https://github.com/torresburriel/lector-mac/releases/latest)**

## instalar

1. En la página de la versión, descarga el zip que corresponda a tu Mac:
   - `Lector-x.y.z-mac-arm64.zip` para Mac con Apple Silicon (M1 o posterior).
   - `Lector-x.y.z-mac-x64.zip` para Mac con procesador Intel.

   ¿No sabes cuál tienes? Menú  → Acerca de este Mac: si en «Chip» pone Apple M…, es Apple Silicon.
2. Descomprime el zip y arrastra **Lector.app** a la carpeta Aplicaciones.
3. Ábrela. La primera vez macOS dirá que «no puede comprobar si hay software malicioso». La app no está firmada con una cuenta de desarrollador de Apple, y por eso aparece el aviso. Para abrirla:
   - Ve a **Ajustes del Sistema → Privacidad y seguridad**, baja hasta **Seguridad** y pulsa **Abrir igualmente**.
   - O, en Terminal: `xattr -dr com.apple.quarantine /Applications/Lector.app`

   Solo hace falta la primera vez.

Requiere macOS 12 Monterey o posterior.

## qué añade a la web

- Ventana nativa con menú en español y atajos con ⌘: actualizar (⌘R), añadir suscripción (⌘N), buscar (⌘F), marcar todo como leído (⌘⇧A), vista expandida y vista de lista (⌘1 / ⌘2)… Los atajos de siempre de Google Reader (j, k, s, m, v…) siguen funcionando.
- Contador de no leídos en el Dock.
- Los enlaces de los artículos se abren en tu navegador por defecto.
- El login con Google se hace en tu navegador, así que funcionan las passkeys (Touch ID, llavero de iCloud). La sesión vuelve sola a la app.
- Recuerda el tamaño de la ventana y la última vista.
- Pantalla propia cuando no hay conexión, con reintento automático.

## privacidad

La app no recoge datos ni envía analítica. Se limita a mostrar reader.torresburriel.es. Para el login abre un servidor local temporal en `127.0.0.1`, que solo sirve para recibir la sesión desde tu navegador y se cierra después. Lo que haga la web con tus datos está en su [política de privacidad](https://reader.torresburriel.es/legal/privacy).

## para desarrolladores

La app está hecha con [Electron](https://www.electronjs.org/).

| Archivo | Qué hace |
| --- | --- |
| `app/main.js` | Ventana, menús, enlaces externos, estado de ventana, badge del Dock |
| `app/auth-bridge.js` | Login en el navegador del sistema y entrega de la sesión por loopback |
| `app/preload.js` | Lee el contador de «All items» para el Dock |
| `app/offline.html` | Pantalla sin conexión |
| `build.js` | Empaqueta para macOS (arm64 y x64) |
| `.github/workflows/release.yml` | Construye, firma ad hoc y publica cada versión |

```bash
npm install
npm start                                    # arranca la app
LECTOR_URL=http://localhost:8080 npm start   # contra otra instancia del lector
npm run package                              # genera dist/ (arm64 y x64)
```

Para publicar una versión: Actions → **Publicar versión** → Run workflow, con el número de versión. También se lanza al subir una etiqueta `vX.Y.Z`.

Los problemas y las propuestas, en [Issues](https://github.com/torresburriel/lector-mac/issues).

## licencia

[GPL-3.0](LICENSE). Puedes usar, estudiar, modificar y redistribuir el código. Si distribuyes una versión modificada, tiene que llevar también su código fuente bajo la misma licencia.

© Daniel Torres Burriel · [Torresburriel Estudio](https://www.torresburriel.com)

---

**English.** Lector for Mac is a native macOS wrapper for [Lector](https://reader.torresburriel.es), a Google Reader–style RSS reader. Download the latest build from [Releases](https://github.com/torresburriel/lector-mac/releases/latest) (`arm64` for Apple Silicon, `x64` for Intel). The app is not notarized: on first launch, go to System Settings → Privacy & Security → Open Anyway, or run `xattr -dr com.apple.quarantine /Applications/Lector.app`. Licensed under GPL-3.0.
