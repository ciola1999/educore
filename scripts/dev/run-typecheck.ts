import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const tsconfigPath = resolve(repoRoot, "tsconfig.json");
const nextEnvPath = resolve(repoRoot, "next-env.d.ts");

function runCommand(command: string, args: string[]) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function normalizeTsconfig() {
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

  writeFileSync(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`);
}

function normalizeNextEnv() {
  const current = readFileSync(nextEnvPath, "utf8");
  const normalized = current.replace(
    /import\s+["']\.\/\.next\/dev\/types\/routes\.d\.ts["'];?/,
    'import "./.next/types/routes.d.ts";',
  );

  if (normalized !== current) {
    writeFileSync(nextEnvPath, normalized);
  }
}

runCommand("npx", ["next", "typegen"]);
normalizeTsconfig();
normalizeNextEnv();
runCommand("bunx", ["tsc", "--noEmit"]);
