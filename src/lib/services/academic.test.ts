import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
}));

vi.mock("../db", () => ({
  getDb: getDbMock,
}));

vi.mock("@/core/db/connection", () => ({
  getDatabase: getDbMock,
  getDb: getDbMock,
}));

type SelectResult = unknown[];
type SelectQuery = Promise<SelectResult> & {
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  leftJoin: ReturnType<typeof vi.fn>;
  innerJoin: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
};

function createSelectQuery(result: SelectResult): SelectQuery {
  const promise = Promise.resolve(result) as SelectQuery;
  promise.from = vi.fn().mockReturnValue(promise);
  promise.where = vi.fn().mockReturnValue(promise);
  promise.limit = vi.fn().mockResolvedValue(result);
  promise.leftJoin = vi.fn().mockReturnValue(promise);
  promise.innerJoin = vi.fn().mockReturnValue(promise);
  promise.orderBy = vi.fn().mockReturnValue(promise);
  return promise;
}

describe("Academic Service", () => {
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
    vi.spyOn(crypto, "randomUUID").mockReturnValue("test-uuid");
  });

  it("adds a class successfully", async () => {
    const { addClass } = await import("./academic");
    selectResults.push([], []);

    const result = await addClass({
      name: "Class 1A",
      academicYear: "2025/2026",
    });

    expect(result.success).toBe(true);
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "test-uuid",
        name: "Class 1A",
        academicYear: "2025/2026",
        syncStatus: "pending",
      }),
    );
  }, 20000);

  it("allows the same class name in a different academic year", async () => {
    const { addClass } = await import("./academic");
    selectResults.push([]);

    const result = await addClass({
      name: "Class 1A",
      academicYear: "2026/2027",
    });

    expect(result.success).toBe(true);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("blocks duplicate class identity in the same academic year", async () => {
    const { addClass } = await import("./academic");
    selectResults.push([{ id: "class-existing" }]);

    const result = await addClass({
      name: "Class 1A",
      academicYear: "2025/2026",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("CLASS_EXISTS");
    }
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("updates a class successfully", async () => {
    const { updateClass } = await import("./academic");
    selectResults.push([{ id: "class-id" }], [], []);

    const result = await updateClass("class-id", {
      name: "Class 1B",
      academicYear: "2025/2026",
    });

    expect(result.success).toBe(true);
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Class 1B",
        syncStatus: "pending",
      }),
    );
  });

  it("blocks class deletion when still used by related modules", async () => {
    const { deleteClass } = await import("./academic");
    selectResults.push(
      [{ id: "class-id" }],
      [{ id: "student-1" }],
      [],
      [],
      [],
      [],
      [],
    );

    const result = await deleteClass("class-id");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("CLASS_IN_USE");
    }
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("soft deletes a class successfully", async () => {
    const { deleteClass } = await import("./academic");
    selectResults.push([{ id: "class-id" }], [], [], [], [], [], [], []);

    const result = await deleteClass("class-id");

    expect(result.success).toBe(true);
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        deletedAt: expect.any(Date),
        syncStatus: "pending",
      }),
    );
  });

  it("blocks class deletion when legacy jadwal rows still reference the class", async () => {
    const { deleteClass } = await import("./academic");
    selectResults.push(
      [{ id: "class-id" }],
      [],
      [],
      [],
      [{ id: "jadwal-legacy" }],
      [],
      [],
      [],
    );

    const result = await deleteClass("class-id");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("CLASS_IN_USE");
    }
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("adds a subject successfully", async () => {
    const { addSubject } = await import("./academic");
    selectResults.push([]);

    const result = await addSubject({
      name: "Mathematics",
      code: "MATH101",
    });

    expect(result.success).toBe(true);
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "test-uuid",
        name: "Mathematics",
        code: "MATH101",
        syncStatus: "pending",
      }),
    );
  });

  it("restores a soft-deleted subject when code is reused", async () => {
    const { addSubject } = await import("./academic");
    selectResults.push([
      {
        id: "subject-legacy",
        deletedAt: new Date("2026-03-27T00:00:00.000Z"),
      },
    ]);

    const result = await addSubject({
      name: "Matematika",
      code: "MTK-X",
    });

    expect(result).toEqual({
      success: true,
      id: "subject-legacy",
    });
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Matematika",
        code: "MTK-X",
        deletedAt: null,
        syncStatus: "pending",
      }),
    );
  });

  it("blocks subject deletion when legacy jadwal rows still reference the subject", async () => {
    const { deleteSubject } = await import("./academic");
    selectResults.push(
      [{ id: "subject-id" }],
      [],
      [{ id: "jadwal-legacy" }],
      [],
    );

    const result = await deleteSubject("subject-id");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("SUBJECT_IN_USE");
    }
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("adds a canonical jadwal successfully", async () => {
    const { addSchedule } = await import("./academic");
    selectResults.push(
      [
        {
          id: "11111111-1111-4111-8111-111111111111",
          guruId: "22222222-2222-4222-8222-222222222222",
          guruName: "Budi",
          mataPelajaranId: "33333333-3333-4333-8333-333333333333",
          mataPelajaranName: "Matematika",
          kelasId: "44444444-4444-4444-8444-444444444444",
          kelasName: "7A",
          semesterId: "55555555-5555-4555-8555-555555555555",
          semesterName: "Ganjil",
        },
      ],
      [],
    );

    const result = await addSchedule({
      guruMapelId: "11111111-1111-4111-8111-111111111111",
      hari: 1,
      jamMulai: "07:00",
      jamSelesai: "08:00",
      ruangan: "Lab 1",
    });

    expect(result.success).toBe(true);
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "test-uuid",
        guruMapelId: "11111111-1111-4111-8111-111111111111",
        hari: 1,
        jamMulai: "07:00",
        jamSelesai: "08:00",
        ruangan: "Lab 1",
        syncStatus: "pending",
      }),
    );
  });

  it("blocks canonical jadwal creation when teacher schedule conflicts", async () => {
    const { addSchedule } = await import("./academic");
    selectResults.push(
      [
        {
          id: "11111111-1111-4111-8111-111111111111",
          guruId: "22222222-2222-4222-8222-222222222222",
          guruName: "Budi",
          mataPelajaranId: "33333333-3333-4333-8333-333333333333",
          mataPelajaranName: "Matematika",
          kelasId: "44444444-4444-4444-8444-444444444444",
          kelasName: "7A",
          semesterId: "55555555-5555-4555-8555-555555555555",
          semesterName: "Ganjil",
        },
      ],
      [
        {
          id: "66666666-6666-4666-8666-666666666666",
          guruMapelId: "77777777-7777-4777-8777-777777777777",
          hari: 1,
          jamMulai: "07:30",
          jamSelesai: "08:30",
          ruangan: "Lab 2",
          guruId: "22222222-2222-4222-8222-222222222222",
          guruName: "Budi",
          kelasId: "88888888-8888-4888-8888-888888888888",
          kelasName: "7B",
          mataPelajaranName: "IPA",
        },
      ],
    );

    const result = await addSchedule({
      guruMapelId: "11111111-1111-4111-8111-111111111111",
      hari: 1,
      jamMulai: "07:00",
      jamSelesai: "08:00",
      ruangan: "Lab 1",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("TEACHER_SCHEDULE_CONFLICT");
    }
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("blocks teaching assignment update when canonical jadwal already exists", async () => {
    const { updateTeachingAssignment } = await import("./academic");
    selectResults.push(
      [
        {
          id: "11111111-1111-4111-8111-111111111111",
          guruId: "22222222-2222-4222-8222-222222222222",
          mataPelajaranId: "33333333-3333-4333-8333-333333333333",
          kelasId: "44444444-4444-4444-8444-444444444444",
          semesterId: "55555555-5555-4555-8555-555555555555",
        },
      ],
      [{ id: "99999999-9999-4999-8999-999999999999" }],
      [{ id: "33333333-3333-4333-8333-333333333333" }],
      [{ id: "44444444-4444-4444-8444-444444444444" }],
      [{ id: "55555555-5555-4555-8555-555555555555" }],
      [],
      [{ id: "66666666-6666-4666-8666-666666666666" }],
    );

    const result = await updateTeachingAssignment(
      "11111111-1111-4111-8111-111111111111",
      {
        guruId: "99999999-9999-4999-8999-999999999999",
        mataPelajaranId: "33333333-3333-4333-8333-333333333333",
        kelasId: "44444444-4444-4444-8444-444444444444",
        semesterId: "55555555-5555-4555-8555-555555555555",
      },
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("TEACHING_ASSIGNMENT_IN_USE");
    }
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("soft deletes a canonical jadwal successfully", async () => {
    const { deleteSchedule } = await import("./academic");
    selectResults.push([{ id: "jadwal-1" }]);

    const result = await deleteSchedule("jadwal-1");

    expect(result.success).toBe(true);
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        deletedAt: expect.any(Date),
        syncStatus: "pending",
      }),
    );
  });
});
