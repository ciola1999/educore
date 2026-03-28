import type { InValue } from "@libsql/client";
import { and, eq } from "drizzle-orm";
import { isWeb } from "@/core/env";
import { getDb } from "../db";

import {
  attendance,
  attendanceSettings,
  classes,
  guruMapel,
  holidays,
  jadwal,
  permissions,
  rolePermissions,
  roles,
  semester,
  studentDailyAttendance,
  students,
  subjects,
  tahunAjaran,
  userRoles,
  users,
} from "../db/schema";
import { syncUsersToStudentsProjection } from "../services/student-projection";
import { getTursoCloudClient, type SyncResult } from "./client";

export type { SyncResult };
type PullFromCloudDeps = {
  db?: Awaited<ReturnType<typeof getDb>>;
  tursoCloud?: Awaited<ReturnType<typeof getTursoCloudClient>>;
  syncUsersProjection?: () => Promise<void>;
};
type PushToCloudDeps = {
  db?: Awaited<ReturnType<typeof getDb>>;
  tursoCloud?: Awaited<ReturnType<typeof getTursoCloudClient>>;
};
type FullSyncDeps = PushToCloudDeps &
  PullFromCloudDeps & {
    pushExecutor?: (deps?: PushToCloudDeps) => Promise<SyncResult>;
    pullExecutor?: (deps?: PullFromCloudDeps) => Promise<SyncResult>;
  };

// --- HELPERS: CASE CONVERSION ---
type SnakeRecord = Record<string, unknown>;
type SyncTableRef = {
  id: unknown;
  syncStatus: unknown;
} & Record<string, unknown>;
type SyncRow = {
  id?: string;
  updatedAt?: Date | null;
  syncStatus?: string | null;
} & Record<string, unknown>;
type SyncTableConfig = {
  name: string;
  table: unknown;
  conflictKey?: string;
  logicalKey?: string | string[];
};
const asSyncTableRef = (table: unknown): SyncTableRef => table as SyncTableRef;

export const camelToSnake = (obj: SnakeRecord): SnakeRecord => {
  if (!obj || typeof obj !== "object") return obj;
  const result: SnakeRecord = {};
  for (const key of Object.keys(obj)) {
    if (key === "syncStatus") continue;
    const value = obj[key];
    if (value === undefined) continue;
    const snakeKey = key.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
    if (value instanceof Date) {
      result[snakeKey] = Math.floor(value.getTime() / 1000);
    } else {
      result[snakeKey] = value;
    }
  }
  return result;
};

export function toLibsqlArgs(
  columns: string[],
  record: SnakeRecord,
): InValue[] {
  return columns.map((column) => {
    const value = record[column];

    if (value === null) return null;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "bigint" ||
      typeof value === "boolean"
    ) {
      return value;
    }

    if (value instanceof ArrayBuffer) {
      return new Uint8Array(value);
    }

    if (value instanceof Uint8Array) {
      return value;
    }

    throw new Error(
      `Unsupported sync value for column "${column}" with type "${typeof value}"`,
    );
  });
}

export const snakeToCamel = (obj: SnakeRecord): SnakeRecord => {
  if (!obj || typeof obj !== "object") return obj;
  const TIMESTAMP_COLUMNS = new Set([
    "created_at",
    "updated_at",
    "deleted_at",
    "tanggal_lahir",
    "last_login_at",
    "tanggal_mulai",
    "tanggal_selesai",
    "check_in_time",
    "check_out_time",
    "scan_timestamp",
    "issued_at",
    "expires_at",
    "revoked_at",
    "last_used_at",
    "tanggal",
    "published_at",
    "last_read_at",
    "tanggal_terbit",
    "jatuh_tempo",
    "tanggal_lunas",
    "tanggal_bayar",
    "tanggal_daftar",
    "tanggal_pinjam",
    "tanggal_jatuh_tempo",
    "tanggal_kembali",
    "tanggal_masuk",
    "tanggal_keluar",
    "tanggal_perolehan",
  ]);
  const result: SnakeRecord = {};
  for (const key of Object.keys(obj)) {
    const camelKey = key.replace(/(_\w)/g, (m) => m[1].toUpperCase());
    const val = obj[key];
    // Auto-detect timestamps
    if (key.endsWith("_at") || TIMESTAMP_COLUMNS.has(key)) {
      if (typeof val === "number" && Number.isFinite(val)) {
        result[camelKey] = new Date(val * 1000);
        continue;
      }

      if (typeof val === "bigint") {
        result[camelKey] = new Date(Number(val) * 1000);
        continue;
      }

      if (typeof val === "string" && val.trim() !== "") {
        const parsed = Number(val);
        if (Number.isFinite(parsed)) {
          result[camelKey] = new Date(parsed * 1000);
          continue;
        }
      }

      result[camelKey] = val;
    } else {
      result[camelKey] = val;
    }
  }
  return result;
};

