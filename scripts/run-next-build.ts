import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

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
  const nodeMajor = getNodeMajorVersion();
  const env = { ...process.env };

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
  const result = spawnSync(process.execPath, [nextBin, "build"], {
    stdio: "inherit",
    env,
  });

  process.exit(result.status ?? 1);
}

run();
