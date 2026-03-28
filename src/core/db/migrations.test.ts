import { describe, expect, it, vi } from "vitest";
import type { DatabaseLike } from "./migrations";

type MockSelectQueueItem = unknown[];

function createMockDb(selectQueue: MockSelectQueueItem[]): DatabaseLike & {
  execute: ReturnType<typeof vi.fn>;
} {
  const selectMock: DatabaseLike["select"] = async <T>() =>
    (selectQueue.shift() ?? []) as T[];

  return {
    select: selectMock,
    execute: vi.fn(async () => ({
      rowsAffected: 1,
      lastInsertId: 1,
    })),
  };
}

describe("legacy schedule migration backfill", () => {
  it("creates canonical jadwal when exactly one guru_mapel match exists", async () => {
    const { __test__ } = await import("./migrations");
    const db = createMockDb([
      [
        {
          id: "schedule-1",
          class_id: "class-1",
          subject_id: "subject-1",
          teacher_id: "teacher-1",
          day_of_week: 1,
          start_time: "07:00",
          end_time: "08:00",
          room: "A-1",
          created_at: 1000,
          updated_at: 1000,
          deleted_at: null,
          version: 2,
          hlc: "hlc-1",
          sync_status: "pending",
        },
      ],
      [],
      [{ id: "gm-1" }],
    ]);
    vi.spyOn(crypto, "randomUUID").mockReturnValue("jadwal-new");

    const result = await __test__.backfillLegacyScheduleToJadwal(db);

    expect(result).toEqual({
      inserted: 1,
      skippedExisting: 0,
      skippedAmbiguous: 0,
      skippedMissingAssignment: 0,
    });
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO jadwal"),
      expect.arrayContaining(["jadwal-new", "gm-1", 1, "07:00", "08:00"]),
    );
  });

  it("skips legacy rows when multiple guru_mapel matches make mapping ambiguous", async () => {
    const { __test__ } = await import("./migrations");
    const db = createMockDb([
      [
        {
          id: "schedule-1",
          class_id: "class-1",
          subject_id: "subject-1",
          teacher_id: "teacher-1",
          day_of_week: 1,
          start_time: "07:00",
          end_time: "08:00",
          room: null,
          created_at: 1000,
          updated_at: 1000,
          deleted_at: null,
          version: 1,
          hlc: null,
          sync_status: "pending",
        },
      ],
      [],
      [{ id: "gm-1" }, { id: "gm-2" }],
    ]);

    const result = await __test__.backfillLegacyScheduleToJadwal(db);

    expect(result).toEqual({
      inserted: 0,
      skippedExisting: 0,
      skippedAmbiguous: 1,
      skippedMissingAssignment: 0,
    });
    expect(db.execute).not.toHaveBeenCalled();
  });
});
