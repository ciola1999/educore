import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const requireRoleMock = vi.hoisted(() => vi.fn());
const getAttendanceRiskAssignmentSummaryMock = vi.hoisted(() => vi.fn());
const getAttendanceRiskNotificationSummaryMock = vi.hoisted(() => vi.fn());
const getAttendanceRiskNotificationsMock = vi.hoisted(() => vi.fn());
const getAttendanceRiskSettingsMock = vi.hoisted(() => vi.fn());
const getAttendanceRiskStudentsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/web/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/api/authz", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/core/services/attendance-service", () => ({
  getAttendanceRiskAssignmentSummary: getAttendanceRiskAssignmentSummaryMock,
  getAttendanceRiskNotificationSummary:
    getAttendanceRiskNotificationSummaryMock,
  getAttendanceRiskNotifications: getAttendanceRiskNotificationsMock,
  getAttendanceRiskSettings: getAttendanceRiskSettingsMock,
  getAttendanceRiskStudents: getAttendanceRiskStudentsMock,
}));

import { GET } from "./route";

describe("GET /api/attendance/risk-insights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRoleMock.mockReturnValue(null);
    getAttendanceRiskSettingsMock.mockResolvedValue({
      alphaThreshold: 3,
      lateThreshold: 5,
      rateThreshold: 75,
    });
    getAttendanceRiskStudentsMock.mockResolvedValue([]);
    getAttendanceRiskNotificationsMock.mockResolvedValue([]);
    getAttendanceRiskNotificationSummaryMock.mockResolvedValue({
      total: 0,
      pending: 0,
      done: 0,
    });
    getAttendanceRiskAssignmentSummaryMock.mockResolvedValue([
      { userId: "teacher-1", assigneeName: "Teacher 1", total: 1 },
    ]);
  });

  it("uses own assignee scope for non-admin roles even if assigneeUserId is requested", async () => {
    authMock.mockResolvedValue({
      user: { id: "teacher-1", role: "teacher" },
    });

    const response = await GET(
      new Request(
        "http://localhost/api/attendance/risk-insights?assigneeUserId=teacher-2&className=XII%20TSM%201",
      ),
    );

    expect(response.status).toBe(200);
    expect(getAttendanceRiskNotificationsMock).toHaveBeenCalledWith(
      "teacher-1",
    );
    expect(getAttendanceRiskNotificationSummaryMock).toHaveBeenCalledWith(
      "teacher-1",
    );
    expect(getAttendanceRiskAssignmentSummaryMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      data: {
        assignmentSummary: [],
        assigneeUserId: null,
        className: "XII TSM 1",
      },
    });
  });

  it("allows admin to inspect another assignee and receive assignment summary", async () => {
    authMock.mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    });

    const response = await GET(
      new Request(
        "http://localhost/api/attendance/risk-insights?assigneeUserId=teacher-2",
      ),
    );

    expect(response.status).toBe(200);
    expect(getAttendanceRiskNotificationsMock).toHaveBeenCalledWith(
      "teacher-2",
    );
    expect(getAttendanceRiskNotificationSummaryMock).toHaveBeenCalledWith(
      "teacher-2",
    );
    expect(getAttendanceRiskAssignmentSummaryMock).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        assigneeUserId: "teacher-2",
        assignmentSummary: [{ userId: "teacher-1", assigneeName: "Teacher 1" }],
      },
    });
  });
});
