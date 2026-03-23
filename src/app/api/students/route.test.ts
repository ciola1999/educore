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

describe("GET /api/students", () => {
  it("scopes student role to own record only", async () => {
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
                id: "student-1",
                nis: "2324.10.001",
                nisn: "0073996034",
                fullName: "Aditya Putra",
                gender: "L",
                grade: "10-A",
                parentName: "tes",
                parentPhone: "089643110787",
                tempatLahir: "Bekasi",
                tanggalLahir: null,
                alamat: "Tambun Selatan",
                createdAt: new Date("2026-03-19T00:00:00.000Z"),
              },
            ]),
          })),
        })),
      })),
    };

    getDbMock.mockResolvedValue(dbMock);

    const response = await GET(new Request("http://localhost/api/students"));
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      success: boolean;
      data: { data: Array<{ id: string }>; total: number };
    };
    expect(payload.success).toBe(true);
    expect(payload.data.total).toBe(1);
    expect(payload.data.data).toHaveLength(1);
    expect(payload.data.data[0]?.id).toBe("student-1");
    expect(requireRoleMock).not.toHaveBeenCalled();
  });
});
