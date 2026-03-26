import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const requirePermissionMock = vi.hoisted(() => vi.fn());
const markAttendanceRiskNotificationReadMock = vi.hoisted(() => vi.fn());
const updateAttendanceRiskFollowUpMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/web/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/api/authz", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/core/services/attendance-service", () => ({
  markAttendanceRiskNotificationRead: markAttendanceRiskNotificationReadMock,
  updateAttendanceRiskFollowUp: updateAttendanceRiskFollowUpMock,
}));

import { PATCH } from "./route";

describe("PATCH /api/attendance/risk-followups/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermissionMock.mockReturnValue(null);
  });

  it("requires attendance:write permission for follow-up mutations", async () => {
    authMock.mockResolvedValue({ user: { id: "teacher-1", role: "teacher" } });
    requirePermissionMock.mockReturnValue(
      new Response("forbidden", { status: 403 }),
    );

    const response = await PATCH(
      new Request("http://localhost/api/attendance/risk-followups/followup-1", {
        method: "PATCH",
      }),
      { params: Promise.resolve({ id: "followup-1" }) },
    );

    expect(response.status).toBe(403);
    expect(requirePermissionMock).toHaveBeenCalledWith(
      { user: { id: "teacher-1", role: "teacher" } },
      "attendance:write",
    );
    expect(markAttendanceRiskNotificationReadMock).not.toHaveBeenCalled();
    expect(updateAttendanceRiskFollowUpMock).not.toHaveBeenCalled();
  });

  it("marks follow-up as read for scoped non-admin user", async () => {
    authMock.mockResolvedValue({ user: { id: "teacher-1", role: "teacher" } });

    const response = await PATCH(
      new Request("http://localhost/api/attendance/risk-followups/followup-1", {
        method: "PATCH",
      }),
      { params: Promise.resolve({ id: "followup-1" }) },
    );

    expect(response.status).toBe(200);
    expect(markAttendanceRiskNotificationReadMock).toHaveBeenCalledWith(
      "followup-1",
      "teacher-1",
      {
        allowAnyAssignee: false,
      },
    );
    expect(updateAttendanceRiskFollowUpMock).not.toHaveBeenCalled();
  });

  it("rejects reassign attempt from non-admin user", async () => {
    authMock.mockResolvedValue({ user: { id: "teacher-1", role: "teacher" } });

    const response = await PATCH(
      new Request("http://localhost/api/attendance/risk-followups/followup-1", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assigneeUserId: "teacher-2",
        }),
      }),
      { params: Promise.resolve({ id: "followup-1" }) },
    );

    expect(response.status).toBe(403);
    expect(updateAttendanceRiskFollowUpMock).not.toHaveBeenCalled();
  });

  it("allows admin to update and reassign follow-up", async () => {
    authMock.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });

    const response = await PATCH(
      new Request("http://localhost/api/attendance/risk-followups/followup-1", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          note: "Perlu follow up wali kelas",
          deadline: "2026-03-31",
          assigneeUserId: "teacher-2",
          markDone: true,
        }),
      }),
      { params: Promise.resolve({ id: "followup-1" }) },
    );

    expect(response.status).toBe(200);
    expect(updateAttendanceRiskFollowUpMock).toHaveBeenCalledWith(
      "followup-1",
      "admin-1",
      {
        note: "Perlu follow up wali kelas",
        deadline: "2026-03-31",
        isRead: true,
        assigneeUserId: "teacher-2",
      },
      {
        allowAnyAssignee: true,
      },
    );
  });
});
