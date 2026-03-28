import { beforeEach, describe, expect, it, vi } from "vitest";

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

type SelectResult = unknown[];
type QueryChain = Promise<SelectResult> & {
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  leftJoin: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
};

function createQuery(result: SelectResult): QueryChain {
  const promise = Promise.resolve(result) as QueryChain;
  promise.from = vi.fn().mockReturnValue(promise);
  promise.where = vi.fn().mockReturnValue(promise);
  promise.leftJoin = vi.fn().mockReturnValue(promise);
  promise.limit = vi.fn().mockReturnValue(promise);
  return promise;
}

describe("POST /api/students/classes/repair", () => {
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

  it("creates the target class and updates student + account references atomically", async () => {
    selectResults.push(
      [{ id: "11111111-1111-4111-8111-111111111111" }],
      [
        {
          id: "11111111-1111-4111-8111-111111111111",
          grade: "UNASSIGNED",
          kelasId: null,
        },
      ],
      [
        {
          id: "11111111-1111-4111-8111-111111111111",
          grade: "UNASSIGNED",
          kelasId: null,
        },
      ],
      [],
    );

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/students/classes/repair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: ["11111111-1111-4111-8111-111111111111"],
          sourceToken: "UNASSIGNED",
          className: "10-A",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      success: boolean;
      data: { updated: number; className: string };
    };

    expect(payload.success).toBe(true);
    expect(payload.data).toEqual({
      updated: 1,
      className: "10-A",
    });
    expect(dbMock.transaction).toHaveBeenCalledTimes(1);
    expect(txMock.insert).toHaveBeenCalledTimes(1);
    expect(txMock.update).toHaveBeenCalledTimes(2);
    expect(txMock.set).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        grade: "10-A",
        syncStatus: "pending",
      }),
    );
    expect(txMock.set).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        kelasId: expect.any(String),
        syncStatus: "pending",
      }),
    );
  });
});
