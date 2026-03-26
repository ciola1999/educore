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
  it("rejects request when session user id is missing", async () => {
    authMock.mockResolvedValue({
      user: { role: "teacher" },
    });
    requirePermissionMock.mockReturnValue(null);

    const response = await POST(
      new Request("http://localhost/api/attendance/bulk", {
        method: "POST",
        body: JSON.stringify({
          classId: "class-xa",
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

    expect(response.status).toBe(401);
    const payload = (await response.json()) as {
      success: boolean;
      error?: string;
    };
    expect(payload.success).toBe(false);
    expect(recordBulkAttendanceMock).not.toHaveBeenCalled();
  });

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

  it("returns partial success payload when some attendance rows fail", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", role: "teacher" },
    });
    requirePermissionMock.mockReturnValue(null);
    recordBulkAttendanceMock.mockResolvedValue({
      success: true,
      partial: true,
      message: "Absensi tersimpan untuk 20 siswa, 2 siswa gagal diproses",
      successCount: 20,
      failedCount: 2,
      totalRecords: 22,
      failures: [
        {
          studentId: "student-2",
          message: "Gagal menyimpan absensi siswa ini",
        },
      ],
    });

    const response = await POST(
      new Request("http://localhost/api/attendance/bulk", {
        method: "POST",
        body: JSON.stringify({
          classId: "550e8400-e29b-41d4-a716-446655440000",
          date: "2026-03-19",
          records: [
            {
              studentId: "550e8400-e29b-41d4-a716-446655440001",
              status: "present",
              notes: "",
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      success: boolean;
      data?: {
        partial?: boolean;
        successCount?: number;
        failedCount?: number;
      };
    };
    expect(payload.success).toBe(true);
    expect(payload.data?.partial).toBe(true);
    expect(payload.data?.successCount).toBe(20);
    expect(payload.data?.failedCount).toBe(2);
  });
});
