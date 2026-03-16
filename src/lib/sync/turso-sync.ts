import { eq } from "drizzle-orm";
import { getDb } from "../db";
import {
  absensi,
  absensiConfig,
  absensiExceptions,
  absensiScanLogs,
  anggotaPerpustakaan,
  aset,
  attendance,
  attendanceSettings,
  buku,
  classes,
  cuti,
  gajiPegawai,
  guruMapel,
  holidays,
  jadwal,
  kategoriBiaya,
  kategoriInventaris,
  kendaraan,
  nilai,
  notifikasi,
  pegawai,
  pembayaran,
  peminjamanAset,
  peminjamanBuku,
  pengumuman,
  percakapan,
  permissions,
  pesan,
  pesertaPercakapan,
  raport,
  rolePermissions,
  roles,
  semester,
  stokBarang,
  studentDailyAttendance,
  studentIdCards,
  students,
  subjects,
  tagihan,
  tahunAjaran,
  transaksiStok,
  userRoles,
  users,
} from "../db/schema";
import { syncUsersToStudentsProjection } from "../services/student-projection";
import { isWeb } from "@/core/env";
import { type SyncResult, tursoCloud } from "./client";

export type { SyncResult };

// --- HELPERS: CASE CONVERSION ---
const camelToSnake = (obj: any): any => {
  if (!obj || typeof obj !== "object") return obj;
  const result: any = {};
  for (const key of Object.keys(obj)) {
    if (key === "syncStatus") continue;
    const snakeKey = key.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
    const value = obj[key];
    if (value instanceof Date) {
      result[snakeKey] = Math.floor(value.getTime() / 1000);
    } else {
      result[snakeKey] = value;
    }
  }
  return result;
};

const snakeToCamel = (obj: any): any => {
  if (!obj || typeof obj !== "object") return obj;
  const result: any = {};
  for (const key of Object.keys(obj)) {
    const camelKey = key.replace(/(_\w)/g, (m) => m[1].toUpperCase());
    const val = obj[key];
    // Auto-detect timestamps
    if (key.endsWith("_at") && typeof val === "number") {
      result[camelKey] = new Date(val * 1000);
    } else {
      result[camelKey] = val;
    }
  }
  return result;
};

/**
 * Generate Turso-compatible UPSERT SQL
 */
function generateUpsertSql(
  tableName: string,
  data: any[],
  conflictKey: string = "id",
) {
  if (data.length === 0) return null;
  const columns = Object.keys(data[0]);
  const placeholders = columns.map(() => "?").join(", ");
  const colNames = columns.map((c) => `"${c}"`).join(", ");

  const updates = columns
    .filter((c) => c !== conflictKey)
    .map((c) => `"${c}" = excluded."${c}"`)
    .join(", ");

  // ELITE 2026 PATTERN: Only update if the incoming (excluded) updated_at is GREATER than existing
  // This ensures that offline devices don't overwrite newer changes made on the Web/Global cloud.
  const sql = `
    INSERT INTO "${tableName}" (${colNames})
    VALUES (${placeholders})
    ON CONFLICT("${conflictKey}") DO UPDATE SET
    ${updates}
    WHERE excluded.updated_at > "${tableName}".updated_at
  `;

  return sql;
}

/**
 * Push pending local data to Turso Cloud
 */
