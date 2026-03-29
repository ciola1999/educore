import { describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const syncUsersToStudentsProjectionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/web/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/api/authz", () => ({
  requireAnyPermission: requireAnyPermissionMock,
}));

vi.mock("@/lib/services/student-projection", () => ({
  syncUsersToStudentsProjection: syncUsersToStudentsProjectionMock,
}));

import { POST } from "./route";

describe("POST /api/attendance/projection-sync", () => {
  it("returns sync result for authorized caller", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", role: "admin" },
    });
    requireAnyPermissionMock.mockReturnValue(null);
    syncUsersToStudentsProjectionMock.mockResolvedValue({
      classCreated: 1,
      studentUpserted: 12,
      settingsSeeded: 5,
    });

    const response = await POST();

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      success: boolean;
      data?: { studentUpserted?: number };
    };
    expect(payload.success).toBe(true);
    expect(payload.data?.studentUpserted).toBe(12);
    expect(requireAnyPermissionMock).toHaveBeenCalledWith(
      { user: { id: "user-1", role: "admin" } },
      [
        "attendance:read",
        "attendance:write",
        "academic:read",
        "academic:write",
      ],
    );
  });

  it("returns structured error when projection sync throws", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", role: "admin" },
    });
    requireAnyPermissionMock.mockReturnValue(null);
    syncUsersToStudentsProjectionMock.mockRejectedValue(
      new Error("Projection sync unavailable"),
    );

    const response = await POST();

    expect(response.status).toBe(500);
    const payload = (await response.json()) as {
      success: boolean;
      code?: string;
      error?: string;
    };
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("ATTENDANCE_PROJECTION_SYNC_FAILED");
    expect(payload.error).toBe("Projection sync unavailable");
  });
});
