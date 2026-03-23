import { createClient } from "@libsql/client";

function resolveAuthDatabaseUrl(): string {
  const url = process.env.AUTH_DATABASE_URL || process.env.TURSO_DATABASE_URL;

  if (!url) {
    throw new Error(
      "Auth database URL is not configured. Set AUTH_DATABASE_URL or TURSO_DATABASE_URL.",
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