/**
 * Generate Turso-compatible UPSERT SQL
 */
export function sortColumns(record: SnakeRecord): string[] {
  return Object.keys(record).sort();
}

export function generateUpsertSql(
  tableName: string,
  columns: string[],
  conflictKey: string = "id",
) {
  if (columns.length === 0 || !columns.includes(conflictKey)) return null;
  const placeholders = columns.map(() => "?").join(", ");
  const colNames = columns.map((c) => `"${c}"`).join(", ");

  const updates = columns
    .filter((c) => c !== conflictKey && c !== "id")
    .map((c) => `"${c}" = excluded."${c}"`)
    .join(", ");

  const sql = `
    INSERT INTO "${tableName}" (${colNames})
    VALUES (${placeholders})
    ON CONFLICT("${conflictKey}") DO UPDATE SET
    ${updates}
    WHERE excluded.updated_at > "${tableName}".updated_at
  `;

  return sql;
}

const SYNC_TABLES: SyncTableConfig[] = [
  { name: "users", table: users, conflictKey: "email", logicalKey: "email" },
  { name: "roles", table: roles, conflictKey: "id", logicalKey: "name" },
  {
    name: "permissions",
    table: permissions,
    conflictKey: "id",
    logicalKey: "name",
  },
  { name: "user_roles", table: userRoles, conflictKey: "id" },
  { name: "role_permissions", table: rolePermissions, conflictKey: "id" },
  {
    name: "tahun_ajaran",
    table: tahunAjaran,
    conflictKey: "id",
    logicalKey: "nama",
  },
  {
    name: "semester",
    table: semester,
    conflictKey: "id",
    logicalKey: ["tahunAjaranId", "nama"],
  },
  { name: "subjects", table: subjects, conflictKey: "id", logicalKey: "code" },
  { name: "classes", table: classes, conflictKey: "id" },
  {
    name: "guru_mapel",
    table: guruMapel,
    conflictKey: "id",
    logicalKey: ["guruId", "mataPelajaranId", "kelasId", "semesterId"],
  },
  {
    name: "jadwal",
    table: jadwal,
    conflictKey: "id",
    logicalKey: ["guruMapelId", "hari", "jamMulai", "jamSelesai"],
  },
  { name: "students", table: students, conflictKey: "id", logicalKey: "nis" },
  { name: "attendance", table: attendance, conflictKey: "id" },
  {
    name: "attendance_settings",
    table: attendanceSettings,
    conflictKey: "id",
  },
  { name: "holidays", table: holidays, conflictKey: "id" },
  {
    name: "student_daily_attendance",
    table: studentDailyAttendance,
    conflictKey: "id",
    logicalKey: ["studentId", "date"],
  },
];

export const SYNC_TABLE_NAMES = SYNC_TABLES.map((table) => table.name);

/**
 * Push pending local data to Turso Cloud
 */
export async function pushToCloud(
  deps: PushToCloudDeps = {},
): Promise<SyncResult> {
  if (isWeb()) {
    return {
      status: "success",
      message: "Web version is always live-to-cloud.",
    };
  }
  try {
    const db = deps.db ?? (await getDb());
    const tursoCloud = deps.tursoCloud ?? (await getTursoCloudClient());
    let uploadedCount = 0;

    const syncTable = async (
      tableName: string,
      drizzleTable: unknown,
      conflictKey: string = "id",
    ) => {
      const table = asSyncTableRef(drizzleTable);
      const pendingItems = await db
        .select()
        .from(table as never)
        .where(eq(table.syncStatus as never, "pending"));
      const rows = pendingItems as SyncRow[];

      if (rows.length > 0) {
        for (const item of rows) {
          const snakeItem = camelToSnake(item);
          const columns = sortColumns(snakeItem);
          const sql = generateUpsertSql(tableName, columns, conflictKey);
          const args = toLibsqlArgs(columns, snakeItem);

          if (sql) {
            await tursoCloud.execute({
              sql,
              args,
            });

            await db
              .update(table as never)
              .set({ syncStatus: "synced", updatedAt: new Date() })
              .where(eq(table.id as never, item.id as never));

            uploadedCount++;
          }
        }
      }
    };

    for (const tableConfig of SYNC_TABLES) {
      await syncTable(
        tableConfig.name,
        tableConfig.table,
        tableConfig.conflictKey,
      );
    }

    return {
      status: "success",
      message: `Pushed ${uploadedCount} records to Turso Cloud.`,
      uploaded: uploadedCount,
    };
  } catch (error) {
    console.error("Push error:", error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Gagal push ke cloud",
    };
  }
}

