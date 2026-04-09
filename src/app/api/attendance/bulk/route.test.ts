import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const requirePermissionMock = vi.hoisted(() => vi.fn());
const recordBulkAttendanceMock = vi.hoisted(() => vi.fn());
const getDbMock = vi.hoisted(() => vi.fn());
const resolveAttendanceAccessScopeMock = vi.hoisted(() => vi.fn());
const canAccessAttendanceClassMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/web/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/api/authz", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/core/services/attendance-service", () => ({
  recordBulkAttendance: recordBulkAttendanceMock,
}));

vi.mock("@/lib/db", () => ({
  getDb: getDbMock,
}));

vi.mock("@/lib/auth/attendance-access", () => ({
  resolveAttendanceAccessScope: resolveAttendanceAccessScopeMock,
  canAccessAttendanceClass: canAccessAttendanceClassMock,
}));

import { POST } from "./route";

describe("POST /api/attendance/bulk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDbMock.mockResolvedValue({});
    resolveAttendanceAccessScopeMock.mockResolvedValue({
      userId: "teacher-1",
      role: "teacher",
      hasRosterAccess: true,
      hasGlobalClassAccess: false,
      classIds: ["550e8400-e29b-41d4-a716-446655440000"],
    });
    canAccessAttendanceClassMock.mockReturnValue(true);
  });

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

  it("rejects malformed json body with deterministic 400 response", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", role: "teacher" },
    });
    requirePermissionMock.mockReturnValue(null);

    const response = await POST(
      new Request("http://localhost/api/attendance/bulk", {
        method: "POST",
        body: "{invalid-json",
      }),
    );

    expect(response.status).toBe(400);
    const payload = (await response.json()) as {
      success: boolean;
      code?: string;
    };
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("INVALID_JSON");
    expect(recordBulkAttendanceMock).not.toHaveBeenCalled();
  });

  it("rejects oversized bulk payload before service execution", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", role: "teacher" },
    });
    requirePermissionMock.mockReturnValue(null);

    const response = await POST(
      new Request("http://localhost/api/attendance/bulk", {
        method: "POST",
        body: JSON.stringify({
          classId: "550e8400-e29b-41d4-a716-446655440000",
          date: "2026-03-19",
          records: Array.from({ length: 501 }, (_, index) => ({
            studentId: `550e8400-e29b-41d4-a716-44665544${String(index)
              .padStart(4, "0")
              .slice(-4)}`,
            status: "present",
            notes: "",
          })),
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
    expect(payload.code).toBe("VALIDATION_ERROR");
    expect(payload.error).toBe("Maksimal 500 record attendance per request");
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

  it("always uses recordedBy from the authenticated session instead of request body spoofing", async () => {
    authMock.mockResolvedValue({
      user: { id: "teacher-session-1", role: "teacher" },
    });
    requirePermissionMock.mockReturnValue(null);
    recordBulkAttendanceMock.mockResolvedValue({
      success: true,
      partial: false,
      message: "Absensi tersimpan",
      successCount: 1,
      failedCount: 0,
      totalRecords: 1,
      failures: [],
    });

    const response = await POST(
      new Request("http://localhost/api/attendance/bulk", {
        method: "POST",
        body: JSON.stringify({
          classId: "550e8400-e29b-41d4-a716-446655440000",
          date: "2026-03-19",
          recordedBy: "spoofed-user-id",
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
    expect(recordBulkAttendanceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        recordedBy: "teacher-session-1",
      }),
    );
    expect(recordBulkAttendanceMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        recordedBy: "spoofed-user-id",
      }),
    );
  });
});
