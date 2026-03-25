import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const requirePermissionMock = vi.hoisted(() => vi.fn());
const getAttendanceRiskFollowUpHistoryMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/web/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/api/authz", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/core/services/attendance-service", () => ({
  getAttendanceRiskFollowUpHistory: getAttendanceRiskFollowUpHistoryMock,
}));

import { GET } from "./route";

describe("GET /api/attendance/risk-followups/history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermissionMock.mockReturnValue(null);
  });

  it("returns 401 when session user id is missing", async () => {
    authMock.mockResolvedValue({ user: { role: "admin" } });

    const response = await GET(
      new Request(
        "http://localhost/api/attendance/risk-followups/history?studentId=student-1",
      ),
    );

    expect(response.status).toBe(401);
    expect(getAttendanceRiskFollowUpHistoryMock).not.toHaveBeenCalled();
  });

  it("returns 400 when studentId query param is missing", async () => {
    authMock.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });

    const response = await GET(
      new Request("http://localhost/api/attendance/risk-followups/history"),
    );

    expect(response.status).toBe(400);
    expect(getAttendanceRiskFollowUpHistoryMock).not.toHaveBeenCalled();
  });

  it("returns 403 when student requests history of another student", async () => {
    authMock.mockResolvedValue({ user: { id: "student-1", role: "student" } });

    const response = await GET(
      new Request(
        "http://localhost/api/attendance/risk-followups/history?studentId=student-2",
      ),
    );

    expect(response.status).toBe(403);
    expect(getAttendanceRiskFollowUpHistoryMock).not.toHaveBeenCalled();
  });

  it("passes allowAnyAssignee=true for admin role", async () => {
    authMock.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
    getAttendanceRiskFollowUpHistoryMock.mockResolvedValue([
      { id: "followup-1" },
    ]);

    const response = await GET(
      new Request(
        "http://localhost/api/attendance/risk-followups/history?studentId=student-1",
      ),
    );

    expect(response.status).toBe(200);
    expect(getAttendanceRiskFollowUpHistoryMock).toHaveBeenCalledWith(
      "student-1",
      {
        assigneeUserId: "admin-1",
        allowAnyAssignee: true,
      },
    );
  });

  it("passes owner scope for non-admin non-student role", async () => {
    authMock.mockResolvedValue({ user: { id: "teacher-1", role: "teacher" } });
    getAttendanceRiskFollowUpHistoryMock.mockResolvedValue([
      { id: "followup-2" },
    ]);

    const response = await GET(
      new Request(
        "http://localhost/api/attendance/risk-followups/history?studentId=student-1",
      ),
    );

    expect(response.status).toBe(200);
    expect(getAttendanceRiskFollowUpHistoryMock).toHaveBeenCalledWith(
      "student-1",
      {
        assigneeUserId: "teacher-1",
        allowAnyAssignee: false,
      },
    );
  });
});