export async function pushToCloud(): Promise<SyncResult> {
  if (isWeb()) {
    return { status: "success", message: "Web version is always live-to-cloud." };
  }
  try {
    const db = await getDb();
    let uploadedCount = 0;

    const syncTable = async (
      tableName: string,
      drizzleTable: any,
      conflictKey: string = "id",
    ) => {
      const pendingItems = await db
        .select()
        .from(drizzleTable)
        .where(eq(drizzleTable.syncStatus, "pending"));

      if (pendingItems.length > 0) {
        for (const item of pendingItems) {
          const snakeItem = camelToSnake(item);
          const columns = Object.keys(snakeItem);
          const sql = generateUpsertSql(tableName, [snakeItem], conflictKey);

          if (sql) {
            await tursoCloud.execute({
              sql,
              args: Object.values(snakeItem) as any[],
            });

            await db
              .update(drizzleTable)
              .set({ syncStatus: "synced", updatedAt: new Date() })
              .where(eq(drizzleTable.id, item.id));

            uploadedCount++;
          }
        }
      }
    };

    // Sync all tables sequentially
    const allTables = [
      { name: "users", table: users },
      { name: "students", table: students },
      { name: "classes", table: classes },
      { name: "subjects", table: subjects, key: "code" },
      { name: "attendance", table: attendance },
      { name: "attendance_settings", table: attendanceSettings },
      { name: "holidays", table: holidays },
      { name: "student_daily_attendance", table: studentDailyAttendance },
      { name: "roles", table: roles },
      { name: "permissions", table: permissions },
      { name: "user_roles", table: userRoles },
      { name: "role_permissions", table: rolePermissions },
    ];

    for (const t of allTables) {
      await syncTable(t.name, t.table, t.key);
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
export async function pullFromCloud(): Promise<SyncResult> {
  if (isWeb()) {
    return { status: "success", message: "Web version is always live-to-cloud." };
  }
  try {
    const db = await getDb();
    let downloadedCount = 0;

    const pullTable = async (
      tableName: string,
      drizzleTable: any,
      logicalKey?: string | string[],
    ) => {
      const res = await tursoCloud.execute(`SELECT * FROM "${tableName}"`);
      const remoteData = res.rows;

      if (remoteData && remoteData.length > 0) {
        for (const remote of remoteData) {
          const mappedData = snakeToCamel(remote);
          mappedData.syncStatus = "synced";

          // 1. Check by ID first
          const existingById = await db
            .select()
            .from(drizzleTable)
            .where(eq(drizzleTable.id, mappedData.id))
            .limit(1);

          if (existingById.length > 0) {
            const localItem = existingById[0];
            const remoteTime = (remote.updated_at as number) || 0;
            const localTime = Math.floor(
              (localItem.updatedAt?.getTime() || 0) / 1000,
            );

            if (remoteTime > localTime) {
              await db
                .update(drizzleTable)
                .set(mappedData as any)
                .where(eq(drizzleTable.id, mappedData.id));
              downloadedCount++;
            }
            continue;
          }

          // 2. ID not found. Check by Logical Key(s)
          if (logicalKey) {
            let existingByKey: any[] = [];
            if (Array.isArray(logicalKey)) {
              // Composite key
              let query = db.select().from(drizzleTable);
              for (const key of logicalKey) {
                query = query.where(eq(drizzleTable[key], mappedData[key]));
              }
              existingByKey = await query.limit(1);
            } else if (mappedData[logicalKey]) {
              existingByKey = await db
                .select()
                .from(drizzleTable)
                .where(eq(drizzleTable[logicalKey], mappedData[logicalKey]))
                .limit(1);
            }

            if (existingByKey.length > 0) {
              const localRecord = existingByKey[0];
              await db.execute({
                sql: `UPDATE "${tableName}" SET id = ?, sync_status = 'synced' WHERE id = ?`,
                args: [mappedData.id, localRecord.id],
              });
              await db
                .update(drizzleTable)
                .set(mappedData as any)
                .where(eq(drizzleTable.id, mappedData.id));
              downloadedCount++;
              continue;
            }
          }

          // 3. Truly new record
          await db.insert(drizzleTable).values(mappedData as any);
          downloadedCount++;
        }
      }
    };

    const tablesToPull = [
      { name: "users", table: users, key: "email" },
      { name: "students", table: students, key: "nis" },
      { name: "subjects", table: subjects, key: "code" },
      { name: "classes", table: classes },
      { name: "roles", table: roles, key: "name" },
      { name: "permissions", table: permissions, key: "name" },
      { name: "attendance", table: attendance },
      {
        name: "student_daily_attendance",
        table: studentDailyAttendance,
        key: ["studentId", "date"],
      },
    ];

    for (const t of tablesToPull) {
      await pullTable(t.name, t.table, t.key);
    }

    await syncUsersToStudentsProjection();

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

export async function fullSync(): Promise<SyncResult> {
  const push = await pushToCloud();
  if (push.status === "error") return push;
  const pull = await pullFromCloud();
  return pull;
}
