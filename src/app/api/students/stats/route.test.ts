import { describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const requireRoleMock = vi.hoisted(() => vi.fn());
const getDbMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/web/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/api/authz", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/lib/db", () => ({
  getDb: getDbMock,
}));

import { GET } from "./route";

describe("GET /api/students/stats", () => {
  it("returns self stats for student role without invoking admin role guard", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "student-1",
        role: "student",
      },
    });

    const dbMock = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [
              {
                grade: "10-A",
                gender: "L",
              },
            ]),
          })),
        })),
      })),
    };

    getDbMock.mockResolvedValue(dbMock);

    const response = await GET();
    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      success: boolean;
      data: {
        total: number;
        male: number;
        female: number;
        activeGrades: number;
      };
    };

    expect(payload.success).toBe(true);
    expect(payload.data).toEqual({
      total: 1,
      male: 1,
      female: 0,
      activeGrades: 1,
    });
    expect(requireRoleMock).not.toHaveBeenCalled();
  });
});
