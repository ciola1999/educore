import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const requireRoleMock = vi.hoisted(() => vi.fn());
const getAttendanceRiskAssignmentSummaryMock = vi.hoisted(() => vi.fn());
const getAttendanceRiskNotificationSummaryMock = vi.hoisted(() => vi.fn());
const getAttendanceRiskNotificationsMock = vi.hoisted(() => vi.fn());
const getAttendanceRiskSettingsMock = vi.hoisted(() => vi.fn());
const getAttendanceRiskStudentsMock = vi.hoisted(() => vi.fn());
const getDbMock = vi.hoisted(() => vi.fn());
const resolveAttendanceAccessScopeMock = vi.hoisted(() => vi.fn());
const getAuthorizedAttendanceClassNamesMock = vi.hoisted(() => vi.fn());

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

vi.mock("@/lib/db", () => ({
  getDb: getDbMock,
}));

vi.mock("@/lib/auth/attendance-access", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/auth/attendance-access")
  >("@/lib/auth/attendance-access");

  return {
    ...actual,
    resolveAttendanceAccessScope: resolveAttendanceAccessScopeMock,
    getAuthorizedAttendanceClassNames: getAuthorizedAttendanceClassNamesMock,
  };
});

import { GET } from "./route";

describe("GET /api/attendance/risk-insights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDbMock.mockResolvedValue({});
    requireRoleMock.mockReturnValue(null);
    resolveAttendanceAccessScopeMock.mockResolvedValue({
      userId: "teacher-1",
      role: "teacher",
      hasRosterAccess: true,
      hasGlobalClassAccess: false,
      classIds: ["class-a"],
    });
    getAuthorizedAttendanceClassNamesMock.mockResolvedValue(["XII TSM 1"]);
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
    expect(getAttendanceRiskNotificationSummaryMock).not.toHaveBeenCalled();
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
    resolveAttendanceAccessScopeMock.mockResolvedValue({
      userId: "admin-1",
      role: "admin",
      hasRosterAccess: true,
      hasGlobalClassAccess: true,
      classIds: [],
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
    expect(getAttendanceRiskAssignmentSummaryMock).toHaveBeenCalledWith(
      undefined,
    );
    await expect(response.json()).resolves.toMatchObject({
      data: {
        assigneeUserId: "teacher-2",
        assignmentSummary: [{ userId: "teacher-1", assigneeName: "Teacher 1" }],
      },
    });
  });

  it("recomputes notification summary from filtered notifications when class filter is active", async () => {
    authMock.mockResolvedValue({
      user: { id: "teacher-1", role: "teacher" },
    });
    getAttendanceRiskNotificationsMock.mockResolvedValue([
      {
        id: "notif-1",
        className: "XII TSM 1",
        isRead: false,
      },
      {
        id: "notif-2",
        className: "XII TSM 1",
        isRead: true,
      },
      {
        id: "notif-3",
        className: "XII TSM 2",
        isRead: false,
      },
    ]);
    getAttendanceRiskNotificationSummaryMock.mockResolvedValue({
      total: 3,
      pending: 2,
      done: 1,
    });

    const response = await GET(
      new Request(
        "http://localhost/api/attendance/risk-insights?className=XII%20TSM%201",
      ),
    );

    expect(response.status).toBe(200);
    expect(getAttendanceRiskAssignmentSummaryMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      data: {
        notifications: [
          { id: "notif-1", className: "XII TSM 1", isRead: false },
          { id: "notif-2", className: "XII TSM 1", isRead: true },
        ],
        notificationSummary: {
          total: 2,
          pending: 1,
          done: 1,
        },
      },
    });
  });

  it("auto-scopes a scoped teacher to their only authorized class", async () => {
    authMock.mockResolvedValue({
      user: { id: "teacher-1", role: "teacher" },
    });

    const response = await GET(
      new Request("http://localhost/api/attendance/risk-insights"),
    );

    expect(response.status).toBe(200);
    expect(getAttendanceRiskStudentsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        className: "XII TSM 1",
      }),
      expect.anything(),
    );
    await expect(response.json()).resolves.toMatchObject({
      data: {
        className: "XII TSM 1",
      },
    });
  });

  it("rejects scoped teacher risk insights without explicit class filter when multiple classes are authorized", async () => {
    authMock.mockResolvedValue({
      user: { id: "teacher-1", role: "teacher" },
    });
    resolveAttendanceAccessScopeMock.mockResolvedValue({
      userId: "teacher-1",
      role: "teacher",
      hasRosterAccess: true,
      hasGlobalClassAccess: false,
      classIds: ["class-a", "class-b"],
    });
    getAuthorizedAttendanceClassNamesMock.mockResolvedValue([
      "XII TSM 1",
      "XII TSM 2",
    ]);

    const response = await GET(
      new Request("http://localhost/api/attendance/risk-insights"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "ATTENDANCE_CLASS_FILTER_REQUIRED",
    });
    expect(getAttendanceRiskStudentsMock).not.toHaveBeenCalled();
  });

  it("passes class filter into admin assignment summary scope", async () => {
    authMock.mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    });
    resolveAttendanceAccessScopeMock.mockResolvedValue({
      userId: "admin-1",
      role: "admin",
      hasRosterAccess: true,
      hasGlobalClassAccess: true,
      classIds: [],
    });

    const response = await GET(
      new Request(
        "http://localhost/api/attendance/risk-insights?className=XII%20TSM%201",
      ),
    );

    expect(response.status).toBe(200);
    expect(getAttendanceRiskAssignmentSummaryMock).toHaveBeenCalledWith(
      "XII TSM 1",
    );
  });
});
