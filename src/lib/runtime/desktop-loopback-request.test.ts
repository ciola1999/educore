import { describe, expect, it } from "vitest";
import {
  DESKTOP_LOOPBACK_ENV_TOKEN,
  DESKTOP_LOOPBACK_QUERY_TOKEN,
  DESKTOP_LOOPBACK_RUNTIME_COOKIE,
  DESKTOP_LOOPBACK_SESSION_COOKIE,
  hasDesktopLoopbackSessionToken,
  isDesktopLoopbackRequest,
  isLoopbackHostname,
} from "@/lib/runtime/desktop-loopback-request";

describe("isLoopbackHostname", () => {
  it("accepts localhost loopback hosts", () => {
    expect(isLoopbackHostname("127.0.0.1:3210")).toBe(true);
    expect(isLoopbackHostname("localhost:3210")).toBe(true);
    expect(isLoopbackHostname("LOCALHOST")).toBe(true);
  });

  it("rejects non-loopback hosts", () => {
    expect(isLoopbackHostname("educore-jr.vercel.app")).toBe(false);
    expect(isLoopbackHostname("192.168.1.10:3210")).toBe(false);
    expect(isLoopbackHostname("")).toBe(false);
  });
});

describe("isDesktopLoopbackRequest", () => {
  it("accepts tauri loopback requests", () => {
    expect(
      isDesktopLoopbackRequest({
        hostHeader: "127.0.0.1:3210",
        userAgent: "Mozilla/5.0 Tauri/2.0",
      }),
    ).toBe(true);
  });

  it("rejects local browser requests without tauri user-agent", () => {
    expect(
      isDesktopLoopbackRequest({
        hostHeader: "127.0.0.1:3210",
        userAgent: "Mozilla/5.0 Chrome/136.0",
      }),
    ).toBe(false);
  });

  it("rejects tauri user-agent on non-loopback hosts", () => {
    expect(
      isDesktopLoopbackRequest({
        hostHeader: "educore-jr.vercel.app",
        userAgent: "Mozilla/5.0 Tauri/2.0",
      }),
    ).toBe(false);
  });
});

describe("desktop loopback session token contract", () => {
  it("keeps token names stable", () => {
    expect(DESKTOP_LOOPBACK_SESSION_COOKIE).toBe("educore.desktop.loopback");
    expect(DESKTOP_LOOPBACK_RUNTIME_COOKIE).toBe("educore.desktop.runtime");
    expect(DESKTOP_LOOPBACK_QUERY_TOKEN).toBe("educore_desktop_token");
    expect(DESKTOP_LOOPBACK_ENV_TOKEN).toBe("EDUCORE_DESKTOP_LOOPBACK_TOKEN");
  });

  it("accepts matching cookie token", () => {
    expect(
      hasDesktopLoopbackSessionToken({
        cookieValue: "desktop-secret",
        expectedToken: "desktop-secret",
      }),
    ).toBe(true);
  });

  it("accepts matching query token", () => {
    expect(
      hasDesktopLoopbackSessionToken({
        queryValue: "desktop-secret",
        expectedToken: "desktop-secret",
      }),
    ).toBe(true);
  });

  it("rejects mismatched or empty tokens", () => {
    expect(
      hasDesktopLoopbackSessionToken({
        cookieValue: "wrong",
        expectedToken: "desktop-secret",
      }),
    ).toBe(false);
    expect(
      hasDesktopLoopbackSessionToken({
        cookieValue: "desktop-secret",
        expectedToken: "",
      }),
    ).toBe(false);
  });
});
