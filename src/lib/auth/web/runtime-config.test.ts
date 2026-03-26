import { describe, expect, it, vi } from "vitest";
import {
  isLocalOrigin,
  resolveAuthRuntimeConfig,
} from "@/lib/auth/web/runtime-config";

describe("auth runtime config", () => {
  it("accepts loopback origins as local", () => {
    expect(isLocalOrigin("http://localhost:3000")).toBe(true);
    expect(isLocalOrigin("http://127.0.0.1:3000")).toBe(true);
    expect(isLocalOrigin("https://educore-jr.vercel.app")).toBe(false);
  });

  it("falls back to request host for non-local dev auth urls", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const config = resolveAuthRuntimeConfig({
      NODE_ENV: "development",
      AUTH_URL: "https://educore-jr.vercel.app",
      NEXTAUTH_URL: "https://educore-jr.vercel.app",
    });

    expect(config.trustHost).toBe(true);
    expect(config.cookieSameSite).toBe("lax");
    expect(config.authSecret).toBe("educore-dev-auth-secret");
    expect(warnSpy).toHaveBeenCalledOnce();

    warnSpy.mockRestore();
  });

  it("rejects mismatched auth origins", () => {
    expect(() =>
      resolveAuthRuntimeConfig({
        NODE_ENV: "production",
        AUTH_SECRET: "secret",
        AUTH_URL: "https://a.example.com",
        NEXTAUTH_URL: "https://b.example.com",
      }),
    ).toThrow(/harus memakai origin yang sama/i);
  });

  it("requires secret in production", () => {
    expect(() =>
      resolveAuthRuntimeConfig({
        NODE_ENV: "production",
      }),
    ).toThrow(/wajib di production/i);
  });

  it("respects production trust host and secret", () => {
    const config = resolveAuthRuntimeConfig({
      NODE_ENV: "production",
      AUTH_SECRET: "secret",
      AUTH_TRUST_HOST: "true",
      AUTH_URL: "https://educore.example.com",
      NEXTAUTH_URL: "https://educore.example.com",
    });

    expect(config.trustHost).toBe(true);
    expect(config.cookieSameSite).toBe("strict");
    expect(config.authSecret).toBe("secret");
  });
});
