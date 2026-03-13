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
import { type SyncResult, supabase } from "./client";
export { supabase, type SyncResult };

// --- HELPER: SAFE DATE PARSER ---
// Mencegah error NaN dan otomatis konversi Seconds -> Milliseconds
const safeDate = (value: string | number | Date | null | undefined): Date => {
  if (!value) return new Date(); // Fallback: Jika null, pakai waktu sekarang

  // Jika angka (Timestamp)
  if (typeof value === "number") {
    // Deteksi apakah ini Seconds (Unix) atau Milliseconds (JS)
    // Angka < 100 Miliar biasanya Seconds (cukup sampai tahun 5138)
    if (value < 100000000000) {
      return new Date(value * 1000);
    }
    return new Date(value);
  }

  // Jika string (ISO Date)
  const d = new Date(value);
  // Cek apakah valid
  if (Number.isNaN(d.getTime())) {
    console.warn("⚠️ Invalid date detected, falling back to NOW:", value);
    return new Date();
  }
  return d;
};

// --- HELPERS: CASE CONVERSION ---
const camelToSnake = (obj: any): any => {
  if (!obj || typeof obj !== "object") return obj;
  const result: any = {};
  for (const key of Object.keys(obj)) {
    if (key === "syncStatus") continue;
    const snakeKey = key.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
    const value = obj[key];
    if (value instanceof Date) {
      result[snakeKey] = value.toISOString();
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
    result[camelKey] = obj[key];
  }
  return result;
};

/**
 * Push pending local data to Supabase (Upload)
 */
export async function pushToSupabase(): Promise<SyncResult> {
  try {
    const db = await getDb();
    let uploadedCount = 0;

    const syncTable = async (
      tableName: string,
      drizzleTable: any,
      mapFn?: (data: any) => any,
      onConflict: string = "id",
    ) => {
      const pendingItems = await db
        .select()
        .from(drizzleTable)
        .where(eq(drizzleTable.syncStatus, "pending"));

      if (pendingItems.length > 0) {
        const itemsToPush = pendingItems.map((item) => {
          const mapped = mapFn ? mapFn(item) : camelToSnake(item);
          return {
            ...mapped,
            updated_at: new Date().toISOString(),
          };
        });

        // Upsert ke Supabase
        const { error } = await supabase.from(tableName).upsert(itemsToPush, { onConflict });

        if (error) {
          console.error(`Error syncing table ${tableName}:`, JSON.stringify(error, null, 2));
          throw new Error(`[Supabase Error] ${tableName}: ${error.message || JSON.stringify(error)}`);
        }

        // Mark as synced local
        for (const item of pendingItems) {
          await db
            .update(drizzleTable)
            .set({ syncStatus: "synced", updatedAt: new Date() })
            .where(eq(drizzleTable.id, item.id));
        }
        uploadedCount += pendingItems.length;
      }
    };

    // 1. Students
    await syncTable("students", students, undefined, "nis");

    // 2. Users
    await syncTable("users", users, undefined, "email");

    // 3. Classes
    await syncTable("classes", classes);

    // 4. Subjects
    await syncTable("subjects", subjects, undefined, "code");

    // 5. Attendance
    await syncTable("attendance", attendance);

    // 6. Settings
    await syncTable("attendance_settings", attendanceSettings);

    // 7. Holidays
    await syncTable("holidays", holidays);

    // 8. Logs
    await syncTable("student_daily_attendance", studentDailyAttendance);

    // 9. RBAC
    await syncTable("roles", roles);
    await syncTable("permissions", permissions);
    await syncTable("user_roles", userRoles);
    await syncTable("role_permissions", rolePermissions);

    // 10. Academic
    await syncTable("tahun_ajaran", tahunAjaran);
    await syncTable("semester", semester);
    await syncTable("guru_mapel", guruMapel);
    await syncTable("jadwal", jadwal);

    // 11. Attendance (Modern)
    await syncTable("absensi", absensi);
    await syncTable("absensi_scan_logs", absensiScanLogs);
    await syncTable("student_id_cards", studentIdCards);
    await syncTable("absensi_config", absensiConfig);
    await syncTable("absensi_exceptions", absensiExceptions);

    // 12. Nilai & Raport
    await syncTable("nilai", nilai);
    await syncTable("raport", raport);

    // 13. Finance
    await syncTable("kategori_biaya", kategoriBiaya);
    await syncTable("tagihan", tagihan);
    await syncTable("pembayaran", pembayaran);

    // 14. Communication
    await syncTable("pengumuman", pengumuman);
    await syncTable("notifikasi", notifikasi);
    await syncTable("percakapan", percakapan);
    await syncTable("peserta_percakapan", pesertaPercakapan);
    await syncTable("pesan", pesan);

    // 15. Library
    await syncTable("buku", buku);
    await syncTable("anggota_perpustakaan", anggotaPerpustakaan);
    await syncTable("peminjaman_buku", peminjamanBuku);

    // 16. HR
    await syncTable("pegawai", pegawai);
    await syncTable("cuti", cuti);
    await syncTable("gaji_pegawai", gajiPegawai);

    // 17. Inventory
    await syncTable("kategori_inventaris", kategoriInventaris);
    await syncTable("aset", aset);
    await syncTable("peminjaman_aset", peminjamanAset);
    await syncTable("stok_barang", stokBarang);
    await syncTable("transaksi_stok", transaksiStok);

    // 18. Transport
    await syncTable("kendaraan", kendaraan);

    return {
      status: "success",
      message: `Uploaded ${uploadedCount} records to cloud.`,
      uploaded: uploadedCount,
    };
  } catch (error) {
    console.error("Push error details:", error instanceof Error ? error.message : JSON.stringify(error));
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Failed to push data",
    };
  }
}