/**
 * Pull data from Turso Cloud -> Local
 */
export async function pullFromCloud(
  deps: PullFromCloudDeps = {},
): Promise<SyncResult> {
  if (isWeb()) {
    return {
      status: "success",
      message: "Web version is always live-to-cloud.",
    };
  }
  try {
    const db = deps.db ?? (await getDb());
    const tursoCloud = deps.tursoCloud ?? (await getTursoCloudClient());
    const runProjection =
      deps.syncUsersProjection ?? syncUsersToStudentsProjection;
    let downloadedCount = 0;
    const parseEpoch = (value: unknown): number => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
      if (typeof value === "bigint") {
        return Number(value);
      }
      return 0;
    };

    const pullTable = async (
      tableName: string,
      drizzleTable: unknown,
      logicalKey?: string | string[],
    ) => {
      const table = asSyncTableRef(drizzleTable);
      const res = await tursoCloud.execute(`SELECT * FROM "${tableName}"`);
      const remoteData = res.rows;

      if (remoteData && remoteData.length > 0) {
        for (const remote of remoteData) {
          const mappedData = snakeToCamel(remote);
          mappedData.syncStatus = "synced";

          // 1. Check by ID first
          const existingById = await db
            .select()
            .from(table as never)
            .where(eq(table.id as never, mappedData.id as never))
            .limit(1);

          if (existingById.length > 0) {
            const localItem = existingById[0] as SyncRow;
            const remoteTime = parseEpoch(
              (remote as Record<string, unknown>).updated_at,
            );
            const localTime = Math.floor(
              (localItem.updatedAt?.getTime() || 0) / 1000,
            );

            if (remoteTime > localTime) {
              await db
                .update(table as never)
                .set(mappedData as never)
                .where(eq(table.id as never, mappedData.id as never));
              downloadedCount++;
            }
            continue;
          }

          // 2. ID not found. Check by Logical Key(s)
          if (logicalKey) {
            let existingByKey: SyncRow[] = [];
            if (Array.isArray(logicalKey)) {
              existingByKey = await db
                .select()
                .from(table as never)
                .where(
                  and(
                    ...logicalKey.map((key) =>
                      eq(table[key] as never, mappedData[key] as never),
                    ),
                  ),
                )
                .limit(1);
            } else if (mappedData[logicalKey]) {
              existingByKey = await db
                .select()
                .from(table as never)
                .where(
                  eq(
                    table[logicalKey] as never,
                    mappedData[logicalKey] as never,
                  ),
                )
                .limit(1);
            }

            if (existingByKey.length > 0) {
              const localRecord = existingByKey[0];
              const remoteTime = parseEpoch(
                (remote as Record<string, unknown>).updated_at,
              );
              const localTime = Math.floor(
                (localRecord.updatedAt?.getTime() || 0) / 1000,
              );

              if (remoteTime > localTime) {
                await db
                  .update(table as never)
                  .set({
                    ...mappedData,
                    id: localRecord.id,
                    syncStatus: "synced",
                  })
                  .where(eq(table.id as never, localRecord.id as never));
                downloadedCount++;
              } else if (localRecord.syncStatus !== "synced") {
                await db
                  .update(table as never)
                  .set({ syncStatus: "synced" })
                  .where(eq(table.id as never, localRecord.id as never));
                downloadedCount++;
              }
              continue;
            }
          }

          // 3. Truly new record
          await db.insert(table as never).values(mappedData as never);
          downloadedCount++;
        }
      }
    };

    for (const tableConfig of SYNC_TABLES) {
      await pullTable(
        tableConfig.name,
        tableConfig.table,
        tableConfig.logicalKey,
      );
    }

    await runProjection();

    return {
      status: "success",
      message: `Sync complete! Downloaded ${downloadedCount} records.`,
      downloaded: downloadedCount,
    };
  } catch (error) {
    console.error("Pull error:", error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Gagal pull dari cloud",
    };
  }
}

export async function fullSync(deps: FullSyncDeps = {}): Promise<SyncResult> {
  const pushRunner = deps.pushExecutor ?? pushToCloud;
  const pullRunner = deps.pullExecutor ?? pullFromCloud;
  const push = await pushRunner(deps);
  if (push.status === "error") return push;
  const pull = await pullRunner(deps);
  return pull;
}
