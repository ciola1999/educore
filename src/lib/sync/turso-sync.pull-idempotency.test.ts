import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fullSync, pullFromCloud } from "./turso-sync";

describe("turso full sync idempotency", () => {
  beforeEach(() => {
    window.__TAURI_INTERNALS__ = {};
  });

  afterEach(() => {
    delete window.__TAURI_INTERNALS__;
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
});
