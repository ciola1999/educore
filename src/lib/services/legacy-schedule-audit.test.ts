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

describe("legacy schedule audit service", () => {
  let selectResults: SelectResult[];

  beforeEach(() => {
    vi.clearAllMocks();
    selectResults = [];
    getDbMock.mockResolvedValue({
      select: vi.fn(() => createSelectQuery(selectResults.shift() ?? [])),
    });
  });

  it("classifies legacy rows by canonical and assignment state", async () => {
    const { getLegacyScheduleAuditReport } = await import(
      "./legacy-schedule-audit"
    );

    selectResults.push(
      [
        {
          id: "legacy-1",
          classId: "class-1",
          className: "X-A",
          subjectId: "subject-1",
          subjectName: "Math",
          teacherId: "teacher-1",
          teacherName: "Guru 1",
          dayOfWeek: 1,
          startTime: "07:00",
          endTime: "08:00",
          room: "A1",
        },
        {
          id: "legacy-2",
          classId: "class-2",
          className: "X-B",
          subjectId: "subject-2",
          subjectName: "IPA",
          teacherId: "teacher-2",
          teacherName: "Guru 2",
          dayOfWeek: 2,
          startTime: "08:00",
          endTime: "09:00",
          room: null,
        },
      ],
      [{ id: "jadwal-1" }],
      [
        {
          id: "gm-1",
          guruName: "Guru 1",
          mataPelajaranName: "Math",
          kelasName: "X-A",
          semesterName: "Ganjil",
          tahunAjaranNama: "2025/2026",
        },
      ],
      [],
      [
        {
          id: "gm-2",
          guruName: "Guru 2",
          mataPelajaranName: "IPA",
          kelasName: "X-B",
          semesterName: "Ganjil",
          tahunAjaranNama: "2025/2026",
        },
        {
          id: "gm-3",
          guruName: "Guru 2",
          mataPelajaranName: "IPA",
          kelasName: "X-B",
          semesterName: "Genap",
          tahunAjaranNama: "2025/2026",
        },
      ],
    );

    const report = await getLegacyScheduleAuditReport();

    expect(report.totalLegacyRows).toBe(2);
    expect(report.summary.already_canonical).toBe(1);
    expect(report.summary.ambiguous_assignment).toBe(1);
    expect(report.items).toEqual([
      expect.objectContaining({
        legacyScheduleId: "legacy-1",
        status: "already_canonical",
      }),
      expect.objectContaining({
        legacyScheduleId: "legacy-2",
        status: "ambiguous_assignment",
        matchingAssignments: [
          expect.objectContaining({ id: "gm-2", semesterName: "Ganjil" }),
          expect.objectContaining({ id: "gm-3", semesterName: "Genap" }),
        ],
      }),
    ]);
  });

  it("returns retired state when legacy schedule table is missing behind wrapped db error", async () => {
    const { getLegacyScheduleAuditReport } = await import(
      "./legacy-schedule-audit"
    );

    getDbMock.mockResolvedValue({
      select: vi.fn(() => {
        throw new Error("Failed query", {
          cause: {
            message: "SQLite error: no such table: schedule",
            code: "SQLITE_UNKNOWN",
          },
        });
      }),
    });

    const report = await getLegacyScheduleAuditReport();

    expect(report).toEqual({
      legacyTableAvailable: false,
      totalLegacyRows: 0,
      filteredRows: 0,
      summary: {
        already_canonical: 0,
        ready_to_backfill: 0,
        ambiguous_assignment: 0,
        missing_assignment: 0,
      },
      items: [],
    });
  });
});
