import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const requirePermissionMock = vi.hoisted(() => vi.fn());
const getAttendanceRiskFollowUpAuditTrailMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/web/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/api/authz", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/core/services/attendance-service", () => ({
  getAttendanceRiskFollowUpAuditTrail: getAttendanceRiskFollowUpAuditTrailMock,
}));

import { GET } from "./route";

describe("GET /api/attendance/risk-followups/[id]/history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermissionMock.mockReturnValue(null);
  });

  it("returns 401 when session user id is missing", async () => {
    authMock.mockResolvedValue({ user: { role: "teacher" } });

    const response = await GET(
      new Request(
        "http://localhost/api/attendance/risk-followups/followup-1/history",
      ),
      { params: Promise.resolve({ id: "followup-1" }) },
    );

    expect(response.status).toBe(401);
    expect(getAttendanceRiskFollowUpAuditTrailMock).not.toHaveBeenCalled();
  });

  it("passes allowAnyAssignee=true for admin role", async () => {
    authMock.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
    getAttendanceRiskFollowUpAuditTrailMock.mockResolvedValue([
      { id: "log-1" },
    ]);

    const response = await GET(
      new Request(
        "http://localhost/api/attendance/risk-followups/followup-1/history",
      ),
      { params: Promise.resolve({ id: "followup-1" }) },
    );

    expect(response.status).toBe(200);
    expect(getAttendanceRiskFollowUpAuditTrailMock).toHaveBeenCalledWith(
      "followup-1",
      "admin-1",
      { allowAnyAssignee: true },
    );
  });

  it("passes scoped assignee access for non-admin role", async () => {
    authMock.mockResolvedValue({ user: { id: "teacher-1", role: "teacher" } });
    getAttendanceRiskFollowUpAuditTrailMock.mockResolvedValue([
      { id: "log-2" },
    ]);

    const response = await GET(
      new Request(
        "http://localhost/api/attendance/risk-followups/followup-1/history",
      ),
      { params: Promise.resolve({ id: "followup-1" }) },
    );

    expect(response.status).toBe(200);
    expect(getAttendanceRiskFollowUpAuditTrailMock).toHaveBeenCalledWith(
      "followup-1",
      "teacher-1",
      { allowAnyAssignee: false },
    );
  });
});
