import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const requirePermissionMock = vi.hoisted(() => vi.fn());
const getAttendanceHistoryMock = vi.hoisted(() => vi.fn());
const getAttendanceHistoryCountMock = vi.hoisted(() => vi.fn());
const getAttendanceHistoryExportRowsMock = vi.hoisted(() => vi.fn());
const getAttendanceHistorySummaryMock = vi.hoisted(() => vi.fn());
const getAttendanceHistoryClassSummaryMock = vi.hoisted(() => vi.fn());
const getAttendanceHistoryStudentSummaryMock = vi.hoisted(() => vi.fn());
const getAttendanceHistoryTrendMock = vi.hoisted(() => vi.fn());
const getAttendanceHistoryHeatmapMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/web/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/api/authz", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/core/services/attendance-service", () => ({
  getAttendanceHistory: getAttendanceHistoryMock,
  getAttendanceHistoryCount: getAttendanceHistoryCountMock,
  getAttendanceHistoryExportRows: getAttendanceHistoryExportRowsMock,
  getAttendanceHistorySummary: getAttendanceHistorySummaryMock,
  getAttendanceHistoryClassSummary: getAttendanceHistoryClassSummaryMock,
  getAttendanceHistoryStudentSummary: getAttendanceHistoryStudentSummaryMock,
  getAttendanceHistoryTrend: getAttendanceHistoryTrendMock,
  getAttendanceHistoryHeatmap: getAttendanceHistoryHeatmapMock,
}));

import { GET } from "./route";

