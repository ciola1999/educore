import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { createAuthDbClient } from "@/lib/auth/web/db";
import {
  buildLoginEmailCandidates,
  normalizeLoginIdentifier,
} from "@/lib/auth/web/login-identifier";

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

type BrowserCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Lax" | "None" | "Strict";
};

function hasNextAuthSessionCookie(cookies: BrowserCookie[]) {
  return cookies.some((cookie) =>
    cookie.name.includes("next-auth.session-token"),
  );
}

function splitSetCookieHeader(raw: string | null): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(/,(?=[^;]+=[^;]+)/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseSetCookieForBrowser(
  raw: string | null,
  baseUrl: string,
): BrowserCookie[] {
  const origin = new URL(baseUrl);
  const nowSeconds = Math.floor(Date.now() / 1000);

  return splitSetCookieHeader(raw)
    .map((entry) => {
      const parts = entry.split(";").map((part) => part.trim());
      const [nameValue, ...attributes] = parts;
      const separatorIndex = nameValue.indexOf("=");
      if (separatorIndex <= 0) {
        return null;
      }

      const cookie: BrowserCookie = {
        name: nameValue.slice(0, separatorIndex),
        value: nameValue.slice(separatorIndex + 1),
        domain: origin.hostname,
        path: "/",
      };

      for (const attribute of attributes) {
        const [rawKey, ...rawValueParts] = attribute.split("=");
        const key = rawKey.toLowerCase();
        const value = rawValueParts.join("=");

        if (key === "path" && value) {
          cookie.path = value;
          continue;
        }

        if (key === "domain" && value) {
          cookie.domain = value.replace(/^\./, "");
          continue;
        }

        if (key === "max-age") {
          const parsed = Number(value);
          if (Number.isFinite(parsed)) {
            cookie.expires = nowSeconds + parsed;
          }
          continue;
        }

        if (key === "expires") {
          const parsed = Date.parse(value);
          if (Number.isFinite(parsed)) {
            cookie.expires = Math.floor(parsed / 1000);
          }
          continue;
        }

        if (key === "httponly") {
          cookie.httpOnly = true;
          continue;
        }

        if (key === "secure") {
          cookie.secure = true;
          continue;
        }

        if (key === "samesite") {
          if (value === "Lax" || value === "None" || value === "Strict") {
            cookie.sameSite = value;
          }
        }
      }

      return cookie;
    })
    .filter((cookie): cookie is BrowserCookie => Boolean(cookie));
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
}): Promise<{ browserCookies: BrowserCookie[] }> {
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
  const redirectPathname = (() => {
    if (!location) {
      return "";
    }
    try {
      return new URL(location, baseUrl).pathname;
    } catch {
      return location;
    }
  })();
  const browserCookies = parseSetCookieForBrowser(
    response.headers.get("set-cookie"),
    baseUrl,
  );
  const hasSessionCookie = hasNextAuthSessionCookie(browserCookies);

  if (
    response.status !== 302 ||
    (!redirectPathname.startsWith("/dashboard") && !hasSessionCookie) ||
    browserCookies.length === 0
  ) {
    throw new Error(
      [
        `[E2E STRICT] Invalid credentials for ${label}.`,
        `- identifier: ${identifier}`,
        `- status: ${response.status}`,
        `- location: ${location || "<none>"}`,
        `- redirectPathname: ${redirectPathname || "<none>"}`,
        `- cookies: ${browserCookies.length}`,
        `- hasSessionCookie: ${hasSessionCookie}`,
        "- hint: set E2E_* env ke kredensial web yang benar bila auth lokal Anda tidak memakai default admin123.",
      ].join("\n"),
    );
  }

  return {
    browserCookies,
  };
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForServerReachable(
  baseUrl: string,
  timeoutMs: number,
): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      await assertServerReachable(baseUrl);
      return true;
    } catch {
      await delay(1_500);
    }
  }

  return false;
}

async function resolveAvailableLocalBaseUrl(preferredPort = 3100) {
  const tryBind = (port: number) =>
    new Promise<string>((resolve, reject) => {
      const server = createServer();
      server.unref();
      server.once("error", reject);
      server.listen(port, () => {
        const address = server.address();
        const resolvedPort =
          typeof address === "object" && address ? address.port : port;
        server.close((closeError) => {
          if (closeError) {
            reject(closeError);
            return;
          }
          resolve(`http://127.0.0.1:${resolvedPort}`);
        });
      });
    });

  try {
    return await tryBind(preferredPort);
  } catch {
    return await tryBind(0);
  }
}

