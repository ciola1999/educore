import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: getDbMock,
}));

type SelectPlan = {
  result: unknown[];
  viaLimit?: boolean;
  viaOrderBy?: boolean;
};

type SelectQuery = {
  from: ReturnType<typeof vi.fn>;
  leftJoin: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
};

function createSelectQuery(plan: SelectPlan) {
  const query = {} as SelectQuery;
  query.from = vi.fn(() => query);
  query.leftJoin = vi.fn(() => query);
  query.orderBy = vi.fn(async () => plan.result);
  query.limit = vi.fn(async () => plan.result);

  if (plan.viaLimit || plan.viaOrderBy) {
    query.where = vi.fn(() => query);
  } else {
    query.where = vi.fn(async () => plan.result);
  }

  return query;
}

describe("student-projection", () => {
  let selectPlans: SelectPlan[];
  let mockDb: {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    values: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    selectPlans = [];
    mockDb = {
      select: vi.fn(() =>
        createSelectQuery(selectPlans.shift() || { result: [] }),
      ),
      insert: vi.fn(() => mockDb),
      values: vi.fn(async () => undefined),
      update: vi.fn(() => mockDb),
      set: vi.fn(() => mockDb),
      where: vi.fn(async () => undefined),
    };
    getDbMock.mockResolvedValue(mockDb);
  });

  it("keeps existing student grade when user account has no class reference", async () => {
    const { syncUsersToStudentsProjection } = await import(
      "./student-projection"
    );

    selectPlans.push(
      {
        result: [{ id: "class-1", name: "X-A" }],
      },
      {
        result: [
          {
            user: {
              id: "student-1",
              fullName: "Siswa Update",
              nis: "2026001",
              nisn: "1234567890",
              jenisKelamin: "L",
              tempatLahir: null,
              tanggalLahir: null,
              alamat: "Alamat",
              kelasId: null,
            },
            className: null,
          },
        ],
      },
      {
        result: [],
        viaOrderBy: true,
      },
      {
        result: [
          {
            id: "student-1",
            nis: "2026001",
            fullName: "Siswa Lama",
            gender: "L",
            grade: "X-A",
            nisn: "1234567890",
            alamat: "Alamat",
          },
        ],
      },
      {
        result: [{ id: "setting-1" }],
        viaLimit: true,
      },
    );

    const result = await syncUsersToStudentsProjection();

    expect(result).toEqual({
      classCreated: 0,
      studentUpserted: 1,
      settingsSeeded: 0,
    });
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        grade: "X-A",
      }),
    );
    expect(mockDb.set).not.toHaveBeenCalledWith(
      expect.objectContaining({
        grade: "UNASSIGNED",
      }),
    );
  }, 20000);

  it("backfills legacy student class from latest attendance when kelasId is missing", async () => {
    const { syncUsersToStudentsProjection } = await import(
      "./student-projection"
    );

    selectPlans.push(
      {
        result: [{ id: "class-legacy", name: "XI-B" }],
      },
      {
        result: [
          {
            user: {
              id: "student-legacy",
              fullName: "Siswa Legacy",
              nis: "2026002",
              nisn: "2222222222",
              jenisKelamin: "L",
              tempatLahir: null,
              tanggalLahir: null,
              alamat: null,
              kelasId: null,
            },
            className: null,
          },
        ],
      },
      {
        result: [
          {
            studentId: "student-legacy",
            classId: "class-legacy",
            date: "2026-03-20",
            createdAt: new Date("2026-03-20T07:00:00.000Z"),
            updatedAt: new Date("2026-03-20T07:01:00.000Z"),
          },
        ],
        viaOrderBy: true,
      },
      {
        result: [
          {
            id: "student-legacy",
            nis: "2026002",
            fullName: "Siswa Legacy",
            gender: "L",
            grade: "UNASSIGNED",
            nisn: "2222222222",
            alamat: null,
          },
        ],
      },
      {
        result: [{ id: "setting-1" }],
        viaLimit: true,
      },
    );

    const result = await syncUsersToStudentsProjection();

    expect(result).toEqual({
      classCreated: 0,
      studentUpserted: 1,
      settingsSeeded: 0,
    });
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        kelasId: "class-legacy",
      }),
    );
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        grade: "XI-B",
      }),
    );
  }, 20000);

  it("resolves existing legacy grade UUID into class name during projection sync", async () => {
    const { syncUsersToStudentsProjection } = await import(
      "./student-projection"
    );

    selectPlans.push(
      {
        result: [{ id: "class-12-tsm", name: "12 TSM" }],
      },
      {
        result: [
          {
            user: {
              id: "student-uuid-grade",
              fullName: "Aditya Putra",
              nis: "2324.10.001",
              nisn: "1231231231",
              jenisKelamin: "L",
              tempatLahir: null,
              tanggalLahir: null,
              alamat: null,
              kelasId: "class-12-tsm",
            },
            className: "12 TSM",
          },
        ],
      },
      {
        result: [],
        viaOrderBy: true,
      },
      {
        result: [
          {
            id: "student-uuid-grade",
            nis: "2324.10.001",
            fullName: "Aditya Putra",
            gender: "L",
            grade: "class-12-tsm",
            nisn: "1231231231",
            alamat: null,
          },
        ],
      },
      {
        result: [{ id: "setting-1" }],
        viaLimit: true,
      },
    );

    const result = await syncUsersToStudentsProjection();

    expect(result).toEqual({
      classCreated: 0,
      studentUpserted: 1,
      settingsSeeded: 0,
    });
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        grade: "12 TSM",
      }),
    );
    expect(mockDb.set).not.toHaveBeenCalledWith(
      expect.objectContaining({
        grade: "UNASSIGNED",
      }),
    );
  }, 20000);
});