describe("GET /api/attendance/history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes student role to own history even when a different studentId is requested", async () => {
    authMock.mockResolvedValue({
      user: { id: "student-1", role: "student" },
    });
    requirePermissionMock.mockReturnValue(null);

    const response = await GET(
      new Request(
        "http://localhost/api/attendance/history?studentId=student-2",
      ),
    );

    expect(response.status).toBe(403);
    expect(getAttendanceHistoryMock).not.toHaveBeenCalled();
    expect(getAttendanceHistoryCountMock).not.toHaveBeenCalled();
  });

  it("forwards source filter for non-student roles", async () => {
    authMock.mockResolvedValue({
      user: { id: "teacher-1", role: "teacher" },
    });
    requirePermissionMock.mockReturnValue(null);
    getAttendanceHistoryMock.mockResolvedValue([]);
    getAttendanceHistoryCountMock.mockResolvedValue(0);

    const response = await GET(
      new Request(
        "http://localhost/api/attendance/history?source=qr&status=late",
      ),
    );

    expect(response.status).toBe(200);
    expect(getAttendanceHistoryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "qr",
        status: "late",
      }),
    );
    expect(getAttendanceHistoryCountMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "qr",
        status: "late",
      }),
    );
  });

  it("uses export history path when export mode is requested", async () => {
    authMock.mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    });
    requirePermissionMock.mockReturnValue(null);
    getAttendanceHistoryExportRowsMock.mockResolvedValue([{ id: "row-1" }]);
    getAttendanceHistoryCountMock.mockResolvedValue(1);

    const response = await GET(
      new Request(
        "http://localhost/api/attendance/history?export=true&startDate=2026-03-01&endDate=2026-03-22",
      ),
    );

    expect(response.status).toBe(200);
    expect(getAttendanceHistoryExportRowsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: "2026-03-01",
        endDate: "2026-03-22",
      }),
    );
    expect(getAttendanceHistoryMock).not.toHaveBeenCalled();
  });

  it("uses summary history path when summary mode is requested", async () => {
    authMock.mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    });
    requirePermissionMock.mockReturnValue(null);
    getAttendanceHistorySummaryMock.mockResolvedValue({
      total: 10,
      present: 5,
      late: 2,
      excused: 2,
      absent: 1,
      qr: 7,
      manual: 3,
    });

    const response = await GET(
      new Request(
        "http://localhost/api/attendance/history?summary=true&startDate=2026-03-01&endDate=2026-03-22&source=manual",
      ),
    );

    expect(response.status).toBe(200);
    expect(getAttendanceHistorySummaryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: "2026-03-01",
        endDate: "2026-03-22",
        source: "manual",
      }),
    );
    expect(getAttendanceHistoryMock).not.toHaveBeenCalled();
    expect(getAttendanceHistoryExportRowsMock).not.toHaveBeenCalled();
  });

  it("uses class summary path when class summary mode is requested", async () => {
    authMock.mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    });
    requirePermissionMock.mockReturnValue(null);
    getAttendanceHistoryClassSummaryMock.mockResolvedValue([
      {
        className: "XII TSM 1",
        total: 25,
        present: 20,
        late: 2,
        excused: 2,
        absent: 1,
        qr: 15,
        manual: 10,
        attendanceRate: 88,
      },
    ]);

    const response = await GET(
      new Request(
        "http://localhost/api/attendance/history?classSummary=true&startDate=2026-03-01&endDate=2026-03-31",
      ),
    );

    expect(response.status).toBe(200);
    expect(getAttendanceHistoryClassSummaryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: "2026-03-01",
        endDate: "2026-03-31",
      }),
    );
    expect(getAttendanceHistoryMock).not.toHaveBeenCalled();
    expect(getAttendanceHistoryExportRowsMock).not.toHaveBeenCalled();
  });

  it("uses student summary path when student summary mode is requested", async () => {
    authMock.mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    });
    requirePermissionMock.mockReturnValue(null);
    getAttendanceHistoryStudentSummaryMock.mockResolvedValue([
      {
        studentId: "student-1",
        studentName: "Abdullah",
        nis: "212207001",
        className: "XII TSM 1",
        total: 20,
        present: 16,
        late: 2,
        excused: 1,
        absent: 1,
        qr: 12,
        manual: 8,
        attendanceRate: 90,
      },
    ]);

    const response = await GET(
      new Request(
        "http://localhost/api/attendance/history?studentSummary=true&startDate=2026-03-01&endDate=2026-03-31",
      ),
    );

    expect(response.status).toBe(200);
    expect(getAttendanceHistoryStudentSummaryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: "2026-03-01",
        endDate: "2026-03-31",
      }),
    );
  });

  it("uses trend path when trend mode is requested", async () => {
    authMock.mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    });
    requirePermissionMock.mockReturnValue(null);
    getAttendanceHistoryTrendMock.mockResolvedValue([
      {
        label: "2026-03-01",
        period: "2026-03-01",
        total: 10,
        present: 8,
        late: 1,
        excused: 1,
        absent: 0,
        attendanceRate: 90,
      },
    ]);

    const response = await GET(
      new Request(
        "http://localhost/api/attendance/history?trend=true&startDate=2026-03-01&endDate=2026-03-07",
      ),
    );

    expect(response.status).toBe(200);
    expect(getAttendanceHistoryTrendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: "2026-03-01",
        endDate: "2026-03-07",
      }),
    );
  });

  it("forwards class name filter to analytics paths", async () => {
    authMock.mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    });
    requirePermissionMock.mockReturnValue(null);
    getAttendanceHistoryTrendMock.mockResolvedValue([]);

    const response = await GET(
      new Request(
        "http://localhost/api/attendance/history?trend=true&className=XII%20TSM%201",
      ),
    );

    expect(response.status).toBe(200);
    expect(getAttendanceHistoryTrendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        className: "XII TSM 1",
      }),
    );
  });

  it("uses heatmap path when heatmap mode is requested", async () => {
    authMock.mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    });
    requirePermissionMock.mockReturnValue(null);
    getAttendanceHistoryHeatmapMock.mockResolvedValue([
      {
        date: "2026-03-01",
        dayLabel: "01",
        total: 30,
        present: 25,
        late: 2,
        excused: 2,
        absent: 1,
        attendanceRate: 90,
      },
    ]);

    const response = await GET(
      new Request(
        "http://localhost/api/attendance/history?heatmap=true&className=XII%20TSM%201",
      ),
    );

    expect(response.status).toBe(200);
    expect(getAttendanceHistoryHeatmapMock).toHaveBeenCalledWith(
      expect.objectContaining({
        className: "XII TSM 1",
      }),
    );
  });
});
