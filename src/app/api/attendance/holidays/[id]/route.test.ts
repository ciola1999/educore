import { describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const requirePermissionMock = vi.hoisted(() => vi.fn());
const deleteHolidayMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/web/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/api/authz", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/core/services/attendance-service", () => ({
  deleteHoliday: deleteHolidayMock,
}));

import { DELETE } from "./route";

describe("DELETE /api/attendance/holidays/[id]", () => {
  it("rejects empty holiday id", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", role: "admin" },
    });
    requirePermissionMock.mockReturnValue(null);

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "" }),
    });

    expect(response.status).toBe(400);
    expect(deleteHolidayMock).not.toHaveBeenCalled();
  });

  it("returns structured error when holiday delete fails", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", role: "admin" },
    });
    requirePermissionMock.mockReturnValue(null);
    deleteHolidayMock.mockRejectedValue(new Error("Delete holiday failed"));

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "holiday-1" }),
    });

    expect(response.status).toBe(500);
    const payload = (await response.json()) as {
      success: boolean;
      code?: string;
      error?: string;
    };
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("ATTENDANCE_HOLIDAY_DELETE_FAILED");
    expect(payload.error).toBe("Delete holiday failed");
  });
});
