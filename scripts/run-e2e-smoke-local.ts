import { spawnSync } from "node:child_process";

const commands = process.platform === "win32" ? ["bun", "bun.cmd"] : ["bun"];

let exitCode = 1;

for (const command of commands) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    E2E_ATTENDANCE_IDENTIFIER: "admin@educore.school",
    E2E_ATTENDANCE_PASSWORD: "admin123",
    E2E_SETTINGS_IDENTIFIER: "admin@educore.school",
    E2E_SETTINGS_PASSWORD: "admin123",
  };

  if (process.env.PLAYWRIGHT_BASE_URL) {
    env.PLAYWRIGHT_BASE_URL = process.env.PLAYWRIGHT_BASE_URL;
  }

  const result = spawnSync(
    command,
    ["run", "scripts/run-e2e-strict.ts", "--smoke"],
    {
      stdio: "inherit",
      env,
    },
  );

  if (result.error) {
    console.error(`[run-e2e-smoke-local] failed with ${command}`, result.error);
    continue;
  }

  exitCode = result.status ?? 1;
  break;
}

process.exit(exitCode);
