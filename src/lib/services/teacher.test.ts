import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserInsertInput } from "../validations/schemas";

const { getDbMock, hashPasswordMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  hashPasswordMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: getDbMock,
}));

vi.mock("@/core/db/connection", () => ({
  getDatabase: getDbMock,
  getDb: getDbMock,
}));

vi.mock("@/lib/auth/hash", () => ({
  hashPassword: hashPasswordMock,
}));

type SelectResult = unknown[];
type SelectQuery = Promise<SelectResult> & {
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  innerJoin: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
};

function createSelectQuery(result: SelectResult): SelectQuery {
  const promise = Promise.resolve(result) as SelectQuery;
  promise.from = vi.fn().mockReturnValue(promise);
  promise.where = vi.fn().mockReturnValue(promise);
  promise.limit = vi.fn().mockResolvedValue(result);
  promise.innerJoin = vi.fn().mockReturnValue(promise);
  promise.orderBy = vi.fn().mockReturnValue(promise);
  return promise;
}

describe("Teacher Service", () => {
  let selectResults: SelectResult[];
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

    hashPasswordMock.mockResolvedValue("hashed_password");
    selectResults = [];

    mockDb = {
      select: vi.fn(() => createSelectQuery(selectResults.shift() ?? [])),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    };

    getDbMock.mockResolvedValue(mockDb);
  });

  const validTeacherData: UserInsertInput = {
    fullName: "Guru Baru",
    email: "guru.baru@example.com",
    role: "teacher",
    password: "password123",
  };

  it("adds a teacher when email is unique", async () => {
    const { addTeacher } = await import("./teacher");
    selectResults.push([]);
    vi.spyOn(crypto, "randomUUID").mockReturnValue("teacher-id");

    const result = await addTeacher(validTeacherData);

    expect(result.success).toBe(true);
    expect(mockDb.insert).toHaveBeenCalled();
    expect(hashPasswordMock).toHaveBeenCalledWith("password123");
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "teacher-id",
        fullName: "Guru Baru",
        email: "guru.baru@example.com",
        role: "teacher",
        passwordHash: "hashed_password",
      }),
    );
  }, 20000);

  it("fails when email already exists", async () => {
    const { addTeacher } = await import("./teacher");
    selectResults.push([{ id: "existing-id", deletedAt: null }]);

    const result = await addTeacher(validTeacherData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("EMAIL_EXISTS");
    }
    expect(mockDb.insert).not.toHaveBeenCalled();
  }, 20000);

  it("restores a soft-deleted teacher when email is reused", async () => {
    const { addTeacher } = await import("./teacher");
    selectResults.push([
      {
        id: "deleted-teacher-id",
        deletedAt: new Date("2026-03-27T00:00:00.000Z"),
        role: "teacher",
      },
    ]);

    const result = await addTeacher(validTeacherData);

    expect(result).toEqual({ success: true, id: "deleted-teacher-id" });
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "guru.baru@example.com",
        deletedAt: null,
        passwordHash: "hashed_password",
        syncStatus: "pending",
      }),
    );
  });

  it("handles database errors when saving", async () => {
    const { addTeacher } = await import("./teacher");
    selectResults.push([]);
    mockDb.values.mockRejectedValue(new Error("Database Failure"));

    const result = await addTeacher(validTeacherData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Gagal");
    }
  }, 20000);

  describe("getTeachers", () => {
    it("returns teacher rows with default filters", async () => {
      const { getTeachers } = await import("./teacher");
      const rows = [
        {
          id: "1",
          fullName: "Guru 1",
          email: "guru1@example.com",
          role: "teacher",
          nip: null,
          jenisKelamin: null,
          tempatLahir: null,
          tanggalLahir: null,
          alamat: null,
          noTelepon: null,
          isActive: true,
        },
      ];
      selectResults.push(rows);
      selectResults.push([]);

      const result = await getTeachers();

      expect(result).toEqual([
        expect.objectContaining({
          id: "1",
          fullName: "Guru 1",
          role: "teacher",
          isHomeroomTeacher: false,
        }),
      ]);
      const query = mockDb.select.mock.results[0]?.value;
      expect(query.orderBy).toHaveBeenCalled();
    }, 20000);

    it("returns empty results cleanly", async () => {
      const { getTeachers } = await import("./teacher");
      selectResults.push([]);

      const result = await getTeachers();

      expect(result).toEqual([]);
    }, 20000);
  });

  describe("deleteTeacher", () => {
    it("returns success on successful deletion", async () => {
      const { deleteTeacher } = await import("./teacher");
      selectResults.push([{ id: "teacher-id" }], [], [], []);

      const result = await deleteTeacher("some-id");

      expect(result).toEqual({ success: true });
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false,
          syncStatus: "pending",
          updatedAt: expect.any(Date),
          deletedAt: expect.any(Date),
        }),
      );
    }, 20000);

    it("blocks deletion when direct schedule rows still reference the teacher", async () => {
      const { deleteTeacher } = await import("./teacher");
      selectResults.push(
        [{ id: "teacher-id" }],
        [],
        [{ id: "schedule-id" }],
        [],
      );

      const result = await deleteTeacher("some-id");

      expect(result).toEqual({
        success: false,
        error:
          "Guru masih dipakai assignment atau jadwal. Lepaskan relasi tersebut terlebih dahulu sebelum menghapus guru.",
        code: "TEACHER_IN_USE",
      });
      expect(mockDb.update).not.toHaveBeenCalled();
    }, 20000);

    it("returns error result on failure", async () => {
      const { deleteTeacher } = await import("./teacher");
      mockDb.select.mockImplementation(() => {
        throw new Error("Delete failed");
      });

      const result = await deleteTeacher("some-id");

      expect(result).toEqual({
        success: false,
        error: "Gagal menghapus guru. Kesalahan sistem.",
        code: "INTERNAL_ERROR",
      });
    }, 20000);
  });
});
