import { beforeEach, describe, expect, it, vi } from "vitest";

const isTauriMock = vi.hoisted(() => vi.fn());
const handleDesktopLocalApiRequestMock = vi.hoisted(() => vi.fn());

vi.mock("@/core/env", () => ({
  isTauri: isTauriMock,
}));

vi.mock("@/lib/runtime/desktop-local-api", () => ({
  handleDesktopLocalApiRequest: handleDesktopLocalApiRequestMock,
}));

import { apiGet, isDesktopLocalOnlyApiRoute } from "./request";

describe("api request desktop boundary", () => {
  const desktopCoreRoutes = [
    "/api/academic-years",
    "/api/attendance/history",
    "/api/auth/login",
    "/api/auth/logout",
    "/api/classes",
    "/api/dashboard",
    "/api/schedules",
    "/api/semesters",
    "/api/students",
    "/api/subjects",
    "/api/sync/full",
    "/api/teachers",
    "/api/teaching-assignments",
  ] as const;

  beforeEach(() => {
    vi.clearAllMocks();
    isTauriMock.mockReturnValue(true);
  });

  it("recognizes desktop-local-only API prefixes for core local-first routes", () => {
    for (const route of desktopCoreRoutes) {
      expect(isDesktopLocalOnlyApiRoute(route)).toBe(true);
    }
    expect(isDesktopLocalOnlyApiRoute("/api/students?includeStats=1")).toBe(
      true,
    );
    expect(isDesktopLocalOnlyApiRoute("/api/telemetry/settings-auth")).toBe(
      false,
    );
  });

  it.each(desktopCoreRoutes)(
    "fails secure when desktop-local-only route %s has no local handler",
    async (route) => {
      handleDesktopLocalApiRequestMock.mockResolvedValue(null);

      await expect(apiGet(route)).rejects.toThrow(
        "Runtime desktop tidak menemukan handler API lokal",
      );
    },
  );

  it("keeps failing secure for nested desktop-local-only route variants", async () => {
    handleDesktopLocalApiRequestMock.mockResolvedValue(null);

    await expect(apiGet("/api/students/classes/repair")).rejects.toThrow(
      "Runtime desktop tidak menemukan handler API lokal",
    );
  });

  it("allows non-core routes to fall back when no desktop local handler exists", async () => {
    handleDesktopLocalApiRequestMock.mockResolvedValue(null);

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { ok: true } }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    await expect(
      apiGet<{ ok: boolean }>("/api/telemetry/settings-auth"),
    ).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockRestore();
  });
});
