# Lector para Mac

App de escritorio para macOS de [reader.torresburriel.es](https://reader.torresburriel.es), hecha con Electron.

## descargar

Ve a **Releases** (columna derecha) y descarga el zip que corresponda a tu Mac:

- `Lector-x.y.z-mac-arm64.zip`: Apple Silicon (M1 o posterior)
- `Lector-x.y.z-mac-x64.zip`: Intel

Descomprime y arrastra **Lector.app** a Aplicaciones. La primera vez, macOS la bloquea porque no está firmada con cuenta de desarrollador: Ajustes del Sistema → Privacidad y seguridad → «Abrir igualmente».

## qué hace

- Carga el lector web en una ventana nativa, con menú en español y atajos con ⌘.
- Contador de no leídos en el Dock.
- Los enlaces de artículos se abren en el navegador por defecto.
- El login con Google se hace en el navegador del sistema (donde funcionan las passkeys) y la sesión vuelve a la app por 127.0.0.1.
- Pantalla propia sin conexión con reintento automático.

## estructura

- `app/main.js`: ventana, menús, enlaces, estado de ventana, badge.
- `app/auth-bridge.js`: login en el navegador y entrega de la sesión.
- `app/preload.js`: lee el contador de «All items».
- `app/offline.html`: pantalla sin conexión.
- `build.js`: empaqueta para macOS (arm64 y x64).

## desarrollo

```bash
npm install
npm start            # arranca la app
npm run package      # genera dist/ (arm64 y x64)
```

En un Mac, firma ad hoc tras empaquetar: `codesign --force --deep -s - dist/Lector-darwin-arm64/Lector.app`
