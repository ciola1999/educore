import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fullSync, pullFromCloud, pushToCloud } from "./turso-sync";

vi.mock("@/core/env", () => ({
  isWeb: () => false,
  isTauri: () => true,
}));

type TestWindow = {
  __TAURI_INTERNALS__?: Record<string, unknown>;
};

function createAwaitableQuery(
  directResult: unknown[],
  limitResolver: () => Promise<unknown[]>,
) {
  return Object.assign(Promise.resolve(directResult), {
    where: vi.fn(() => ({
      limit: vi.fn(limitResolver),
    })),
  });
}

describe("turso full sync idempotency", () => {
  beforeEach(() => {
    const testWindow = globalThis as typeof globalThis & {
      window?: Window & typeof globalThis & TestWindow;
    };

    if (!testWindow.window) {
      Object.defineProperty(testWindow, "window", {
        value: {} as Window & typeof globalThis & TestWindow,
        configurable: true,
        writable: true,
      });
    }

    testWindow.window.__TAURI_INTERNALS__ = {};
  });
  afterEach(() => {
    const testWindow = globalThis as typeof globalThis & {
      window?: TestWindow;
      navigator?: Navigator;
    };
    delete testWindow.window?.__TAURI_INTERNALS__;
    if (testWindow.navigator) {
      Object.defineProperty(testWindow.navigator, "onLine", {
        value: true,
        configurable: true,
      });
    }
  });

  it("skips direct cloud sync when desktop runtime is offline", async () => {
    Object.defineProperty(globalThis.navigator, "onLine", {
      value: false,
      configurable: true,
    });

    const pullResult = await pullFromCloud({
      tursoCloud: {
        execute: vi.fn(async () => {
          throw new Error("should not hit cloud while offline");
        }),
      } as never,
    });

    const pushResult = await pushToCloud({
      tursoCloud: {
        execute: vi.fn(async () => {
          throw new Error("should not hit cloud while offline");
        }),
      } as never,
    });

    expect(pullResult.status).toBe("error");
    expect(pullResult.message).toContain("offline");
    expect(pushResult.status).toBe("error");
    expect(pushResult.message).toContain("offline");
  });

  it("does not report phantom downloaded records on repeated full sync", async () => {
    let insertedRecord: Record<string, unknown> | null = null;
    let selectCallCount = 0;

    const dbMock = {
      select: vi.fn(() => ({
        from: vi.fn(() =>
          createAwaitableQuery([], async () => {
            // users existingById (first full sync -> pull phase) -> not found
            if (selectCallCount === 0) {
              selectCallCount++;
              return [];
            }
            // users existingByKey (first full sync -> pull phase) -> not found
            if (selectCallCount === 1) {
              selectCallCount++;
              return [];
            }
            // users existingById (second full sync -> pull phase) -> found
            selectCallCount++;
            return insertedRecord ? [insertedRecord] : [];
          }),
        ),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(async (payload: Record<string, unknown>) => {
          insertedRecord = {
            ...payload,
            updatedAt:
              payload.updatedAt instanceof Date
                ? payload.updatedAt
                : new Date("2026-03-19T00:00:00.000Z"),
          };
        }),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(async () => {}),
        })),
      })),
    };

    const executeMock = vi.fn(async (input: unknown) => {
      const sql =
        typeof input === "string"
          ? input
          : (input as { sql?: string }).sql || "";
      if (sql.includes('SELECT * FROM "users"')) {
        return {
          rows: [
            {
              id: "cloud-user-1",
              email: "admin@educore.school",
              full_name: "Super Admin",
              role: "admin",
              updated_at: 1_763_251_200,
            },
          ],
        };
      }

      return { rows: [] };
    });

    const syncProjectionMock = vi.fn(async () => {});
    const pushExecutorMock = vi.fn(async () => ({
      status: "success" as const,
      message: "No pending records.",
      uploaded: 0,
    }));

    type FullSyncDeps = NonNullable<Parameters<typeof fullSync>[0]>;
    const firstSync = await fullSync({
      db: dbMock as unknown as FullSyncDeps["db"],
      tursoCloud: {
        execute: executeMock,
      } as unknown as FullSyncDeps["tursoCloud"],
      syncUsersProjection: syncProjectionMock,
      pushExecutor: pushExecutorMock,
      pullExecutor: (deps) => pullFromCloud(deps),
    });
    const secondSync = await fullSync({
      db: dbMock as unknown as FullSyncDeps["db"],
      tursoCloud: {
        execute: executeMock,
      } as unknown as FullSyncDeps["tursoCloud"],
      syncUsersProjection: syncProjectionMock,
      pushExecutor: pushExecutorMock,
      pullExecutor: (deps) => pullFromCloud(deps),
    });

    expect(firstSync.status).toBe("success");
    expect(firstSync.downloaded).toBe(1);
    expect(secondSync.status).toBe("success");
    expect(secondSync.downloaded).toBe(0);
    expect(pushExecutorMock).toHaveBeenCalledTimes(2);
    expect(syncProjectionMock).toHaveBeenCalledTimes(2);
  });

  it("remaps parent ids before inserting dependent records during pull repair", async () => {
    const insertedRecords: Array<Record<string, unknown>> = [];
    const updates: Array<Record<string, unknown>> = [];
    let selectCallCount = 0;

    const dbMock = {
      select: vi.fn(() => ({
        from: vi.fn(() =>
          createAwaitableQuery([], async () => {
            selectCallCount++;

            // tahun_ajaran by id -> miss
            if (selectCallCount === 1) return [];
            // tahun_ajaran by logical key -> local row exists with different id
            if (selectCallCount === 2) {
              return [
                {
                  id: "local-year-1",
                  nama: "2026/2027",
                  updatedAt: new Date("2026-03-01T00:00:00.000Z"),
                  syncStatus: "pending",
                },
              ];
            }
            // semester by id -> miss
            if (selectCallCount === 3) return [];
            // semester by logical key after FK remap -> miss so insert path runs
            if (selectCallCount === 4) return [];

            return [];
          }),
        ),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(async (payload: Record<string, unknown>) => {
          insertedRecords.push(payload);
        }),
      })),
      update: vi.fn(() => ({
        set: vi.fn((payload: Record<string, unknown>) => ({
          where: vi.fn(async () => {
            updates.push(payload);
          }),
        })),
      })),
    };

    const executeMock = vi.fn(async (input: unknown) => {
      const sql =
        typeof input === "string"
          ? input
          : (input as { sql?: string }).sql || "";

      if (sql.includes('SELECT * FROM "tahun_ajaran"')) {
        return {
          rows: [
            {
              id: "cloud-year-1",
              nama: "2026/2027",
              tanggal_mulai: 1_782_777_600,
              tanggal_selesai: 1_814_227_200,
              is_active: 1,
              updated_at: 1_782_777_600,
            },
          ],
        };
      }

      if (sql.includes('SELECT * FROM "semester"')) {
        return {
          rows: [
            {
              id: "cloud-semester-1",
              tahun_ajaran_id: "cloud-year-1",
              nama: "Ganjil",
              tanggal_mulai: 1_782_864_000,
              tanggal_selesai: 1_796_083_200,
              is_active: 1,
              updated_at: 1_782_864_000,
            },
          ],
        };
      }

      return { rows: [] };
    });

    const result = await pullFromCloud({
      db: dbMock as never,
      tursoCloud: {
        execute: executeMock,
      } as never,
      syncUsersProjection: vi.fn(async () => {}),
    });

    expect(result.status).toBe("success");
    expect(updates).toHaveLength(1);
    expect(insertedRecords).toHaveLength(1);
    expect(insertedRecords[0]?.tahunAjaranId).toBe("local-year-1");
  });

  it("repairs user class foreign keys after class id remap before projection runs", async () => {
    const insertedRecords: Array<Record<string, unknown>> = [];
    const updates: Array<Record<string, unknown>> = [];
    let whereLimitCount = 0;

    const dbMock = {
      select: vi.fn(() => ({
        from: vi.fn(() =>
          createAwaitableQuery(
            [
              {
                id: "student-1",
                kelasId: "cloud-class-1",
              },
            ],
            async () => {
              whereLimitCount++;

              // users existingById
              if (whereLimitCount === 1) return [];
              // users existingByKey
              if (whereLimitCount === 2) return [];
              // classes existingById
              if (whereLimitCount === 3) return [];
              // classes existingByKey -> local class already exists with different id
              if (whereLimitCount === 4) {
                return [
                  {
                    id: "local-class-1",
                    name: "X-A",
                    academicYear: "2026/2027",
                    updatedAt: new Date("2026-03-01T00:00:00.000Z"),
                    syncStatus: "pending",
                  },
                ];
              }

              return [];
            },
          ),
        ),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(async (payload: Record<string, unknown>) => {
          insertedRecords.push(payload);
        }),
      })),
      update: vi.fn(() => ({
        set: vi.fn((payload: Record<string, unknown>) => ({
          where: vi.fn(async () => {
            updates.push(payload);
          }),
        })),
      })),
    };

    const executeMock = vi.fn(async (input: unknown) => {
      const sql =
        typeof input === "string"
          ? input
          : (input as { sql?: string }).sql || "";

      if (sql.includes('SELECT * FROM "users"')) {
        return {
          rows: [
            {
              id: "student-1",
              email: "student-1@school.test",
              full_name: "Student One",
              role: "student",
              kelas_id: "cloud-class-1",
              updated_at: 1_782_777_600,
            },
          ],
        };
      }

      if (sql.includes('SELECT * FROM "classes"')) {
        return {
          rows: [
            {
              id: "cloud-class-1",
              name: "X-A",
              academic_year: "2026/2027",
              is_active: 1,
              updated_at: 1_782_777_600,
            },
          ],
        };
      }

      return { rows: [] };
    });

    const syncProjectionMock = vi.fn(async () => {});

    const result = await pullFromCloud({
      db: dbMock as never,
      tursoCloud: {
        execute: executeMock,
      } as never,
      syncUsersProjection: syncProjectionMock,
    });

    expect(result.status).toBe("success");
    expect(insertedRecords).toHaveLength(1);
    expect(updates.some((payload) => payload.kelasId === "local-class-1")).toBe(
      true,
    );
    expect(syncProjectionMock).toHaveBeenCalledTimes(1);
  });

  it("retries full sync after foreign key push failure by pulling first", async () => {
    const pushExecutorMock = vi
      .fn()
      .mockResolvedValueOnce({
        status: "error" as const,
        message:
          "[SYNC_PUSH:semester] Failed to push record sem-1: SQLITE_CONSTRAINT: FOREIGN KEY constraint failed",
      })
      .mockResolvedValueOnce({
        status: "success" as const,
        message: "Pushed 1 records to Turso Cloud.",
        uploaded: 1,
      });

    const pullExecutorMock = vi
      .fn()
      .mockResolvedValueOnce({
        status: "success" as const,
        message: "Sync complete! Downloaded 2 records.",
        downloaded: 2,
      })
      .mockResolvedValueOnce({
        status: "success" as const,
        message: "Sync complete! Downloaded 0 records.",
        downloaded: 0,
      });

    const result = await fullSync({
      pushExecutor: pushExecutorMock,
      pullExecutor: pullExecutorMock,
    });

    expect(result.status).toBe("success");
    expect(pushExecutorMock).toHaveBeenCalledTimes(2);
    expect(pullExecutorMock).toHaveBeenCalledTimes(2);
    expect(result.message).toContain("recovered after foreign key repair");
  });

  it("reports both push and pull results on a successful full sync", async () => {
    const pushExecutorMock = vi.fn(async () => ({
      status: "success" as const,
      message: "Pushed 3 records to Turso Cloud.",
      uploaded: 3,
    }));

    const pullExecutorMock = vi.fn(async () => ({
      status: "success" as const,
      message: "Sync complete! Downloaded 1 records.",
      downloaded: 1,
    }));

    const result = await fullSync({
      pushExecutor: pushExecutorMock,
      pullExecutor: pullExecutorMock,
    });

    expect(result.status).toBe("success");
    expect(result.message).toContain("Pushed 3 records to Turso Cloud.");
    expect(result.message).toContain("Sync complete! Downloaded 1 records.");
    expect(result.uploaded).toBe(3);
    expect(result.downloaded).toBe(1);
  });

  it("reuses the remote guru-mapel id when class changes but teacher-subject-semester identity stays unique", async () => {
    const syncedUpdates: Array<Record<string, unknown>> = [];
    let pendingSelectServed = false;

    const dbMock = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => {
            if (!pendingSelectServed) {
              pendingSelectServed = true;
              return Promise.resolve([
                {
                  id: "local-assignment-1",
                  guruId: "remote-teacher-1",
                  mataPelajaranId: "remote-subject-1",
                  kelasId: "remote-class-2",
                  semesterId: "remote-semester-1",
                  updatedAt: new Date("2026-03-31T00:00:00.000Z"),
                  syncStatus: "pending",
                },
              ]);
            }

            return {
              limit: vi.fn(async () => []),
            };
          }),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((payload: Record<string, unknown>) => ({
          where: vi.fn(async () => {
            syncedUpdates.push(payload);
          }),
        })),
      })),
    };

    const executeMock = vi.fn(async (input: unknown) => {
      const statement =
        typeof input === "string"
          ? { sql: input, args: [] as unknown[] }
          : ((input as { sql?: string; args?: unknown[] }) ?? {
              sql: "",
              args: [],
            });
      const sql = statement.sql ?? "";

      if (
        sql.includes('SELECT id FROM "guru_mapel" WHERE "guru_id" = ?') &&
        sql.includes('"kelas_id" = ?')
      ) {
        return { rows: [] };
      }

      if (
        sql.includes('SELECT id FROM "guru_mapel" WHERE "guru_id" = ?') &&
        !sql.includes('"kelas_id" = ?')
      ) {
        return {
          rows: [{ id: "remote-assignment-1" }],
        };
      }

      if (sql.includes('INSERT INTO "guru_mapel"')) {
        expect(statement.args).toContain("remote-assignment-1");
        expect(statement.args).not.toContain("local-assignment-1");
        return { rows: [] };
      }

      return { rows: [] };
    });

    const result = await pushToCloud({
      db: dbMock as never,
      tursoCloud: {
        execute: executeMock,
      } as never,
      tables: ["guru_mapel"],
    });

    expect(result.status).toBe("success");
    expect(syncedUpdates).toHaveLength(1);
    expect(executeMock).toHaveBeenCalled();
  });

  it("remaps guru-mapel parent class ids via fallback identity before pushing", async () => {
    const syncedUpdates: Array<Record<string, unknown>> = [];
    let selectCallCount = 0;

    const dbMock = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => {
            selectCallCount += 1;

            if (selectCallCount === 1) {
              return Promise.resolve([
                {
                  id: "local-assignment-2",
                  guruId: "remote-teacher-1",
                  mataPelajaranId: "remote-subject-1",
                  kelasId: "local-class-1",
                  semesterId: "remote-semester-1",
                  updatedAt: new Date("2026-03-31T00:00:00.000Z"),
                  syncStatus: "pending",
                },
              ]);
            }

            return {
              limit: vi.fn(async () => {
                if (selectCallCount === 4) {
                  return [
                    {
                      id: "local-class-1",
                      name: "KELAS 12 TSM",
                      academicYear: "2025/2026-LOCAL",
                      updatedAt: new Date("2026-03-31T00:00:00.000Z"),
                      syncStatus: "pending",
                    },
                  ];
                }

                return [];
              }),
            };
          }),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((payload: Record<string, unknown>) => ({
          where: vi.fn(async () => {
            syncedUpdates.push(payload);
          }),
        })),
      })),
    };

    const executeMock = vi.fn(async (input: unknown) => {
      const statement =
        typeof input === "string"
          ? { sql: input, args: [] as unknown[] }
          : ((input as { sql?: string; args?: unknown[] }) ?? {
              sql: "",
              args: [],
            });
      const sql = statement.sql ?? "";

      if (
        sql.includes(
          'SELECT id FROM "classes" WHERE "name" = ? AND "academic_year" = ?',
        )
      ) {
        return { rows: [] };
      }

      if (
        sql.includes(
          'SELECT id FROM "classes" WHERE "name" IN (?) AND "deleted_at" IS NULL LIMIT 2',
        )
      ) {
        expect(statement.args).toEqual(["KELAS 12 TSM"]);
        return {
          rows: [{ id: "remote-class-1" }],
        };
      }

      if (sql.includes('SELECT id FROM "guru_mapel" WHERE "guru_id" = ?')) {
        return { rows: [] };
      }

      if (sql.includes('INSERT INTO "guru_mapel"')) {
        expect(statement.args).toContain("remote-class-1");
        expect(statement.args).not.toContain("local-class-1");
        return { rows: [] };
      }

      return { rows: [] };
    });

    const result = await pushToCloud({
      db: dbMock as never,
      tursoCloud: {
        execute: executeMock,
      } as never,
      tables: ["guru_mapel"],
    });

    expect(result.status).toBe("success");
    expect(syncedUpdates).toHaveLength(1);
    expect(executeMock).toHaveBeenCalled();
  });

  it("pushes missing synced parent subject records before guru-mapel child rows", async () => {
    const syncedUpdates: Array<Record<string, unknown>> = [];
    let selectCallCount = 0;

    const dbMock = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => {
            selectCallCount += 1;

            if (selectCallCount === 1) {
              return Promise.resolve([
                {
                  id: "local-assignment-3",
                  guruId: "remote-teacher-1",
                  mataPelajaranId: "local-subject-1",
                  kelasId: "remote-class-1",
                  semesterId: "remote-semester-1",
                  updatedAt: new Date("2026-03-31T00:00:00.000Z"),
                  syncStatus: "pending",
                },
              ]);
            }

            return {
              limit: vi.fn(async () => {
                if (selectCallCount === 3) {
                  return [
                    {
                      id: "local-subject-1",
                      name: "IPA",
                      code: "IPA-X",
                      updatedAt: new Date("2026-03-31T00:00:00.000Z"),
                      syncStatus: "synced",
                    },
                  ];
                }

                return [];
              }),
            };
          }),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((payload: Record<string, unknown>) => ({
          where: vi.fn(async () => {
            syncedUpdates.push(payload);
          }),
        })),
      })),
    };

    const executedTables: string[] = [];
    const executeMock = vi.fn(async (input: unknown) => {
      const statement =
        typeof input === "string"
          ? { sql: input, args: [] as unknown[] }
          : ((input as { sql?: string; args?: unknown[] }) ?? {
              sql: "",
              args: [],
            });
      const sql = statement.sql ?? "";

      if (sql.includes('SELECT id FROM "subjects" WHERE "code" = ?')) {
        return { rows: [] };
      }

      if (sql.includes('INSERT INTO "subjects"')) {
        executedTables.push("subjects");
        expect(statement.args).toContain("local-subject-1");
        expect(statement.args).toContain("IPA-X");
        return { rows: [] };
      }

      if (sql.includes('SELECT id FROM "guru_mapel" WHERE "guru_id" = ?')) {
        return { rows: [] };
      }

      if (sql.includes('INSERT INTO "guru_mapel"')) {
        executedTables.push("guru_mapel");
        expect(statement.args).toContain("local-subject-1");
        return { rows: [] };
      }

      return { rows: [] };
    });

    const result = await pushToCloud({
      db: dbMock as never,
      tursoCloud: {
        execute: executeMock,
      } as never,
      tables: ["guru_mapel"],
    });

    expect(result.status).toBe("success");
    expect(executedTables).toEqual(["subjects", "guru_mapel"]);
    expect(syncedUpdates).toHaveLength(1);
  });

  it("pushes missing synced parent semester records before guru-mapel child rows", async () => {
    const syncedUpdates: Array<Record<string, unknown>> = [];
    let selectCallCount = 0;

    const dbMock = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => {
            selectCallCount += 1;

            if (selectCallCount === 1) {
              return Promise.resolve([
                {
                  id: "local-assignment-4",
                  guruId: "remote-teacher-1",
                  mataPelajaranId: "remote-subject-1",
                  kelasId: "remote-class-1",
                  semesterId: "local-semester-1",
                  updatedAt: new Date("2026-04-01T00:00:00.000Z"),
                  syncStatus: "pending",
                },
              ]);
            }

            return {
              limit: vi.fn(async () => {
                if (selectCallCount === 5) {
                  return [
                    {
                      id: "local-semester-1",
                      tahunAjaranId: "remote-year-1",
                      nama: "Ganjil",
                      updatedAt: new Date("2026-04-01T00:00:00.000Z"),
                      syncStatus: "synced",
                    },
                  ];
                }

                return [];
              }),
            };
          }),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((payload: Record<string, unknown>) => ({
          where: vi.fn(async () => {
            syncedUpdates.push(payload);
          }),
        })),
      })),
    };

    const executedTables: string[] = [];
    const executeMock = vi.fn(async (input: unknown) => {
      const statement =
        typeof input === "string"
          ? { sql: input, args: [] as unknown[] }
          : ((input as { sql?: string; args?: unknown[] }) ?? {
              sql: "",
              args: [],
            });
      const sql = statement.sql ?? "";

      if (
        sql.includes(
          'SELECT id FROM "semester" WHERE "tahun_ajaran_id" = ? AND "nama" = ?',
        )
      ) {
        return { rows: [] };
      }

      if (sql.includes('INSERT INTO "semester"')) {
        executedTables.push("semester");
        expect(statement.args).toContain("local-semester-1");
        expect(statement.args).toContain("remote-year-1");
        expect(statement.args).toContain("Ganjil");
        return { rows: [] };
      }

      if (sql.includes('SELECT id FROM "guru_mapel" WHERE "guru_id" = ?')) {
        return { rows: [] };
      }

      if (sql.includes('INSERT INTO "guru_mapel"')) {
        executedTables.push("guru_mapel");
        expect(statement.args).toContain("local-semester-1");
        return { rows: [] };
      }

      return { rows: [] };
    });

    const result = await pushToCloud({
      db: dbMock as never,
      tursoCloud: {
        execute: executeMock,
      } as never,
      tables: ["guru_mapel"],
    });

    expect(result.status).toBe("success");
    expect(executedTables).toEqual(["semester", "guru_mapel"]);
    expect(syncedUpdates).toHaveLength(1);
  });

  it("revives a soft-deleted remote class before pushing a pending user", async () => {
    const syncedUpdates: Array<Record<string, unknown>> = [];
    let selectCallCount = 0;

    const dbMock = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => {
            selectCallCount += 1;

            if (selectCallCount === 1) {
              return Promise.resolve([
                {
                  id: "local-student-1",
                  email: "4352123438@smp.ypms",
                  fullName: "Tes Via Desktop",
                  role: "student",
                  kelasId: "local-class-7",
                  updatedAt: new Date("2026-04-06T00:00:00.000Z"),
                  syncStatus: "pending",
                },
              ]);
            }

            return {
              limit: vi.fn(async () => {
                if (selectCallCount === 2) {
                  return [
                    {
                      id: "local-class-7",
                      name: "KELAS 7",
                      academicYear: "2026/2027",
                      deletedAt: null,
                      updatedAt: new Date("2026-04-06T00:00:00.000Z"),
                      syncStatus: "pending",
                    },
                  ];
                }

                return [];
              }),
            };
          }),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((payload: Record<string, unknown>) => ({
          where: vi.fn(async () => {
            syncedUpdates.push(payload);
          }),
        })),
      })),
    };

    const executeMock = vi.fn(async (input: unknown) => {
      const statement =
        typeof input === "string"
          ? { sql: input, args: [] as unknown[] }
          : ((input as { sql?: string; args?: unknown[] }) ?? {
              sql: "",
              args: [],
            });
      const sql = statement.sql ?? "";

      if (
        sql.includes(
          'SELECT id FROM "classes" WHERE "name" = ? AND "academic_year" = ? AND "deleted_at" IS NULL LIMIT 1',
        )
      ) {
        return { rows: [] };
      }

      if (
        sql.includes(
          'SELECT id FROM "classes" WHERE "name" = ? AND "academic_year" = ? LIMIT 1',
        )
      ) {
        return { rows: [{ id: "remote-deleted-class-7" }] };
      }

      if (sql.includes('INSERT INTO "classes"')) {
        expect(statement.args).toContain("remote-deleted-class-7");
        expect(statement.args).toContain(null);
        return { rows: [] };
      }

      if (sql.includes('INSERT INTO "users"')) {
        expect(statement.args).toContain("remote-deleted-class-7");
        expect(statement.args).not.toContain("local-class-7");
        return { rows: [] };
      }

      return { rows: [] };
    });

    const result = await pushToCloud({
      db: dbMock as never,
      tursoCloud: {
        execute: executeMock,
      } as never,
      tables: ["users"],
      syncUsersProjection: vi.fn(async () => {}),
    });

    expect(result.status).toBe("success");
    expect(syncedUpdates).toHaveLength(1);
  });

  it("remaps class aliases to the canonical remote class before pushing a pending user", async () => {
    const syncedUpdates: Array<Record<string, unknown>> = [];
    let selectCallCount = 0;

    const dbMock = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => {
            selectCallCount += 1;

            if (selectCallCount === 1) {
              return Promise.resolve([
                {
                  id: "local-student-alias-1",
                  email: "2324.10.007@smp.ypms",
                  fullName: "EGA SAPUTRA",
                  role: "student",
                  kelasId: "local-class-alias-1",
                  updatedAt: new Date("2026-04-06T00:00:00.000Z"),
                  syncStatus: "pending",
                },
              ]);
            }

            return {
              limit: vi.fn(async () => {
                if (selectCallCount === 2) {
                  return [
                    {
                      id: "local-class-alias-1",
                      name: "KELAS XII TSM",
                      academicYear: "2026/2027-local",
                      deletedAt: null,
                      updatedAt: new Date("2026-04-06T00:00:00.000Z"),
                      syncStatus: "pending",
                    },
                  ];
                }

                return [];
              }),
            };
          }),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((payload: Record<string, unknown>) => ({
          where: vi.fn(async () => {
            syncedUpdates.push(payload);
          }),
        })),
      })),
    };

    const executeMock = vi.fn(async (input: unknown) => {
      const statement =
        typeof input === "string"
          ? { sql: input, args: [] as unknown[] }
          : ((input as { sql?: string; args?: unknown[] }) ?? {
              sql: "",
              args: [],
            });
      const sql = statement.sql ?? "";

      if (
        sql.includes(
          'SELECT id FROM "classes" WHERE "name" = ? AND "academic_year" = ? AND "deleted_at" IS NULL LIMIT 1',
        )
      ) {
        return { rows: [] };
      }

      if (
        sql.includes(
          'SELECT id FROM "classes" WHERE "name" IN (?, ?) AND "deleted_at" IS NULL LIMIT 2',
        )
      ) {
        expect(statement.args).toEqual(["KELAS XII TSM", "KELAS 12 TSM"]);
        return { rows: [{ id: "remote-class-12-tsm" }] };
      }

      if (sql.includes('INSERT INTO "classes"')) {
        throw new Error("should not create a duplicate canonical class");
      }

      if (sql.includes('INSERT INTO "users"')) {
        expect(statement.args).toContain("remote-class-12-tsm");
        expect(statement.args).not.toContain("local-class-alias-1");
        return { rows: [] };
      }

      return { rows: [] };
    });

    const result = await pushToCloud({
      db: dbMock as never,
      tursoCloud: {
        execute: executeMock,
      } as never,
      tables: ["users"],
      syncUsersProjection: vi.fn(async () => {}),
    });

    expect(result.status).toBe("success");
    expect(syncedUpdates).toHaveLength(1);
  });
});
