import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordBulkAttendance } from "@/core/services/attendance-service";
import { getDb } from "../db";

vi.mock("../db", () => ({
  getDb: vi.fn(),
}));

type MockFn = ReturnType<typeof vi.fn>;

describe("Attendance Service", () => {
  const mockTx: {
    select: MockFn;
    from: MockFn;
    where: MockFn;
    limit: MockFn;
    update: MockFn;
    set: MockFn;
    insert: MockFn;
    values: MockFn;
  } = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
  };

  const mockDb: {
    transaction: MockFn;
    select: MockFn;
    from: MockFn;
    where: MockFn;
    limit: MockFn;
  } = {
    transaction: vi
      .fn()
      .mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) =>
        cb(mockTx),
      ),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  };

  const mockedGetDb = vi.mocked(getDb);

  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetDb.mockResolvedValue(mockDb as never);
  });

  const validBulkData = {
    classId: "550e8400-e29b-41d4-a716-446655440000",
    date: "2026-02-07",
    recordedBy: "550e8400-e29b-41d4-a716-446655440001",
    records: [
      {
        studentId: "550e8400-e29b-41d4-a716-446655440002",
        status: "present" as const,
        notes: "Good",
      },
      {
        studentId: "550e8400-e29b-41d4-a716-446655440003",
        status: "sick" as const,
        notes: "Flu",
      },
    ],
  };

  it("should record bulk attendance with new entries (insert)", async () => {
    mockTx.limit.mockResolvedValue([]); // No existing records

    const result = await recordBulkAttendance(validBulkData);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Data absensi berhasil disimpan");
  });

  it("should update existing attendance records", async () => {
    // Mock existing record for first student
    mockTx.limit.mockResolvedValueOnce([{ id: "existing-id" }]);
    // No existing for second student
    mockTx.limit.mockResolvedValueOnce([]);

    const result = await recordBulkAttendance(validBulkData);

    expect(result.success).toBe(true);
  });

  it("should handle database errors gracefully", async () => {
    // Mock error in the for loop or transaction
    mockTx.insert.mockRejectedValue(new Error("DB Error"));

    const result = await recordBulkAttendance(validBulkData);

    expect(result.success).toBe(false);
    expect(result.message).toBe("Gagal menyimpan data absensi");
  });
});
