# Lector for Mac

Native macOS app for [Lector](https://reader.torresburriel.es), an RSS reader faithful to Google Reader: same design, same keyboard shortcuts, plus highlights and notes.

The app opens Lector in a native Mac window. Your subscriptions, highlights and account are the same as on the web.

**[⬇ Download the latest version](https://github.com/torresburriel/lector-mac/releases/latest)**

## Install

1. On the release page, download the zip for your Mac:
   - `Lector-x.y.z-mac-arm64.zip` for Apple Silicon Macs (M1 or later).
   - `Lector-x.y.z-mac-x64.zip` for Intel Macs.

   Not sure which one you have? Apple menu  → About This Mac: if "Chip" says Apple M…, it's Apple Silicon.
2. Unzip it and drag **Lector.app** to your Applications folder.
3. Open it. The first time, macOS will say it "cannot verify that it is free of malware". That's because the app isn't signed with an Apple developer account. To open it:
   - Go to **System Settings → Privacy & Security**, scroll down to **Security** and click **Open Anyway**.
   - Or, in Terminal: `xattr -dr com.apple.quarantine /Applications/Lector.app`

   You only need to do this once.

Requires macOS 12 Monterey or later.

## What it adds to the web version

- Native window with a menu and ⌘ shortcuts: refresh (⌘R), add subscription (⌘N), search (⌘F), mark all as read (⌘⇧A), expanded and list view (⌘1 / ⌘2)… The classic Google Reader shortcuts (j, k, s, m, v…) still work.
- Unread count on the Dock icon.
- Article links open in your default browser.
- Google sign-in happens in your browser, so passkeys work (Touch ID, iCloud Keychain). The session comes back to the app on its own.
- Remembers window size and your last view.
- Its own offline screen, with automatic retry.

The app's menus are in Spanish for now.

## Privacy

The app collects no data and sends no analytics. It just shows reader.torresburriel.es. To sign in, it opens a temporary local server on `127.0.0.1`, used only to receive the session from your browser and closed right after. What the web service does with your data is covered by its [privacy policy](https://reader.torresburriel.es/legal/privacy).

## For developers

Built with [Electron](https://www.electronjs.org/).

| File | What it does |
| --- | --- |
| `app/main.js` | Window, menus, external links, window state, Dock badge |
| `app/auth-bridge.js` | Sign-in in the system browser and session hand-off over loopback |
| `app/preload.js` | Reads the "All items" count for the Dock |
| `app/offline.html` | Offline screen |
| `build.js` | Packages for macOS (arm64 and x64) |
| `.github/workflows/release.yml` | Builds, ad-hoc signs and publishes each release |

```bash
npm install
npm start                                    # run the app
LECTOR_URL=http://localhost:8080 npm start   # point it at another Lector instance
npm run package                              # build dist/ (arm64 and x64)
```

To publish a release: Actions → **Publicar versión** → Run workflow, with the version number. It also runs when you push a `vX.Y.Z` tag.

Bugs and ideas go in [Issues](https://github.com/torresburriel/lector-mac/issues).

## License

[GPL-3.0](LICENSE). You can use, study, modify and redistribute the code. If you distribute a modified version, it must include its source code under the same license.

© Daniel Torres Burriel · [Torresburriel Estudio](https://www.torresburriel.com)

---

**En español.** Lector para Mac es la app de escritorio de [Lector](https://reader.torresburriel.es), un lector de RSS al estilo de Google Reader. Descarga la última versión en [Releases](https://github.com/torresburriel/lector-mac/releases/latest) (`arm64` para Apple Silicon, `x64` para Intel). La app no está firmada por Apple: la primera vez, ve a Ajustes del Sistema → Privacidad y seguridad → Abrir igualmente, o ejecuta `xattr -dr com.apple.quarantine /Applications/Lector.app`. Licencia GPL-3.0.
