import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const requirePermissionMock = vi.hoisted(() => vi.fn());
const createAttendanceRiskFollowUpMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/web/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/api/authz", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/core/services/attendance-service", () => ({
  createAttendanceRiskFollowUp: createAttendanceRiskFollowUpMock,
}));

import { POST } from "./route";

describe("POST /api/attendance/risk-followups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermissionMock.mockReturnValue(null);
  });

  it("requires attendance:write permission", async () => {
    authMock.mockResolvedValue({ user: { id: "teacher-1" } });
    requirePermissionMock.mockReturnValue(
      new Response("forbidden", { status: 403 }),
    );

    const response = await POST(
      new Request("http://localhost/api/attendance/risk-followups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentId: "student-1",
          riskFlags: ["Alpha >= 3"],
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(requirePermissionMock).toHaveBeenCalledWith(
      { user: { id: "teacher-1" } },
      "attendance:write",
    );
  });

  it("rejects invalid risk flag payload", async () => {
    authMock.mockResolvedValue({ user: { id: "teacher-1" } });

    const response = await POST(
      new Request("http://localhost/api/attendance/risk-followups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentId: "student-1",
          riskFlags: [123, "", " ".repeat(2)],
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(createAttendanceRiskFollowUpMock).not.toHaveBeenCalled();
  });

  it("normalizes risk flags and strips spoofed identity fields", async () => {
    authMock.mockResolvedValue({ user: { id: "teacher-1" } });

    const response = await POST(
      new Request("http://localhost/api/attendance/risk-followups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentId: "student-1",
          studentName: "Spoofed Name",
          nis: "spoofed",
          className: "spoofed",
          riskFlags: ["  Alpha >= 3  ", "Late >= 5", 99],
          note: "  Perlu dipantau  ",
          deadline: "2026-03-31",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(createAttendanceRiskFollowUpMock).toHaveBeenCalledWith({
      actorUserId: "teacher-1",
      studentId: "student-1",
      riskFlags: ["Alpha >= 3", "Late >= 5"],
      note: "  Perlu dipantau  ",
      deadline: "2026-03-31",
    });
  });
});
