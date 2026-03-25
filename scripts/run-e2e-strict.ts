import { spawnSync } from "node:child_process";

const requiredE2EEnv = [
  "E2E_ATTENDANCE_IDENTIFIER",
  "E2E_ATTENDANCE_PASSWORD",
  "E2E_SETTINGS_IDENTIFIER",
  "E2E_SETTINGS_PASSWORD",
] as const;

function readMissingEnv() {
  return requiredE2EEnv.filter((name) => {
    const value = process.env[name];
    return !value || !value.trim();
  });
}

function parseSetCookie(raw: string | null): string {
  if (!raw) {
    return "";
  }

  const entries = raw
    .split(/,(?=[^;]+=[^;]+)/g)
    .map((item) => item.trim())
    .filter(Boolean);

  return entries
    .map((entry) => entry.split(";")[0]?.trim() ?? "")
    .filter(Boolean)
    .join("; ");
}

async function assertServerReachable(baseUrl: string) {
  const providersUrl = new URL("/api/auth/providers", baseUrl).toString();
  try {
    const response = await fetch(providersUrl);
    if (!response.ok) {
      throw new Error(
        `[E2E STRICT] Server reachable but auth providers failed: ${providersUrl} -> ${response.status}`,
      );
    }
  } catch (error) {
    throw new Error(
      [
        "[E2E STRICT] Unable to connect to app URL.",
        `- PLAYWRIGHT_BASE_URL: ${baseUrl}`,
        `- Detail: ${error instanceof Error ? error.message : String(error)}`,
        "Pastikan `bun tauri dev`/`bun run dev` sudah aktif di origin yang sama.",
      ].join("\n"),
    );
  }
}

async function verifyCredentials(params: {
  baseUrl: string;
  identifier: string;
  password: string;
  label: string;
}) {
  const { baseUrl, identifier, password, label } = params;
  const csrfResponse = await fetch(new URL("/api/auth/csrf", baseUrl), {
    redirect: "manual",
  });

  if (!csrfResponse.ok) {
    throw new Error(
      `[E2E STRICT] CSRF fetch failed for ${label}: ${csrfResponse.status}`,
    );
  }

  const csrfCookie = parseSetCookie(csrfResponse.headers.get("set-cookie"));
  const csrfPayload = (await csrfResponse.json()) as { csrfToken?: string };
  const csrfToken = csrfPayload.csrfToken?.trim() ?? "";
  if (!csrfToken) {
    throw new Error(`[E2E STRICT] CSRF token missing for ${label}.`);
  }

  const form = new URLSearchParams({
    csrfToken,
    email: identifier,
    password,
    callbackUrl: new URL("/dashboard", baseUrl).toString(),
    json: "true",
  });

  const response = await fetch(
    new URL("/api/auth/callback/credentials?json=true", baseUrl),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: csrfCookie,
      },
      body: form.toString(),
      redirect: "manual",
    },
  );

  const location = response.headers.get("location") ?? "";
  if (response.status !== 302 || !location.includes("/dashboard")) {
    throw new Error(
      [
        `[E2E STRICT] Invalid credentials for ${label}.`,
        `- identifier: ${identifier}`,
        `- status: ${response.status}`,
        `- location: ${location || "<none>"}`,
      ].join("\n"),
    );
  }
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function assertAuthBaseUrlAlignment(baseUrl: string) {
  const providersUrl = new URL("/api/auth/providers", baseUrl).toString();
  const response = await fetch(providersUrl);
  if (!response.ok) {
    throw new Error(
      `[E2E STRICT] Auth providers endpoint failed: ${providersUrl} -> ${response.status}`,
    );
  }

  const data = (await response.json()) as {
    credentials?: { signinUrl?: string };
  };
  const signinUrl = data.credentials?.signinUrl;

  if (!signinUrl) {
    return;
  }

  const expected = new URL(baseUrl);
  const actual = new URL(signinUrl);
  const samePort = expected.port === actual.port;
  const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  const sameHost =
    expected.hostname === actual.hostname ||
    (loopbackHosts.has(expected.hostname) &&
      loopbackHosts.has(actual.hostname));
  const sameProtocol = expected.protocol === actual.protocol;

  if (!(sameHost && samePort && sameProtocol)) {
    throw new Error(
      [
        "[E2E STRICT] Auth origin mismatch detected.",
        `- PLAYWRIGHT_BASE_URL: ${expected.origin}`,
        `- credentials.signinUrl: ${actual.origin}`,
        "Fix env: unset AUTH_URL/NEXTAUTH_URL in local dev or set them to local origin.",
      ].join("\n"),
    );
  }
}

async function run() {
  const missing = readMissingEnv();
  if (missing.length > 0) {
    console.error("[E2E STRICT] Missing required environment variables:");
    for (const name of missing) {
      console.error(`- ${name}`);
    }
    process.exit(1);
  }

  const cliArgs = process.argv.slice(2);
  const isSmoke = cliArgs.includes("--smoke");
  const explicitBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
  const baseUrl = explicitBaseUrl || "http://127.0.0.1:3000";

  await assertServerReachable(baseUrl);

  if (explicitBaseUrl) {
    try {
      await assertAuthBaseUrlAlignment(baseUrl);
    } catch (error) {
      console.error(String(error));
      process.exit(1);
    }
  }

  const credentialSet = [
    {
      label: "attendance",
      identifier: process.env.E2E_ATTENDANCE_IDENTIFIER?.trim() ?? "",
      password: process.env.E2E_ATTENDANCE_PASSWORD?.trim() ?? "",
    },
    {
      label: "settings",
      identifier: process.env.E2E_SETTINGS_IDENTIFIER?.trim() ?? "",
      password: process.env.E2E_SETTINGS_PASSWORD?.trim() ?? "",
    },
  ];
  const seenKey = new Set<string>();
  for (const credential of credentialSet) {
    const uniqueKey = `${credential.identifier}::${credential.password}`;
    if (seenKey.has(uniqueKey)) {
      continue;
    }
    seenKey.add(uniqueKey);
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await verifyCredentials({
          baseUrl,
          identifier: credential.identifier,
          password: credential.password,
          label: credential.label,
        });
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        if (attempt < 2) {
          await delay(750);
        }
      }
    }

    if (lastError) {
      console.error(String(lastError));
      process.exit(1);
    }
  }

  const commandArgs = isSmoke
    ? ["playwright", "test", "--grep", "@smoke", "--reporter=list"]
    : ["playwright", "test", "--reporter=list"];

  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    env: process.env,
  });

  process.exit(result.status ?? 1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
