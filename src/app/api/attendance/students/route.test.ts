import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const requirePermissionMock = vi.hoisted(() => vi.fn());
const getDbMock = vi.hoisted(() => vi.fn());
const resolveAttendanceAccessScopeMock = vi.hoisted(() => vi.fn());
const canAccessAttendanceClassMock = vi.hoisted(() => vi.fn());
const getAttendanceRosterStudentsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/web/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/api/authz", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/lib/db", () => ({
  getDb: getDbMock,
}));

vi.mock("@/lib/auth/attendance-access", () => ({
  resolveAttendanceAccessScope: resolveAttendanceAccessScopeMock,
  canAccessAttendanceClass: canAccessAttendanceClassMock,
}));

vi.mock("@/core/services/attendance-service", () => ({
  getAttendanceRosterStudents: getAttendanceRosterStudentsMock,
}));

import { GET } from "./route";

describe("GET /api/attendance/students", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: "teacher-1", role: "teacher" },
    });
    requirePermissionMock.mockReturnValue(null);
    resolveAttendanceAccessScopeMock.mockResolvedValue({
      userId: "teacher-1",
      role: "teacher",
      hasRosterAccess: true,
      hasGlobalClassAccess: false,
      classIds: ["class-a"],
    });
    canAccessAttendanceClassMock.mockReturnValue(true);
    getAttendanceRosterStudentsMock.mockResolvedValue({
      className: "XII TSM 1",
      students: [
        {
          id: "student-1",
          nis: "212207001",
          nisn: null,
          fullName: "Abdullah",
          grade: "XII TSM 1",
          tempatLahir: null,
          tanggalLahir: null,
          alamat: null,
          parentName: "Ayah Abdullah",
          parentPhone: "08123456789",
        },
        {
          id: "student-2",
          nis: "212207002",
          nisn: null,
          fullName: "Budi",
          grade: "XII TSM 1",
          tempatLahir: null,
          tanggalLahir: null,
          alamat: null,
          parentName: "Ayah Budi",
          parentPhone: "08123456780",
        },
      ],
    });
  });

  it("rejects requests without classId or date", async () => {
    const response = await GET(
      new Request("http://localhost/api/attendance/students?classId=class-a"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "classId dan date wajib diisi",
    });
  });

  it("returns forbidden when the session user has no attendance roster scope", async () => {
    resolveAttendanceAccessScopeMock.mockResolvedValue(null);

    const response = await GET(
      new Request(
        "http://localhost/api/attendance/students?classId=class-a&date=2026-04-08",
      ),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(getAttendanceRosterStudentsMock).not.toHaveBeenCalled();
  });

  it("rejects classes outside the authorized attendance scope", async () => {
    canAccessAttendanceClassMock.mockReturnValue(false);

    const response = await GET(
      new Request(
        "http://localhost/api/attendance/students?classId=class-b&date=2026-04-08",
      ),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "ATTENDANCE_CLASS_FORBIDDEN",
    });
    expect(getAttendanceRosterStudentsMock).not.toHaveBeenCalled();
  });

  it("returns roster students merged with locked QR and manual attendance state", async () => {
    const dailyLogs = [
      {
        studentId: "student-1",
        checkInTime: new Date("2026-04-08T07:05:00.000Z"),
        checkOutTime: null,
      },
    ];
    const manualAttendanceRows = [
      {
        studentId: "student-2",
        status: "permission",
        notes: "Izin keluarga",
        updatedAt: new Date("2026-04-08T06:00:00.000Z"),
        createdAt: new Date("2026-04-08T06:00:00.000Z"),
      },
    ];

    const dailyWhereMock = vi.fn().mockResolvedValue(dailyLogs);
    const manualOrderByMock = vi.fn().mockResolvedValue(manualAttendanceRows);
    const manualWhereMock = vi.fn().mockReturnValue({
      orderBy: manualOrderByMock,
    });
    const selectMock = vi
      .fn()
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: dailyWhereMock,
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: manualWhereMock,
        }),
      });

    getDbMock.mockResolvedValue({
      select: selectMock,
    });

    const response = await GET(
      new Request(
        "http://localhost/api/attendance/students?classId=class-a&date=2026-04-08",
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          id: "student-1",
          status: "present",
          isLocked: true,
          notes: "",
        },
        {
          id: "student-2",
          status: "permission",
          isLocked: false,
          notes: "Izin keluarga",
        },
      ],
    });
  });

  it("returns not found when the requested class cannot be resolved", async () => {
    getAttendanceRosterStudentsMock.mockRejectedValue(new Error("not found"));

    const response = await GET(
      new Request(
        "http://localhost/api/attendance/students?classId=class-a&date=2026-04-08",
      ),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: "Kelas tidak ditemukan",
    });
  });
});
