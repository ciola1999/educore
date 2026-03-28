import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function readText(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function runNextBuild() {
  const result = spawnSync("bun", ["run", "build"], {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function main() {
  runNextBuild();

  const nextConfigText = readText("next.config.ts");
  const tauriConfigText = readText("src-tauri/tauri.conf.json");
  const frontendDist = resolve(process.cwd(), "out");
  const usesStaticFrontendDist = tauriConfigText.includes(
    '"frontendDist": "../out"',
  );
  const usesStaticExport = /output\s*:\s*["']export["']/.test(nextConfigText);

  if (usesStaticFrontendDist && !usesStaticExport) {
    const staleOutWarning = existsSync(frontendDist)
      ? `\nDetected existing static bundle at ${frontendDist}. It may be stale and must not be packaged for Tauri release.`
      : "";

    console.error(
      [
        "[EDUCORE_DESKTOP_BUILD_BLOCKED]",
        "Tauri release build is blocked because the current app requires Next.js server features (/api, auth, route handlers),",
        'but src-tauri/tauri.conf.json still points frontendDist to "../out" (static export).',
        "This combination can produce a desktop bundle that looks valid but breaks Master Data and other API-backed flows offline.",
        "Use `bun tauri dev` for local desktop runtime until a dedicated desktop production runtime is implemented.",
        staleOutWarning,
      ].join("\n"),
    );
    process.exit(1);
  }
}

main();
