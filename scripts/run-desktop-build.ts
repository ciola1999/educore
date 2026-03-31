import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";

type DesktopRuntimeConfig = {
  host: string;
  port: number;
  nodeBinary: string;
  serverEntrypoint: string;
  appDir: string;
  bundleArchive: string;
  bundleVersion: string;
  env: Record<string, string>;
};

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3210;
const DESKTOP_RUNTIME_DIR = resolve(
  process.cwd(),
  "src-tauri",
  "desktop-runtime",
);
const DESKTOP_RUNTIME_STAGING_DIR = resolve(
  process.cwd(),
  ".desktop-runtime-staging",
);

function readText(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function failSecure(message: string): never {
  console.error(message);
  process.exit(1);
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

function readPackageVersion() {
  const packageJson = JSON.parse(readText("package.json")) as {
    version?: string;
  };
  return packageJson.version?.trim() || "0.1.0";
}

function pickEnvValue(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return null;
}

function requireEnv(label: string, ...keys: string[]) {
  const value = pickEnvValue(...keys);
  if (!value) {
    failSecure(
      [
        "[EDUCORE_DESKTOP_BUILD_BLOCKED]",
        `Desktop production packaging membutuhkan ${label}.`,
        `Set salah satu env berikut sebelum menjalankan build: ${keys.join(", ")}.`,
      ].join("\n"),
    );
  }

  return value;
}

function prepareDesktopRuntimeConfig(): DesktopRuntimeConfig {
  const authDatabaseUrl = requireEnv(
    "AUTH database URL",
    "AUTH_DATABASE_URL",
    "TURSO_DATABASE_URL",
  );
  const authDatabaseAuthToken = requireEnv(
    "AUTH database auth token",
    "AUTH_DATABASE_AUTH_TOKEN",
    "TURSO_AUTH_TOKEN",
    "TURSO_DATABASE_AUTH_TOKEN",
    "TURSO_DATABASE_TURSO_AUTH_TOKEN",
  );
  const syncDatabaseUrl = requireEnv(
    "SYNC database URL",
    "SYNC_DATABASE_URL",
    "TURSO_DATABASE_URL",
  );
  const syncDatabaseAuthToken = requireEnv(
    "SYNC database auth token",
    "SYNC_DATABASE_AUTH_TOKEN",
    "TURSO_AUTH_TOKEN",
    "TURSO_DATABASE_AUTH_TOKEN",
    "TURSO_DATABASE_TURSO_AUTH_TOKEN",
  );
  const authSecret = requireEnv(
    "AUTH secret",
    "AUTH_SECRET",
    "NEXTAUTH_SECRET",
  );
  const version =
    process.env.NEXT_PUBLIC_APP_VERSION?.trim() || readPackageVersion();
  const nodeBinary = basename(process.execPath);
  const appOrigin = `http://${DEFAULT_HOST}:${DEFAULT_PORT}`;

  return {
    host: DEFAULT_HOST,
    port: DEFAULT_PORT,
    nodeBinary,
    serverEntrypoint: "app/server.js",
    appDir: "app",
    bundleArchive: "runtime-bundle.tar",
    bundleVersion: version,
    env: {
      NODE_ENV: "production",
      HOSTNAME: DEFAULT_HOST,
      PORT: String(DEFAULT_PORT),
      AUTH_TRUST_HOST: "true",
      AUTH_URL: appOrigin,
      NEXTAUTH_URL: appOrigin,
      AUTH_SECRET: authSecret,
      NEXTAUTH_SECRET: authSecret,
      AUTH_DATABASE_URL: authDatabaseUrl,
      AUTH_DATABASE_AUTH_TOKEN: authDatabaseAuthToken,
      SYNC_DATABASE_URL: syncDatabaseUrl,
      SYNC_DATABASE_AUTH_TOKEN: syncDatabaseAuthToken,
      NEXT_PUBLIC_APP_VERSION: version,
      EDUCORE_DESKTOP_RUNTIME: "embedded-local-web-server",
      EDUCORE_DESKTOP_RELEASE_CHANNEL:
        process.env.EDUCORE_DESKTOP_RELEASE_CHANNEL?.trim() ||
        "production-candidate",
    },
  };
}

function ensureStandaloneArtifacts() {
  const standaloneDir = resolve(process.cwd(), ".next", "standalone");
  const standaloneServer = resolve(standaloneDir, "server.js");
  const staticDir = resolve(process.cwd(), ".next", "static");

  if (!existsSync(standaloneDir) || !existsSync(standaloneServer)) {
    failSecure(
      [
        "[EDUCORE_DESKTOP_BUILD_BLOCKED]",
        "Output standalone Next.js belum ditemukan di .next/standalone.",
        'Pastikan next.config.ts mengaktifkan `output: "standalone"` dan build web berhasil penuh.',
      ].join("\n"),
    );
  }

  if (!existsSync(staticDir)) {
    failSecure(
      [
        "[EDUCORE_DESKTOP_BUILD_BLOCKED]",
        "Asset .next/static tidak ditemukan setelah build.",
        "Desktop packaged runtime membutuhkan asset ini agar kontrak App Router tetap utuh.",
      ].join("\n"),
    );
  }
}

function ensureRuntimeHostExecutable() {
  if (!existsSync(process.execPath)) {
    failSecure(
      [
        "[EDUCORE_DESKTOP_BUILD_BLOCKED]",
        `Executable host runtime tidak ditemukan di ${process.execPath}.`,
        "Desktop packaged runtime tidak boleh dibangun tanpa executable untuk server embedded.",
      ].join("\n"),
    );
  }

  const stats = statSync(process.execPath);
  if (!stats.isFile()) {
    failSecure(
      [
        "[EDUCORE_DESKTOP_BUILD_BLOCKED]",
        `Host runtime executable tidak valid: ${process.execPath}.`,
      ].join("\n"),
    );
  }
}

function copyIfExists(source: string, target: string) {
  if (!existsSync(source)) {
    return;
  }

  cpSync(source, target, { recursive: true, dereference: true, force: true });
}

function resolveTarBinary() {
  const explicitPath = process.env.SystemRoot
    ? join(process.env.SystemRoot, "System32", "tar.exe")
    : null;

  if (explicitPath && existsSync(explicitPath)) {
    return explicitPath;
  }

  return "tar";
}

function runTarArchive(stagingDir: string, archivePath: string) {
  const tarBinary = resolveTarBinary();
  const result = spawnSync(
    tarBinary,
    ["-cf", archivePath, "-C", stagingDir, "."],
    {
      cwd: process.cwd(),
      stdio: "inherit",
      shell: true,
      env: process.env,
    },
  );

  if (result.status !== 0) {
    failSecure(
      [
        "[EDUCORE_DESKTOP_BUILD_BLOCKED]",
        "Gagal membuat archive runtime desktop.",
        "Pastikan utilitas `tar` tersedia di environment Windows ini.",
      ].join("\n"),
    );
  }
}

function prepareDesktopRuntimeBundle(config: DesktopRuntimeConfig) {
  ensureStandaloneArtifacts();
  ensureRuntimeHostExecutable();

  const runtimeAppDir = join(DESKTOP_RUNTIME_STAGING_DIR, config.appDir);
  const standaloneDir = resolve(process.cwd(), ".next", "standalone");
  const staticDir = resolve(process.cwd(), ".next", "static");
  const publicDir = resolve(process.cwd(), "public");
  const archivePath = join(DESKTOP_RUNTIME_DIR, config.bundleArchive);

  rmSync(DESKTOP_RUNTIME_STAGING_DIR, { recursive: true, force: true });
  rmSync(DESKTOP_RUNTIME_DIR, { recursive: true, force: true });
  mkdirSync(runtimeAppDir, { recursive: true });
  mkdirSync(DESKTOP_RUNTIME_DIR, { recursive: true });

  cpSync(standaloneDir, runtimeAppDir, {
    recursive: true,
    dereference: true,
    force: true,
  });
  mkdirSync(join(runtimeAppDir, ".next"), { recursive: true });
  cpSync(staticDir, join(runtimeAppDir, ".next", "static"), {
    recursive: true,
    dereference: true,
    force: true,
  });
  copyIfExists(publicDir, join(runtimeAppDir, "public"));
  cpSync(
    process.execPath,
    join(DESKTOP_RUNTIME_STAGING_DIR, config.nodeBinary),
  );

  runTarArchive(DESKTOP_RUNTIME_STAGING_DIR, archivePath);
  rmSync(DESKTOP_RUNTIME_STAGING_DIR, { recursive: true, force: true });

  writeFileSync(
    join(DESKTOP_RUNTIME_DIR, "runtime-config.json"),
    `${JSON.stringify(config, null, 2)}\n`,
    "utf8",
  );
}

function stabilizeRuntimeBundle(delayMs = 1_500) {
  // Windows can briefly keep fresh native addon copies busy right after cpSync.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
}

function assertBootstrapShellExists() {
  const bootstrapIndex = resolve(
    process.cwd(),
    "src-tauri",
    "bootstrap",
    "index.html",
  );
  if (!existsSync(bootstrapIndex)) {
    failSecure(
      [
        "[EDUCORE_DESKTOP_BUILD_BLOCKED]",
        "Bootstrap shell src-tauri/bootstrap/index.html tidak ditemukan.",
        "Window Tauri production harus punya startup shell yang jujur sebelum loopback siap.",
      ].join("\n"),
    );
  }
}

function validateTauriConfig() {
  const tauriConfigText = readText("src-tauri/tauri.conf.json");
  const usesBootstrapShell = tauriConfigText.includes(
    '"frontendDist": "bootstrap"',
  );
  const bundlesDesktopRuntime = tauriConfigText.includes(
    "desktop-runtime/**/*",
  );

  if (!usesBootstrapShell || !bundlesDesktopRuntime) {
    failSecure(
      [
        "[EDUCORE_DESKTOP_BUILD_BLOCKED]",
        "src-tauri/tauri.conf.json belum menunjuk bootstrap shell dan resource desktop-runtime yang benar.",
        'Expected frontendDist "bootstrap" and bundle.resources entry for "desktop-runtime/**/*".',
      ].join("\n"),
    );
  }
}

function main() {
  runNextBuild();
  assertBootstrapShellExists();
  validateTauriConfig();

  const config = prepareDesktopRuntimeConfig();
  prepareDesktopRuntimeBundle(config);
  stabilizeRuntimeBundle();

  console.log(
    [
      "[EDUCORE_DESKTOP_BUILD_READY]",
      `Desktop runtime bundle siap di ${DESKTOP_RUNTIME_DIR}.`,
      `Loopback origin: http://${config.host}:${config.port}`,
      "Status saat ini: desktop packaged production candidate, belum otomatis release-final sampai smoke artifact nyata lulus.",
    ].join("\n"),
  );
}

main();