function startManagedLocalServer(baseUrl: string): ChildProcess {
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  const origin = new URL(baseUrl);
  const port = origin.port || "3000";
  const child = spawn(command, ["next", "start", "-p", port], {
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: port,
    },
  });

  const shutdown = () => {
    if (!child.killed) {
      child.kill();
    }
  };

  process.once("exit", shutdown);
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  return child;
}

async function clearE2EAuthRateLimits(identifiers: string[]) {
  const normalizedIdentifiers = identifiers
    .map((value) => normalizeLoginIdentifier(value))
    .filter(Boolean);
  if (normalizedIdentifiers.length === 0) {
    return;
  }

  const emailKeys = new Set<string>();
  for (const identifier of normalizedIdentifiers) {
    emailKeys.add(identifier);
    for (const candidate of buildLoginEmailCandidates(identifier)) {
      emailKeys.add(candidate);
    }
  }

  const client = createAuthDbClient();
  for (const key of emailKeys) {
    await client.execute({
      sql: "DELETE FROM auth_rate_limits WHERE scope = ? AND key = ?",
      args: ["login:email", key],
    });
  }

  for (const key of ["::1", "127.0.0.1", "localhost", "unknown"]) {
    await client.execute({
      sql: "DELETE FROM auth_rate_limits WHERE scope = ? AND key = ?",
      args: ["login:ip", key],
    });
  }
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
  const expectedIsLoopback = loopbackHosts.has(expected.hostname);
  const actualIsLoopback = loopbackHosts.has(actual.hostname);
  const sameHost =
    expected.hostname === actual.hostname ||
    (expectedIsLoopback && actualIsLoopback);
  const sameProtocol = expected.protocol === actual.protocol;

  if (!(sameHost && samePort && sameProtocol)) {
    if (expectedIsLoopback && !actualIsLoopback) {
      console.warn(
        [
          "[E2E STRICT] Auth origin mismatch tolerated for local loopback runtime.",
          `- PLAYWRIGHT_BASE_URL: ${expected.origin}`,
          `- credentials.signinUrl: ${actual.origin}`,
          "Reason: local dev may intentionally fall back to request host while AUTH_URL/NEXTAUTH_URL remain non-local.",
        ].join("\n"),
      );
      return;
    }

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
  const baseUrl = explicitBaseUrl || (await resolveAvailableLocalBaseUrl(3100));
  let managedServer: ChildProcess | null = null;

  try {
    await assertServerReachable(baseUrl);
  } catch (error) {
    if (explicitBaseUrl) {
      throw error;
    }

    managedServer = startManagedLocalServer(baseUrl);
    const reachable = await waitForServerReachable(baseUrl, 180_000);
    if (!reachable) {
      throw new Error(
        [
          "[E2E STRICT] Managed local server gagal siap tepat waktu.",
          `- PLAYWRIGHT_BASE_URL: ${baseUrl}`,
          "Pastikan tidak ada proses lain yang memegang port yang sama.",
        ].join("\n"),
      );
    }
  }

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

  await clearE2EAuthRateLimits(
    credentialSet.map((credential) => credential.identifier),
  );

  const seenKey = new Set<string>();
  let e2eSessionCookies: BrowserCookie[] = [];
  for (const credential of credentialSet) {
    const uniqueKey = `${credential.identifier}::${credential.password}`;
    if (seenKey.has(uniqueKey)) {
      continue;
    }
    seenKey.add(uniqueKey);
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const verified = await verifyCredentials({
          baseUrl,
          identifier: credential.identifier,
          password: credential.password,
          label: credential.label,
        });
        if (
          e2eSessionCookies.length === 0 &&
          verified.browserCookies.length > 0
        ) {
          e2eSessionCookies = verified.browserCookies;
        }
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
    env: {
      ...process.env,
      PLAYWRIGHT_BASE_URL: baseUrl,
      E2E_SESSION_COOKIES_JSON: JSON.stringify(e2eSessionCookies),
    },
  });

  if (managedServer && !managedServer.killed) {
    managedServer.kill();
  }

  process.exit(result.status ?? 1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
