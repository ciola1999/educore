import { describe, expect, it, vi } from "vitest";
import { handleDesktopAttendanceRoute } from "./desktop-attendance-route";

describe("desktop attendance route", () => {
  it("delegates attendance request to the local attendance handler", async () => {
    const handleAttendance = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      );
    const url = new URL(
      "http://desktop.local/api/attendance/history?startDate=2026-03-01&endDate=2026-03-30",
    );
    const pathSegments = ["api", "attendance", "history"];
    const payload = {
      source: "manual",
    };

    const response = await handleDesktopAttendanceRoute(
      url,
      "GET",
      pathSegments,
      payload,
      {
        handleAttendance,
      },
    );

    expect(handleAttendance).toHaveBeenCalledWith(
      url,
      "GET",
      pathSegments,
      payload,
    );
    expect(response?.status).toBe(200);
  });

  it("delegates nested risk insights requests with full path segments", async () => {
    const handleAttendance = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      );
    const url = new URL(
      "http://desktop.local/api/attendance/risk-insights?includeStudents=false&className=XII-A",
    );
    const pathSegments = ["api", "attendance", "risk-insights"];

    const response = await handleDesktopAttendanceRoute(
      url,
      "GET",
      pathSegments,
      null,
      {
        handleAttendance,
      },
    );

    expect(handleAttendance).toHaveBeenCalledWith(
      url,
      "GET",
      pathSegments,
      null,
    );
    expect(response?.status).toBe(200);
  });

  it("delegates risk follow-up patch requests with nested identifiers", async () => {
    const handleAttendance = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      );
    const url = new URL(
      "http://desktop.local/api/attendance/risk-followups/fu_123",
    );
    const pathSegments = ["api", "attendance", "risk-followups", "fu_123"];
    const payload = {
      note: "Perlu ditindaklanjuti",
      markDone: true,
    };

    const response = await handleDesktopAttendanceRoute(
      url,
      "PATCH",
      pathSegments,
      payload,
      {
        handleAttendance,
      },
    );

    expect(handleAttendance).toHaveBeenCalledWith(
      url,
      "PATCH",
      pathSegments,
      payload,
    );
    expect(response?.status).toBe(200);
  });

  it("delegates risk follow-up audit trail requests", async () => {
    const handleAttendance = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      );
    const url = new URL(
      "http://desktop.local/api/attendance/risk-followups/fu_123/history",
    );
    const pathSegments = [
      "api",
      "attendance",
      "risk-followups",
      "fu_123",
      "history",
    ];

    const response = await handleDesktopAttendanceRoute(
      url,
      "GET",
      pathSegments,
      null,
      {
        handleAttendance,
      },
    );

    expect(handleAttendance).toHaveBeenCalledWith(
      url,
      "GET",
      pathSegments,
      null,
    );
    expect(response?.status).toBe(200);
  });

  it("returns null for non-attendance paths", async () => {
    const handleAttendance = vi.fn();
    const url = new URL("http://desktop.local/api/students");
    const pathSegments = ["api", "students"];

    const response = await handleDesktopAttendanceRoute(
      url,
      "GET",
      pathSegments,
      null,
      {
        handleAttendance,
      },
    );

    expect(handleAttendance).not.toHaveBeenCalled();
    expect(response).toBeNull();
  });

  it("returns a 404 when the attendance handler yields no response", async () => {
    const handleAttendance = vi.fn().mockResolvedValue(null);
    const url = new URL("http://desktop.local/api/attendance/unknown");
    const pathSegments = ["api", "attendance", "unknown"];

    const response = await handleDesktopAttendanceRoute(
      url,
      "GET",
      pathSegments,
      null,
      {
        handleAttendance,
      },
    );

    expect(response?.status).toBe(404);
    await expect(response?.json()).resolves.toMatchObject({
      error: "Route attendance desktop tidak ditemukan",
      code: "NOT_FOUND",
    });
  });
});
