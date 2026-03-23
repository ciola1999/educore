import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: getDbMock,
}));

vi.mock("@/core/db/connection", () => ({
  getDatabase: getDbMock,
  getDb: getDbMock,
}));

type SelectPlan = {
  whereResult?: unknown;
  limitResult?: unknown;
};

type SelectQuery = {
  from: () => SelectQuery;
  where: () => SelectQuery | Promise<unknown>;
  limit: () => Promise<unknown>;
};

function createSelectQuery(plan: SelectPlan) {
  const query = {} as SelectQuery;

  query.from = vi.fn(() => query);

  if (plan.whereResult !== undefined && plan.limitResult === undefined) {
    query.where = vi.fn(async () => plan.whereResult);
    query.limit = vi.fn();
    return query;
  }

  query.where = vi.fn(() => query);
  query.limit = vi.fn(async () => plan.limitResult ?? []);
  return query;
}

function createMockDb(selectPlans: SelectPlan[]) {
  const db = {} as {
    select: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    values: ReturnType<typeof vi.fn>;
  };

  db.select = vi.fn(() => createSelectQuery(selectPlans.shift() ?? {}));
  db.update = vi.fn(() => db);
  db.set = vi.fn(() => db);
  db.where = vi.fn(async () => undefined);
  db.insert = vi.fn(() => db);
  db.values = vi.fn(async () => undefined);

  return db;
}

describe("Attendance Service", () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let selectPlans: SelectPlan[];

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

  beforeEach(() => {
    vi.clearAllMocks();
    selectPlans = [];
    mockDb = createMockDb(selectPlans);
    getDbMock.mockResolvedValue(mockDb);
    vi.spyOn(crypto, "randomUUID").mockReturnValue("attendance-id");
  });

  it("records bulk attendance with new entries", async () => {
    const { recordBulkAttendance } = await import(
      "@/core/services/attendance-service"
    );

    selectPlans.push(
      {
        limitResult: [{ id: validBulkData.classId, name: "10-A" }],
      },
      {
        whereResult: [
          { id: validBulkData.records[0].studentId },
          { id: validBulkData.records[1].studentId },
        ],
      },
      { limitResult: [] },
      { limitResult: [{ id: validBulkData.recordedBy }] },
      {
        whereResult: [
          { id: validBulkData.records[0].studentId },
          { id: validBulkData.records[1].studentId },
        ],
      },
      { limitResult: [] },
      { limitResult: [] },
    );

    const result = await recordBulkAttendance(validBulkData);

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
      }),
    );
    expect(result.success).toBe(true);
    expect(result.message).toContain("Data absensi berhasil disimpan");
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "attendance-id",
        classId: validBulkData.classId,
        recordedBy: validBulkData.recordedBy,
        syncStatus: "pending",
      }),
    );
  }, 20000);

  it("updates existing attendance records", async () => {
    const { recordBulkAttendance } = await import(
      "@/core/services/attendance-service"
    );

    selectPlans.push(
      {
        limitResult: [{ id: validBulkData.classId, name: "10-A" }],
      },
      {
        whereResult: [
          { id: validBulkData.records[0].studentId },
          { id: validBulkData.records[1].studentId },
        ],
      },
      { limitResult: [] },
      { limitResult: [{ id: validBulkData.recordedBy }] },
      {
        whereResult: [
          { id: validBulkData.records[0].studentId },
          { id: validBulkData.records[1].studentId },
        ],
      },
      { limitResult: [{ id: "existing-id" }] },
      { limitResult: [] },
    );

    const result = await recordBulkAttendance(validBulkData);

    expect(result.success).toBe(true);
    expect(mockDb.update).toHaveBeenCalled();
  }, 20000);

  it("handles database errors gracefully after validation passes", async () => {
    const { recordBulkAttendance } = await import(
      "@/core/services/attendance-service"
    );

    selectPlans.push(
      { limitResult: [{ id: validBulkData.classId, name: "10-A" }] },
      {
        whereResult: [
          { id: validBulkData.records[0].studentId },
          { id: validBulkData.records[1].studentId },
        ],
      },
      { limitResult: [] },
      { limitResult: [{ id: validBulkData.recordedBy }] },
      {
        whereResult: [
          { id: validBulkData.records[0].studentId },
          { id: validBulkData.records[1].studentId },
        ],
      },
      { limitResult: [] },
      { limitResult: [] },
    );
    mockDb.values.mockRejectedValueOnce(new Error("DB Error"));

    const result = await recordBulkAttendance(validBulkData);

    expect(result.success).toBe(false);
    expect(result.message).toBe("Gagal menyimpan data absensi");
  });

  it("rejects students outside the selected class roster", async () => {
    const { recordBulkAttendance } = await import(
      "@/core/services/attendance-service"
    );

    selectPlans.push(
      { limitResult: [{ id: validBulkData.classId, name: "10-A" }] },
      {
        whereResult: [{ id: validBulkData.records[0].studentId }],
      },
      { limitResult: [] },
      { limitResult: [{ id: validBulkData.recordedBy }] },
      {
        whereResult: [
          { id: validBulkData.records[0].studentId },
          { id: validBulkData.records[1].studentId },
        ],
      },
    );

    const result = await recordBulkAttendance(validBulkData);

    expect(result.success).toBe(false);
    expect(result.message).toBe(
      "Ditemukan siswa di luar roster kelas yang dipilih",
    );
  });
});
