import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const requirePermissionMock = vi.hoisted(() => vi.fn());
const getTeachingAssignmentsMock = vi.hoisted(() => vi.fn());
const getTeachingAssignmentScheduleOptionsMock = vi.hoisted(() => vi.fn());
const addTeachingAssignmentMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/web/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/api/authz", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/lib/services/academic", () => ({
  addTeachingAssignment: addTeachingAssignmentMock,
  getTeachingAssignments: getTeachingAssignmentsMock,
  getTeachingAssignmentScheduleOptions:
    getTeachingAssignmentScheduleOptionsMock,
}));

describe("/api/teaching-assignments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
    requirePermissionMock.mockReturnValue(null);
  });

  it("returns full teaching assignments by default", async () => {
    getTeachingAssignmentsMock.mockResolvedValue([{ id: "gm-1" }]);

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/teaching-assignments"),
    );

    expect(response.status).toBe(200);
    expect(getTeachingAssignmentsMock).toHaveBeenCalled();
    expect(getTeachingAssignmentScheduleOptionsMock).not.toHaveBeenCalled();
  });

  it("returns lightweight schedule options when requested", async () => {
    getTeachingAssignmentScheduleOptionsMock.mockResolvedValue([
      { id: "gm-1" },
    ]);

    const { GET } = await import("./route");
    const response = await GET(
      new Request(
        "http://localhost/api/teaching-assignments?view=schedule-options",
      ),
    );

    expect(response.status).toBe(200);
    expect(getTeachingAssignmentScheduleOptionsMock).toHaveBeenCalled();
    expect(getTeachingAssignmentsMock).not.toHaveBeenCalled();
  });
});
