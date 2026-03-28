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
type SelectQuery = Promise<SelectResult> & {
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  leftJoin: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  offset: ReturnType<typeof vi.fn>;
};

function createSelectQuery(result: SelectResult): SelectQuery {
  const promise = Promise.resolve(result) as SelectQuery;
  promise.from = vi.fn().mockReturnValue(promise);
  promise.where = vi.fn().mockReturnValue(promise);
  promise.limit = vi.fn().mockReturnValue(promise);
  promise.leftJoin = vi.fn().mockReturnValue(promise);
  promise.orderBy = vi.fn().mockReturnValue(promise);
  promise.offset = vi.fn().mockReturnValue(promise);
  return promise;
}

describe("/api/students route", () => {
  let selectResults: SelectResult[];
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
    selectResults = [];
    requireRoleMock.mockReturnValue(null);

    dbMock = {
      select: vi.fn(() => createSelectQuery(selectResults.shift() ?? [])),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    };

    getDbMock.mockResolvedValue(dbMock);
  });

  it("scopes student role to own record only", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "student-1",
        role: "student",
      },
    });

    selectResults.push(
      [{ id: "student-1", email: "student1@example.com" }],
      [
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
          accountClassName: "10-A",
        },
      ],
      [],
    );

    const { GET } = await import("./route");
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

  it("restores a soft-deleted student when NIS is reused", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "admin-1",
        role: "admin",
      },
    });

    selectResults.push([
      {
        id: "student-legacy",
        deletedAt: new Date("2026-03-27T00:00:00.000Z"),
      },
    ]);

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/students", {
      method: "POST",
      body: JSON.stringify({
        nis: "2324.10.001",
        fullName: "Aditya Putra",
        gender: "L",
        grade: "10-A",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      success: boolean;
      data: { id: string; created: boolean; userCreated: boolean };
    };

    expect(payload.success).toBe(true);
    expect(payload.data.id).toBe("student-legacy");
    expect(payload.data.userCreated).toBe(false);
    expect(dbMock.insert).not.toHaveBeenCalled();
    expect(dbMock.update).toHaveBeenCalled();
    expect(dbMock.set).toHaveBeenCalledWith(
      expect.objectContaining({
        nis: "2324.10.001",
        deletedAt: null,
        syncStatus: "pending",
      }),
    );
  });

  it("includes stats in admin list response when includeStats=1", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "admin-1",
        role: "admin",
      },
    });

    selectResults.push(
      [
        {
          id: "student-1",
          nis: "2324.10.001",
          nisn: null,
          fullName: "Aditya Putra",
          gender: "L",
          grade: "10-A",
          parentName: null,
          parentPhone: null,
          tempatLahir: null,
          tanggalLahir: null,
          alamat: null,
          createdAt: new Date("2026-03-19T00:00:00.000Z"),
          accountClassName: "10-A",
        },
      ],
      [{ value: 1 }],
      [{ value: 1 }],
      [{ value: 1 }],
      [{ value: 0 }],
      [{ value: 1 }],
      [],
      [{ id: "student-1", email: "student1@example.com" }],
    );

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/students?includeStats=1"),
    );
    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      success: boolean;
      data: {
        stats?: {
          total: number;
          male: number;
          female: number;
          activeGrades: number;
        } | null;
      };
    };

    expect(payload.success).toBe(true);
    expect(payload.data.stats).toEqual({
      total: 1,
      male: 1,
      female: 0,
      activeGrades: 1,
    });
  });

  it("includes attendance snapshot in admin list response when includeAttendanceToday=1", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "admin-1",
        role: "admin",
      },
    });

    selectResults.push(
      [
        {
          id: "student-1",
          nis: "2324.10.001",
          nisn: null,
          fullName: "Aditya Putra",
          gender: "L",
          grade: "10-A",
          parentName: null,
          parentPhone: null,
          tempatLahir: null,
          tanggalLahir: null,
          alamat: null,
          createdAt: new Date("2026-03-19T00:00:00.000Z"),
          accountClassName: "10-A",
        },
      ],
      [{ value: 1 }],
      [],
      [
        {
          studentId: "student-1",
          status: "PRESENT",
          checkInTime: new Date("2026-03-27T07:01:00.000Z"),
          checkOutTime: null,
          updatedAt: new Date("2026-03-27T07:01:00.000Z"),
        },
      ],
      [],
      [{ id: "student-1", email: "student1@example.com" }],
    );

    const { GET } = await import("./route");
    const response = await GET(
      new Request(
        "http://localhost/api/students?includeAttendanceToday=1&date=2026-03-27",
      ),
    );
    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      success: boolean;
      data: {
        data: Array<{
          attendanceToday?: {
            status: string;
            source: string;
          } | null;
        }>;
      };
    };

    expect(payload.success).toBe(true);
    expect(payload.data.data[0]?.attendanceToday).toEqual({
      studentId: "student-1",
      status: "present",
      source: "qr",
      checkInTime: "2026-03-27T07:01:00.000Z",
      checkOutTime: null,
    });
  });
});
