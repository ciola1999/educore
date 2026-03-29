import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const requireRoleMock = vi.hoisted(() => vi.fn());
const getAttendanceHistoryStudentOptionsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/web/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/api/authz", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/core/services/attendance-service", () => ({
  getAttendanceHistoryStudentOptions: getAttendanceHistoryStudentOptionsMock,
}));

import { GET } from "./route";

describe("GET /api/attendance/student-options", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns student options for authorized admins", async () => {
    authMock.mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    });
    requireRoleMock.mockReturnValue(null);
    getAttendanceHistoryStudentOptionsMock.mockResolvedValue([
      {
        id: "student-1",
        fullName: "Alya",
        nis: "2324.10.001",
        grade: "XII TSM 1",
      },
    ]);

    const response = await GET(
      new Request(
        "http://localhost/api/attendance/student-options?search=aly&limit=10",
      ),
    );

    expect(response.status).toBe(200);
    expect(getAttendanceHistoryStudentOptionsMock).toHaveBeenCalledWith({
      search: "aly",
      limit: 10,
    });
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: [{ id: "student-1" }],
    });
  });

  it("returns guard response when role is not allowed", async () => {
    authMock.mockResolvedValue({
      user: { id: "teacher-1", role: "teacher" },
    });
    requireRoleMock.mockReturnValue(
      new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await GET(
      new Request("http://localhost/api/attendance/student-options"),
    );

    expect(response.status).toBe(403);
    expect(getAttendanceHistoryStudentOptionsMock).not.toHaveBeenCalled();
  });
});
