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

describe("Academic Service", () => {
  let mockDb: {
    select: ReturnType<typeof vi.fn>;
    from: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    leftJoin: ReturnType<typeof vi.fn>;
    orderBy: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    values: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };

    getDbMock.mockResolvedValue(mockDb);
    vi.spyOn(crypto, "randomUUID").mockReturnValue("test-uuid");
  });

  it("adds a class successfully", async () => {
    const { addClass } = await import("./academic");

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

  it("updates a class successfully", async () => {
    const { updateClass } = await import("./academic");

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
  }, 20000);

  it("soft deletes a class successfully", async () => {
    const { deleteClass } = await import("./academic");

    const result = await deleteClass("class-id");

    expect(result.success).toBe(true);
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        deletedAt: expect.any(Date),
        syncStatus: "pending",
      }),
    );
  }, 20000);

  it("adds a subject successfully", async () => {
    const { addSubject } = await import("./academic");

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
  }, 20000);
});
