import { describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const requirePermissionMock = vi.hoisted(() => vi.fn());
const getTodayAttendanceRecordsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/web/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/api/authz", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/core/services/attendance-service", () => ({
  getTodayAttendanceRecords: getTodayAttendanceRecordsMock,
}));

import { GET } from "./route";

describe("GET /api/attendance/today", () => {
  it("returns all today logs for non-student roles", async () => {
    authMock.mockResolvedValue({
      user: { id: "teacher-1", role: "teacher" },
    });
    requirePermissionMock.mockReturnValue(null);
    getTodayAttendanceRecordsMock.mockResolvedValue([
      {
        id: "log-1",
        studentId: "student-1",
        snapshotStudentName: "Aditya",
      },
      {
        id: "log-2",
        studentId: "student-2",
        snapshotStudentName: "Budi",
      },
    ]);

    const response = await GET();
    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      success: boolean;
      data: Array<{ studentId: string }>;
    };

    expect(payload.success).toBe(true);
    expect(payload.data).toHaveLength(2);
    expect(payload.data.map((item) => item.studentId)).toEqual([
      "student-1",
      "student-2",
    ]);
  });

  it("filters today logs to the logged-in student for student role", async () => {
    authMock.mockResolvedValue({
      user: { id: "student-1", role: "student" },
    });
    requirePermissionMock.mockReturnValue(null);
    getTodayAttendanceRecordsMock.mockResolvedValue([
      {
        id: "log-1",
        studentId: "student-1",
        snapshotStudentName: "Aditya",
      },
      {
        id: "log-2",
        studentId: "student-2",
        snapshotStudentName: "Budi",
      },
    ]);

    const response = await GET();
    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      success: boolean;
      data: Array<{ studentId: string }>;
    };

    expect(payload.success).toBe(true);
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]?.studentId).toBe("student-1");
  });
});
