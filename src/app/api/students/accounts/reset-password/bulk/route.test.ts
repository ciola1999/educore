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
};

function createQuery(result: SelectResult): QueryChain {
  const promise = Promise.resolve(result) as QueryChain;
  promise.from = vi.fn().mockReturnValue(promise);
  promise.where = vi.fn().mockReturnValue(promise);
  return promise;
}

describe("POST /api/students/accounts/reset-password/bulk", () => {
  let selectResults: SelectResult[];
  let dbMock: {
    select: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
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

    dbMock = {
      select: vi.fn(() => createQuery(selectResults.shift() ?? [])),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    };

    getDbMock.mockResolvedValue(dbMock);
  });

  it("hashes once and updates all targeted student accounts in one bulk write", async () => {
    selectResults.push([
      { id: "11111111-1111-4111-8111-111111111111" },
      { id: "22222222-2222-4222-8222-222222222222" },
    ]);

    const { POST } = await import("./route");
    const response = await POST(
      new Request(
        "http://localhost/api/students/accounts/reset-password/bulk",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentIds: [
              "11111111-1111-4111-8111-111111111111",
              "22222222-2222-4222-8222-222222222222",
              "22222222-2222-4222-8222-222222222222",
            ],
            password: "password123",
          }),
        },
      ),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      success: boolean;
      data: { updated: number; skipped: number };
    };

    expect(payload.success).toBe(true);
    expect(payload.data).toEqual(
      expect.objectContaining({
        updated: 2,
        skipped: 0,
      }),
    );
    expect(hashPasswordMock).toHaveBeenCalledTimes(1);
    expect(dbMock.update).toHaveBeenCalledTimes(1);
    expect(dbMock.set).toHaveBeenCalledWith(
      expect.objectContaining({
        passwordHash: "hashed-password",
        syncStatus: "pending",
      }),
    );
  });
});
