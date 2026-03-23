import { describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const requirePermissionMock = vi.hoisted(() => vi.fn());
const recordBulkAttendanceMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/web/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/api/authz", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/core/services/attendance-service", () => ({
  recordBulkAttendance: recordBulkAttendanceMock,
}));

import { POST } from "./route";

describe("POST /api/attendance/bulk", () => {
  it("rejects classId=all for manual bulk submit", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", role: "teacher" },
    });
    requirePermissionMock.mockReturnValue(null);

    const response = await POST(
      new Request("http://localhost/api/attendance/bulk", {
        method: "POST",
        body: JSON.stringify({
          classId: "all",
          date: "2026-03-19",
          records: [
            {
              studentId: "student-1",
              status: "present",
              notes: "",
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(400);
    const payload = (await response.json()) as {
      success: boolean;
      code?: string;
      error?: string;
    };
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("INVALID_CLASS_SCOPE");
    expect(recordBulkAttendanceMock).not.toHaveBeenCalled();
  });
});
