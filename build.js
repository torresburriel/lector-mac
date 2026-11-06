const { packager } = require("@electron/packager");
(async () => {
  const arch = process.argv[2] || "arm64,x64";
  const out = await packager({
    dir: "app", out: "dist", name: "Lector", platform: "darwin", arch: arch.split(","),
    electronVersion: "38.2.0", icon: "build/icon.icns", overwrite: true, asar: true,
    appBundleId: "es.torresburriel.lector", appCategoryType: "public.app-category.news",
    appVersion: "1.1.0", buildVersion: "2", appCopyright: "Torresburriel Estudio",
    darwinDarkModeSupport: true,
    extendInfo: { LSMinimumSystemVersion: "12.0", NSHumanReadableCopyright: "Torresburriel Estudio" },
  });
  console.log(out.join("\n"));
})();
