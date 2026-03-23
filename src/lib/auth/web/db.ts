import { createClient } from "@libsql/client";

const LIBSQL_SCHEMES = ["libsql:", "https:", "http:", "ws:", "wss:", "file:"];

function isSupportedLibsqlUrl(url: string): boolean {
  try {
    const normalized = url.startsWith("libsql://")
      ? url.replace("libsql://", "https://")
      : url;
    const parsed = new URL(normalized);
    return LIBSQL_SCHEMES.includes(parsed.protocol);
  } catch {
    return false;
  }
}

function resolveAuthDatabaseUrl(): string {
  const candidates = [
    process.env.AUTH_DATABASE_URL,
    process.env.TURSO_DATABASE_URL,
  ].filter((value): value is string => Boolean(value));

  const url = candidates.find((value) => isSupportedLibsqlUrl(value));

  if (!url) {
    throw new Error(
      "Auth database URL is not configured for libSQL/Turso. Set AUTH_DATABASE_URL or TURSO_DATABASE_URL to a libsql/https URL. Do not use Vercel Postgres DATABASE_URL here.",
    );
  }

  return url.startsWith("libsql://")
    ? url.replace("libsql://", "https://")
    : url;
}

function resolveAuthDatabaseToken(): string | undefined {
  return process.env.AUTH_DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;
}

export function createAuthDbClient() {
  return createClient({
    url: resolveAuthDatabaseUrl(),
    authToken: resolveAuthDatabaseToken(),
  });
}
