import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { basename, resolve } from "node:path";

function getNodeMajorVersion(): number {
  const [major] = process.versions.node.split(".");
  const parsed = Number.parseInt(major ?? "0", 10);
  return Number.isFinite(parsed) ? parsed : 0;
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

function run() {
  const env = { ...process.env };
  const nodeMajor = getNodeMajorVersion();

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
  const child = spawn(runtimeBinary, [nextBin, "dev", "-p", "3000"], {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

run();
