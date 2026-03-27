import { beforeEach, describe, expect, it, vi } from "vitest";

const getDbMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  getDb: getDbMock,
}));

import { recordBulkAttendance } from "./attendance-service";

type FakeDbOptions = {
  selectResults: unknown[];
  updateErrorCalls?: number[];
  insertErrorCalls?: number[];
};

function createFakeQuery(result: unknown) {
  const query = Promise.resolve(result) as Promise<unknown> & {
    from: () => typeof query;
    where: () => typeof query;
    leftJoin: () => typeof query;
    innerJoin: () => typeof query;
    orderBy: () => typeof query;
    limit: () => Promise<unknown>;
  };

  query.from = () => query;
  query.where = () => query;
  query.leftJoin = () => query;
  query.innerJoin = () => query;
  query.orderBy = () => query;
  query.limit = () => Promise.resolve(result);

  return query;
}

function createFakeDb(options: FakeDbOptions) {
  let selectCall = 0;
  let updateCall = 0;
  let insertCall = 0;

  return {
    select() {
      const result = options.selectResults[selectCall];
      selectCall += 1;
      return createFakeQuery(result);
    },
    update() {
      return {
        set() {
          return {
            where() {
              updateCall += 1;
              if (options.updateErrorCalls?.includes(updateCall)) {
                return Promise.reject(new Error("update failed"));
              }
              return Promise.resolve();
            },
          };
        },
      };
    },
    insert() {
      return {
        values() {
          insertCall += 1;
          if (options.insertErrorCalls?.includes(insertCall)) {
            return Promise.reject(new Error("insert failed"));
          }
          return Promise.resolve();
        },
      };
    },
  };
}

describe("recordBulkAttendance", () => {
  beforeEach(() => {
    getDbMock.mockReset();
  });

  it("returns partial success when one student write fails", async () => {
    const classId = "550e8400-e29b-41d4-a716-446655440000";
    const recorderId = "550e8400-e29b-41d4-a716-446655440099";
    const studentOne = "550e8400-e29b-41d4-a716-446655440001";
    const studentTwo = "550e8400-e29b-41d4-a716-446655440002";

    getDbMock.mockResolvedValue(
      createFakeDb({
        selectResults: [
          [{ id: classId, name: "X-A" }],
          [
            { id: studentOne, fullName: "Budi", nis: "1" },
            { id: studentTwo, fullName: "Siti", nis: "2" },
          ],
          [],
          [{ id: recorderId }],
          [{ id: studentOne }, { id: studentTwo }],
          [{ id: "attendance-existing-1" }],
          [],
        ],
        insertErrorCalls: [1],
      }),
    );

    const result = await recordBulkAttendance({
      classId,
      date: "2026-03-27",
      recordedBy: recorderId,
      records: [
        { studentId: studentOne, status: "present", notes: "" },
        { studentId: studentTwo, status: "alpha", notes: "Tidak hadir" },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.partial).toBe(true);
    expect(result.successCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.failures).toEqual([
      {
        studentId: studentTwo,
        message: "Gagal menyimpan absensi siswa ini",
      },
    ]);
  });

  it("returns failure when all student writes fail", async () => {
    const classId = "550e8400-e29b-41d4-a716-446655440000";
    const recorderId = "550e8400-e29b-41d4-a716-446655440099";
    const studentOne = "550e8400-e29b-41d4-a716-446655440001";
    const studentTwo = "550e8400-e29b-41d4-a716-446655440002";

    getDbMock.mockResolvedValue(
      createFakeDb({
        selectResults: [
          [{ id: classId, name: "X-A" }],
          [
            { id: studentOne, fullName: "Budi", nis: "1" },
            { id: studentTwo, fullName: "Siti", nis: "2" },
          ],
          [],
          [{ id: recorderId }],
          [{ id: studentOne }, { id: studentTwo }],
          [],
          [],
        ],
        insertErrorCalls: [1, 2],
      }),
    );

    const result = await recordBulkAttendance({
      classId,
      date: "2026-03-27",
      recordedBy: recorderId,
      records: [
        { studentId: studentOne, status: "present", notes: "" },
        { studentId: studentTwo, status: "alpha", notes: "Tidak hadir" },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.successCount).toBe(0);
    expect(result.failedCount).toBe(2);
    expect(result.message).toBe("Gagal menyimpan absensi untuk 2 siswa");
  });
});
