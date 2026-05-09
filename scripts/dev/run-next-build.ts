import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const MIN_SAFE_NODE_MAJOR = 22;
const tsconfigPath = resolve(process.cwd(), "tsconfig.json");
const nextEnvPath = resolve(process.cwd(), "next-env.d.ts");

function getNodeMajorVersion(): number {
  const [major] = process.versions.node.split(".");
  const parsed = Number.parseInt(major ?? "0", 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getRuntimeNodeMajorVersion(runtimeBinary: string): number {
  const result = spawnSync(runtimeBinary, ["-v"], {
    encoding: "utf8",
  });
  if (result.error) {
    console.error("");
    console.error("[EDUCORE_BUILD] Unable to spawn Node.js from build runner.");
    console.error(`[EDUCORE_BUILD] Runtime command: ${runtimeBinary}`);
    console.error(`[EDUCORE_BUILD] Spawn error: ${result.error.message}`);
    console.error(
      "[EDUCORE_BUILD] This usually means Windows security policy, antivirus, or the current sandbox blocks Bun/Next from starting child processes.",
    );
    console.error("[EDUCORE_BUILD] Recommended:");
    console.error("  1. Re-open PowerShell as a normal user terminal");
    console.error(
      "  2. Check antivirus / Windows Defender Controlled Folder Access / App Control logs",
    );
    console.error("  3. Allow node.exe and bun.exe to spawn child processes");
    console.error("  4. Run: bun run build");
    console.error("");
    process.exit(1);
  }
  const stdout = typeof result.stdout === "string" ? result.stdout : "";
  const parsed = Number.parseInt(stdout.trim().replace(/^v/, ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function warnUnsupportedNodeVersion(runtimeBinary: string) {
  const runtimeNodeMajor = getRuntimeNodeMajorVersion(runtimeBinary);
  if (runtimeNodeMajor > 0 && runtimeNodeMajor < MIN_SAFE_NODE_MAJOR) {
    console.warn("");
    console.warn(
      `[EDUCORE_BUILD] Node ${runtimeNodeMajor} detected. EduCore expects Node >= ${MIN_SAFE_NODE_MAJOR}.`,
    );
    console.warn("");
  }
}

function sanitizeNodeOptions(
  input: string | undefined,
  storageFile: string,
): string {
  const tokens = (input ?? "")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  let hasLocalStorageOption = false;
  const sanitizedTokens: string[] = [];

  for (const token of tokens) {
    if (token === "--localstorage-file") {
      hasLocalStorageOption = true;
      continue;
    }

    if (token.startsWith("--localstorage-file=")) {
      hasLocalStorageOption = true;
      const value = token.slice("--localstorage-file=".length).trim();
      if (value.length > 0) {
        sanitizedTokens.push(token);
      }
      continue;
    }

    sanitizedTokens.push(token);
  }

  if (!hasLocalStorageOption) {
    sanitizedTokens.push(`--localstorage-file=${storageFile}`);
  } else if (
    !sanitizedTokens.some((token) => token.startsWith("--localstorage-file="))
  ) {
    sanitizedTokens.push(`--localstorage-file=${storageFile}`);
  }

  return sanitizedTokens.join(" ");
}

function resetNextBuildOutput() {
  rmSync(resolve(process.cwd(), ".next"), {
    recursive: true,
    force: true,
    maxRetries: 3,
  });
}

function shouldResetNextBuildOutput() {
  return process.env.EDUCORE_FORCE_CLEAN_NEXT_BUILD === "1";
}

function shouldUseWebpackBuild(env: NodeJS.ProcessEnv) {
  return env.EDUCORE_NEXT_BUILD_WEBPACK === "1";
}

function formatTsconfigJson(tsconfig: unknown) {
  return `${JSON.stringify(tsconfig, null, 2)
    .replace(
      /"lib": \[\n\s+"dom",\n\s+"dom\.iterable",\n\s+"esnext"\n\s+\]/,
      '"lib": ["dom", "dom.iterable", "esnext"]',
    )
    .replace(/"@\/\*": \[\n\s+"\.\/src\/\*"\n\s+\]/, '"@/*": ["./src/*"]')
    .replace(
      /"exclude": \[\n\s+"node_modules",\n\s+"src-tauri",\n\s+"\.next\/dev\/types"\n\s+\]/,
      '"exclude": ["node_modules", "src-tauri", ".next/dev/types"]',
    )}\n`;
}

function normalizeNextTypegenConfig() {
  const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf8")) as {
    include?: string[];
    exclude?: string[];
  };

  tsconfig.include = (tsconfig.include ?? []).filter(
    (entry) => entry !== ".next/dev/types/**/*.ts",
  );

  const exclude = new Set(tsconfig.exclude ?? []);
  exclude.add(".next/dev/types");
  tsconfig.exclude = [...exclude];

  writeFileSync(tsconfigPath, formatTsconfigJson(tsconfig));

  const currentNextEnv = readFileSync(nextEnvPath, "utf8");
  const normalizedNextEnv = currentNextEnv.replace(
    /import\s+["']\.\/\.next\/dev\/types\/routes\.d\.ts["'];?/,
    'import "./.next/types/routes.d.ts";',
  );

  if (normalizedNextEnv !== currentNextEnv) {
    writeFileSync(nextEnvPath, normalizedNextEnv);
  }
}

function run() {
  const nodeMajor = getNodeMajorVersion();
  const env = { ...process.env };

  if (shouldResetNextBuildOutput()) {
    resetNextBuildOutput();
  }

  // Node >= 22 may warn when localStorage flag is malformed/empty.
  // Normalize once so Next worker processes get a valid path.
  if (nodeMajor >= 22) {
    const localStorageDir = resolve(process.cwd(), ".next");
    mkdirSync(localStorageDir, { recursive: true });
    const localStorageFile = resolve(localStorageDir, "node-localstorage");
    env.NODE_OPTIONS = sanitizeNodeOptions(env.NODE_OPTIONS, localStorageFile);
  }

  const nextBin = resolve(
    process.cwd(),
    "node_modules",
    "next",
    "dist",
    "bin",
    "next",
  );
  const runtimeBinary = basename(process.execPath).toLowerCase().includes("bun")
    ? "node"
    : process.execPath;
  warnUnsupportedNodeVersion(runtimeBinary);
  const useWebpack = shouldUseWebpackBuild(env);
  const args = [
    nextBin,
    "build",
    ...(useWebpack ? ["--webpack"] : []),
    ...(env.EDUCORE_NEXT_BUILD_PROFILE === "1" ? ["--profile"] : []),
  ];
  const result = spawnSync(runtimeBinary, args, {
    stdio: "inherit",
    env,
  });

  normalizeNextTypegenConfig();
  process.exit(result.status ?? 1);
}

run();
