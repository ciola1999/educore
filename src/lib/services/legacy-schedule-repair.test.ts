import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: getDbMock,
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

describe("legacy schedule repair service", () => {
  let selectResults: SelectResult[];
  let txMock: {
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

    txMock = {
      select: vi.fn(() => createSelectQuery(selectResults.shift() ?? [])),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    };

    getDbMock.mockResolvedValue({
      select: vi.fn(() => createSelectQuery(selectResults.shift() ?? [])),
      transaction: vi.fn(
        async (callback: (tx: typeof txMock) => Promise<unknown>) =>
          callback(txMock),
      ),
    });
  });

  it("creates canonical jadwal and retires legacy schedule when one assignment matches", async () => {
    const { repairLegacySchedule } = await import("./legacy-schedule-repair");
    vi.spyOn(crypto, "randomUUID").mockReturnValue("jadwal-new");
    selectResults.push(
      [
        {
          id: "legacy-1",
          classId: "class-1",
          subjectId: "subject-1",
          teacherId: "teacher-1",
          dayOfWeek: 1,
          startTime: "07:00",
          endTime: "08:00",
          room: "A1",
          version: 1,
          hlc: null,
        },
      ],
      [{ id: "gm-1" }],
      [],
    );

    const result = await repairLegacySchedule({ legacyScheduleId: "legacy-1" });

    expect(result).toEqual({
      success: true,
      legacyScheduleId: "legacy-1",
      canonicalJadwalId: "jadwal-new",
      guruMapelId: "gm-1",
      action: "created",
    });
    expect(txMock.insert).toHaveBeenCalledTimes(1);
    expect(txMock.update).toHaveBeenCalledTimes(1);
  });

  it("rejects ambiguous repair without explicit guruMapelId", async () => {
    const { repairLegacySchedule } = await import("./legacy-schedule-repair");
    selectResults.push(
      [
        {
          id: "legacy-1",
          classId: "class-1",
          subjectId: "subject-1",
          teacherId: "teacher-1",
          dayOfWeek: 1,
          startTime: "07:00",
          endTime: "08:00",
          room: null,
          version: 1,
          hlc: null,
        },
      ],
      [{ id: "gm-1" }, { id: "gm-2" }],
    );

    const result = await repairLegacySchedule({ legacyScheduleId: "legacy-1" });

    expect(result).toEqual({
      success: false,
      error:
        "Schedule legacy memiliki lebih dari satu assignment guru-mapel yang cocok. Pilih assignment secara eksplisit.",
      code: "AMBIGUOUS_ASSIGNMENT",
    });
  });

  it("bulk repairs only rows with exactly one matching assignment", async () => {
    const { bulkRepairReadyLegacySchedules } = await import(
      "./legacy-schedule-repair"
    );
    vi.spyOn(crypto, "randomUUID").mockReturnValue("jadwal-bulk");
    selectResults.push(
      [
        {
          id: "legacy-1",
          classId: "class-1",
          subjectId: "subject-1",
          teacherId: "teacher-1",
        },
        {
          id: "legacy-2",
          classId: "class-2",
          subjectId: "subject-2",
          teacherId: "teacher-2",
        },
      ],
      [{ id: "gm-1" }],
      [
        {
          id: "legacy-1",
          classId: "class-1",
          subjectId: "subject-1",
          teacherId: "teacher-1",
          dayOfWeek: 1,
          startTime: "07:00",
          endTime: "08:00",
          room: "A1",
          version: 1,
          hlc: null,
        },
      ],
      [{ id: "gm-1" }],
      [],
      [{ id: "gm-2" }, { id: "gm-3" }],
    );

    const result = await bulkRepairReadyLegacySchedules({ limit: 10 });

    expect(result).toEqual({
      processed: 1,
      created: 1,
      reused: 0,
      skipped: 1,
      failures: [],
    });
  });
});
