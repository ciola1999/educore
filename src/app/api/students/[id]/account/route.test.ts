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

describe("POST /api/students/[id]/account", () => {
  let selectResults: SelectResult[];
  let insertTarget: unknown[][];
  let setPayloads: Array<Record<string, unknown>>;
  let dbMock: {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    values: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    selectResults = [];
    insertTarget = [];
    setPayloads = [];

    requireRoleMock.mockReturnValue(null);
    authMock.mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    });
    hashPasswordMock.mockResolvedValue("hashed-password");

    dbMock = {
      select: vi.fn(() => createQuery(selectResults.shift() ?? [])),
      insert: vi.fn((table: unknown) => {
        insertTarget.push([table]);
        return dbMock;
      }),
      values: vi.fn(async () => undefined),
      update: vi.fn(() => dbMock),
      set: vi.fn((payload: Record<string, unknown>) => {
        setPayloads.push(payload);
        return dbMock;
      }),
      where: vi.fn(async () => undefined),
    };

    getDbMock.mockResolvedValue(dbMock);
  });

  it("canonicalizes UUID-backed student grades and reuses the canonical class when creating accounts", async () => {
    selectResults.push(
      [
        {
          id: "student-1",
          nis: "2324.10.007",
          nisn: "9988776655",
          fullName: "EGA SAPUTRA",
          gender: "L",
          grade: "2361c8a3-c3d3-463b-b0a9-5e94cb94920d",
          tempatLahir: null,
          tanggalLahir: null,
          alamat: null,
        },
      ],
      [],
      [],
      [{ name: "KELAS XII TSM" }],
      [{ id: "class-12-tsm" }],
    );

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/students/student-1/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "2324.10.007@smp.ypms",
          password: "password123",
        }),
      }),
      {
        params: Promise.resolve({ id: "student-1" }),
      },
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      success: boolean;
      data: { accountCreated: boolean };
    };

    expect(payload.success).toBe(true);
    expect(payload.data.accountCreated).toBe(true);
    expect(hashPasswordMock).toHaveBeenCalledTimes(1);
    expect(setPayloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          grade: "KELAS 12 TSM",
          syncStatus: "pending",
        }),
      ]),
    );
    expect(dbMock.values).toHaveBeenCalledWith(
      expect.objectContaining({
        kelasId: "class-12-tsm",
        email: "2324.10.007@smp.ypms",
        role: "student",
        syncStatus: "pending",
      }),
    );
    expect(insertTarget).toHaveLength(1);
    expect(dbMock.values).not.toHaveBeenCalledWith(
      expect.objectContaining({
        name: "KELAS 12 TSM",
      }),
    );
  }, 20000);
});
