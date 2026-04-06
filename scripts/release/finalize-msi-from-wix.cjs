const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = process.cwd();
const wixRoot = path.join(
  projectRoot,
  "src-tauri",
  "target",
  "release",
  "wix",
  "x64",
);
const bundleRoot = path.join(
  projectRoot,
  "src-tauri",
  "target",
  "release",
  "bundle",
  "msi",
);
const desktopRuntimeRoot = path.join(
  projectRoot,
  "src-tauri",
  "desktop-runtime",
);
const wixToolsRoot = path.join(
  "C:\\Users\\Arjunior\\AppData\\Local\\tauri\\WixTools314",
);

const mainWxsPath = path.join(wixRoot, "main.wxs");
const mainWixObjPath = path.join(wixRoot, "main.wixobj");
const localePath = path.join(wixRoot, "locale.wxl");
const outputMsiPath = path.join(bundleRoot, "educore_0.1.0_x64_en-US.msi");
const runtimeConfigPath = path.join(desktopRuntimeRoot, "runtime-config.json");
const candlePath = path.join(wixToolsRoot, "candle.exe");
const lightPath = path.join(wixToolsRoot, "light.exe");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function ensureExists(targetPath, label) {
  if (!fs.existsSync(targetPath)) {
    fail(`[MSI_FINALIZE_BLOCKED] ${label} tidak ditemukan di ${targetPath}`);
  }
}

function normalizeRuntimeConfig() {
  ensureExists(runtimeConfigPath, "runtime-config");
  const config = JSON.parse(fs.readFileSync(runtimeConfigPath, "utf8"));
  if (config.bundleArchive !== "runtime-bundle.tar") {
    config.bundleArchive = "runtime-bundle.tar";
    fs.writeFileSync(
      runtimeConfigPath,
      `${JSON.stringify(config, null, 2)}\n`,
      "utf8",
    );
  }
}

function sanitizeMainWxs() {
  ensureExists(mainWxsPath, "main.wxs");
  let text = fs.readFileSync(mainWxsPath, "utf8");

  const removedComponentIds = [];
  text = text.replace(
    /<Component Id="([^"]+)"[^>]*>\s*<File Id="[^"]+" Source="[^"]*runtime-bundle-\d+\.tar" \/><\/Component>/g,
    (_, componentId) => {
      removedComponentIds.push(componentId);
      return "";
    },
  );

  for (const componentId of removedComponentIds) {
    const componentRefPattern = new RegExp(
      `<ComponentRef Id="${componentId}"\\s*/>\\r?\\n?`,
      "g",
    );
    text = text.replace(componentRefPattern, "");
  }

  fs.writeFileSync(mainWxsPath, text, "utf8");
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    fail(
      `[MSI_FINALIZE_BLOCKED] ${path.basename(command)} gagal dengan exit code ${result.status ?? 1}.`,
    );
  }
}

function main() {
  ensureExists(candlePath, "WiX candle.exe");
  ensureExists(lightPath, "WiX light.exe");
  ensureExists(localePath, "locale.wxl");
  ensureExists(
    path.join(desktopRuntimeRoot, "runtime-bundle.tar"),
    "runtime-bundle.tar",
  );

  normalizeRuntimeConfig();
  sanitizeMainWxs();

  run(candlePath, [
    "-arch",
    "x64",
    "-ext",
    "WixUIExtension",
    "-out",
    mainWixObjPath,
    mainWxsPath,
  ]);

  run(lightPath, [
    "-sval",
    "-ext",
    "WixUIExtension",
    "-cultures:en-us",
    "-loc",
    localePath,
    "-o",
    outputMsiPath,
    mainWixObjPath,
  ]);

  console.log(`[MSI_FINALIZE_READY] MSI siap di ${outputMsiPath}`);
}

main();
