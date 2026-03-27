import { describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const requirePermissionMock = vi.hoisted(() => vi.fn());
const getAttendanceSettingsMock = vi.hoisted(() => vi.fn());
const upsertAttendanceSettingMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/web/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/api/authz", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/core/services/attendance-service", () => ({
  getAttendanceSettings: getAttendanceSettingsMock,
  upsertAttendanceSetting: upsertAttendanceSettingMock,
}));

import { GET } from "./route";

describe("GET /api/attendance/settings", () => {
  it("returns settings for authorized reader", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", role: "admin" },
    });
    requirePermissionMock.mockReturnValue(null);
    getAttendanceSettingsMock.mockResolvedValue([
      { id: "setting-1", dayOfWeek: 1 },
    ]);

    const response = await GET();

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      success: boolean;
      data?: Array<{ id: string }>;
    };
    expect(payload.success).toBe(true);
    expect(payload.data?.[0]?.id).toBe("setting-1");
  });

  it("returns structured error when settings load fails", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", role: "admin" },
    });
    requirePermissionMock.mockReturnValue(null);
    getAttendanceSettingsMock.mockRejectedValue(
      new Error("Settings backend unavailable"),
    );

    const response = await GET();

    expect(response.status).toBe(500);
    const payload = (await response.json()) as {
      success: boolean;
      code?: string;
      error?: string;
    };
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("ATTENDANCE_SETTINGS_LOAD_FAILED");
    expect(payload.error).toBe("Settings backend unavailable");
  });
});
