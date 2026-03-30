import { describe, expect, it } from "vitest";
import { resolveAuthDatabaseToken } from "./db";

function createEnv(
  values: Record<string, string>,
): NodeJS.ProcessEnv & { NODE_ENV: string } {
  return {
    NODE_ENV: "test",
    ...values,
  };
}

describe("resolveAuthDatabaseToken", () => {
  it("prefers AUTH_DATABASE_AUTH_TOKEN when present", () => {
    expect(
      resolveAuthDatabaseToken(
        createEnv({
          AUTH_DATABASE_AUTH_TOKEN: "auth-token",
          TURSO_AUTH_TOKEN: "turso-token",
          TURSO_DATABASE_TURSO_AUTH_TOKEN: "managed-token",
        }),
      ),
    ).toBe("auth-token");
  });

  it("falls back to managed Turso integration token name", () => {
    expect(
      resolveAuthDatabaseToken(
        createEnv({
          TURSO_DATABASE_TURSO_AUTH_TOKEN: "managed-token",
        }),
      ),
    ).toBe("managed-token");
  });
});
