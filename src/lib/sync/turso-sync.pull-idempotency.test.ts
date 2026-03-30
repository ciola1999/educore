import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/env", () => ({
  isWeb: () => false,
  isTauri: () => true,
}));

import { fullSync, pullFromCloud, pushToCloud } from "./turso-sync";

type TestWindow = {
  __TAURI_INTERNALS__?: Record<string, unknown>;
};

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
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => {
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
          })),
        })),
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
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => {
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
          })),
        })),
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
});
