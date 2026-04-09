import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const requirePermissionMock = vi.hoisted(() => vi.fn());
const getDbMock = vi.hoisted(() => vi.fn());
const resolveAttendanceAccessScopeMock = vi.hoisted(() => vi.fn());
const getAuthorizedAttendanceClassesMock = vi.hoisted(() => vi.fn());

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
  getAuthorizedAttendanceClasses: getAuthorizedAttendanceClassesMock,
}));

import { GET } from "./route";

describe("GET /api/attendance/classes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: "teacher-1", role: "teacher" },
    });
    requirePermissionMock.mockReturnValue(null);
    getDbMock.mockResolvedValue({});
    resolveAttendanceAccessScopeMock.mockResolvedValue({
      userId: "teacher-1",
      role: "teacher",
      hasRosterAccess: true,
      hasGlobalClassAccess: false,
      classIds: ["class-a"],
    });
    getAuthorizedAttendanceClassesMock.mockResolvedValue([
      { id: "class-a", name: "XII TSM 1" },
      { id: "class-a", name: "XII TSM 1" },
    ]);
  });

  it("returns forbidden when the session user has no attendance roster scope", async () => {
    resolveAttendanceAccessScopeMock.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(getAuthorizedAttendanceClassesMock).not.toHaveBeenCalled();
  });

  it("returns deduped class options from the authorized class scope", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(getAuthorizedAttendanceClassesMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        userId: "teacher-1",
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      data: [{ id: "class-a", name: "XII TSM 1" }],
    });
  });
});
