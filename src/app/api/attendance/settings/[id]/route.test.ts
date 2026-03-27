import { describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const requirePermissionMock = vi.hoisted(() => vi.fn());
const deleteAttendanceSettingMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/web/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/api/authz", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/core/services/attendance-service", () => ({
  deleteAttendanceSetting: deleteAttendanceSettingMock,
}));

import { DELETE } from "./route";

describe("DELETE /api/attendance/settings/[id]", () => {
  it("rejects empty id", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", role: "admin" },
    });
    requirePermissionMock.mockReturnValue(null);

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "" }),
    });

    expect(response.status).toBe(400);
    expect(deleteAttendanceSettingMock).not.toHaveBeenCalled();
  });

  it("returns structured error when delete fails", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", role: "admin" },
    });
    requirePermissionMock.mockReturnValue(null);
    deleteAttendanceSettingMock.mockRejectedValue(
      new Error("Delete setting failed"),
    );

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "setting-1" }),
    });

    expect(response.status).toBe(500);
    const payload = (await response.json()) as {
      success: boolean;
      code?: string;
      error?: string;
    };
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("ATTENDANCE_SETTINGS_DELETE_FAILED");
    expect(payload.error).toBe("Delete setting failed");
  });
});