/**
 * 2. PULL: Download data dari Supabase -> Local
 */
export async function pullFromSupabase(): Promise<SyncResult> {
  try {
    const db = await getDb();
    let downloadedCount = 0;
    let updatedCount = 0;

    const pullTable = async (
      tableName: string,
      drizzleTable: any,
      mapFn?: (remote: any) => any,
    ) => {
      const { data: remoteData, error } = await supabase.from(tableName).select("*");
      if (error) throw error;

      if (remoteData && remoteData.length > 0) {
        for (const remote of remoteData) {
          const existing = await db
            .select()
            .from(drizzleTable)
            .where(eq(drizzleTable.id, remote.id))
            .limit(1);

          const mappedData = mapFn ? mapFn(remote) : snakeToCamel(remote);
          
          // Fix dates in mapped data
          for (const key of Object.keys(mappedData)) {
            const lowerKey = key.toLowerCase();
            if (
              lowerKey.includes("date") ||
              lowerKey.includes("at") ||
              lowerKey.includes("time") ||
              lowerKey.includes("tanggal") ||
              lowerKey.includes("tempo") ||
              lowerKey.includes("stamp")
            ) {
              if (mappedData[key] && typeof mappedData[key] === "string") {
                // Hanya konversi jika formatnya ISO atau timestamp (mengandung T, Z, atau spasi jam)
                // Jika hanya YYYY-MM-DD (length 10), biarkan sebagai string (untuk kolom text)
                if (mappedData[key].length > 10 || mappedData[key].includes("T") || mappedData[key].includes(" ")) {
                  mappedData[key] = safeDate(mappedData[key]);
                }
              }
            }
          }
          
          mappedData.syncStatus = "synced";

          if (existing.length === 0) {
            await db.insert(drizzleTable).values(mappedData);
            downloadedCount++;
          } else {
            const localItem = existing[0];
            const remoteTime = new Date(remote.updated_at).getTime();
            const localTime = localItem.updatedAt 
              ? (localItem.updatedAt instanceof Date ? localItem.updatedAt.getTime() : Number(localItem.updatedAt) * 1000)
              : 0;

            if (remoteTime > localTime + 1000 || localItem.syncStatus === "pending") {
              await db.update(drizzleTable).set(mappedData).where(eq(drizzleTable.id, remote.id));
              updatedCount++;
            }
          }
        }
      }
    };

    // Execute pull for all tables
    await pullTable("users", users);
    await pullTable("students", students);
    await pullTable("classes", classes);
    await pullTable("subjects", subjects);
    await pullTable("attendance_settings", attendanceSettings);
    await pullTable("holidays", holidays);
    await pullTable("student_daily_attendance", studentDailyAttendance);
    await pullTable("attendance", attendance);
    await pullTable("roles", roles);
    await pullTable("permissions", permissions);
    await pullTable("user_roles", userRoles);
    await pullTable("role_permissions", rolePermissions);
    await pullTable("tahun_ajaran", tahunAjaran);
    await pullTable("semester", semester);
    await pullTable("guru_mapel", guruMapel);
    await pullTable("jadwal", jadwal);
    await pullTable("absensi", absensi);
    await pullTable("absensi_scan_logs", absensiScanLogs);
    await pullTable("student_id_cards", studentIdCards);
    await pullTable("absensi_config", absensiConfig);
    await pullTable("absensi_exceptions", absensiExceptions);
    await pullTable("nilai", nilai);
    await pullTable("raport", raport);
    await pullTable("kategori_biaya", kategoriBiaya);
    await pullTable("tagihan", tagihan);
    await pullTable("pembayaran", pembayaran);
    await pullTable("pengumuman", pengumuman);
    await pullTable("notifikasi", notifikasi);
    await pullTable("percakapan", percakapan);
    await pullTable("peserta_percakapan", pesertaPercakapan);
    await pullTable("pesan", pesan);
    await pullTable("buku", buku);
    await pullTable("anggota_perpustakaan", anggotaPerpustakaan);
    await pullTable("peminjaman_buku", peminjamanBuku);
    await pullTable("pegawai", pegawai);
    await pullTable("cuti", cuti);
    await pullTable("gaji_pegawai", gajiPegawai);
    await pullTable("kategori_inventaris", kategoriInventaris);
    await pullTable("aset", aset);
    await pullTable("peminjaman_aset", peminjamanAset);
    await pullTable("stok_barang", stokBarang);
    await pullTable("transaksi_stok", transaksiStok);
    await pullTable("kendaraan", kendaraan);

    await syncUsersToStudentsProjection();

    return {
      status: "success",
      message: downloadedCount + updatedCount === 0 
        ? "Data sudah up-to-date." 
        : `Sync: ${downloadedCount} baru, ${updatedCount} diupdate.`,
      downloaded: downloadedCount + updatedCount,
    };
  } catch (error) {
    console.error("Pull error:", error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Gagal download data",
    };
  }
}

/**
 * Full sync: Push then Pull
 */
export async function fullSync(): Promise<SyncResult> {
  const pushResult = await pushToSupabase();
  if (pushResult.status === "error") return pushResult;

  const pullResult = await pullFromSupabase();
  if (pullResult.status === "error") return pullResult;

  return {
    status: "success",
    message: `Sync complete! Uploaded ${pushResult.uploaded || 0}, Downloaded ${pullResult.downloaded || 0} records.`,
    uploaded: pushResult.uploaded,
    downloaded: pullResult.downloaded,
  };
}


