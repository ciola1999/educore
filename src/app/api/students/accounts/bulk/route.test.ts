import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const requireRoleMock = vi.hoisted(() => vi.fn());
const getDbMock = vi.hoisted(() => vi.fn());
const hashPasswordMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/web/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/api/authz", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/lib/db", () => ({
  getDb: getDbMock,
}));

vi.mock("@/lib/auth/hash", () => ({
  hashPassword: hashPasswordMock,
}));

type SelectResult = unknown[];
type QueryChain = Promise<SelectResult> & {
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
};

function createQuery(result: SelectResult): QueryChain {
  const promise = Promise.resolve(result) as QueryChain;
  promise.from = vi.fn().mockReturnValue(promise);
  promise.where = vi.fn().mockReturnValue(promise);
  promise.limit = vi.fn().mockReturnValue(promise);
  return promise;
}

describe("POST /api/students/accounts/bulk", () => {
  let selectResults: SelectResult[];
  let txMock: {
    insert: ReturnType<typeof vi.fn>;
    values: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
  };
  let dbMock: {
    select: ReturnType<typeof vi.fn>;
    transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    selectResults = [];
    requireRoleMock.mockReturnValue(null);
    authMock.mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    });
    hashPasswordMock.mockResolvedValue("hashed-password");

    txMock = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    };

    dbMock = {
      select: vi.fn(() => createQuery(selectResults.shift() ?? [])),
      transaction: vi.fn(
        async (callback: (tx: typeof txMock) => Promise<void>) =>
          callback(txMock),
      ),
    };

    getDbMock.mockResolvedValue(dbMock);
  });

  it("restores soft-deleted student accounts instead of skipping them", async () => {
    selectResults.push(
      [
        {
          id: "11111111-1111-4111-8111-111111111111",
          nis: "2324.10.001",
          nisn: null,
          fullName: "Aditya Putra",
          gender: "L",
          grade: "10-A",
          tempatLahir: null,
          tanggalLahir: null,
          alamat: null,
        },
      ],
      [
        {
          id: "11111111-1111-4111-8111-111111111111",
          deletedAt: new Date("2026-03-20T00:00:00.000Z"),
        },
      ],
      [
        {
          id: "11111111-1111-4111-8111-111111111111",
          email: "2324.10.001@school.test",
          deletedAt: new Date("2026-03-20T00:00:00.000Z"),
        },
      ],
      [],
      [{ id: "class-10a", name: "10-A" }],
    );

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/students/accounts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: ["11111111-1111-4111-8111-111111111111"],
          emailDomain: "school.test",
          password: "password123",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      success: boolean;
      data: { created: number; skipped: number };
    };

    expect(payload.success).toBe(true);
    expect(payload.data).toEqual(
      expect.objectContaining({
        created: 1,
        skipped: 0,
      }),
    );
    expect(hashPasswordMock).toHaveBeenCalledTimes(1);
    expect(txMock.update).toHaveBeenCalledTimes(1);
    expect(txMock.insert).toHaveBeenCalledTimes(1);
    expect(txMock.set).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "2324.10.001@school.test",
        deletedAt: null,
        isActive: true,
        syncStatus: "pending",
      }),
    );
    expect(txMock.insert.mock.calls[0]?.[0]).toBeDefined();
  });
});
