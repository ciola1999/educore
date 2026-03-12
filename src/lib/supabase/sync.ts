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
  if (isNaN(d.getTime())) {
    console.warn("⚠️ Invalid date detected, falling back to NOW:", value);
    return new Date();
  }
  return d;
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
      mapFn: (data: any) => any,
      onConflict: string = "id",
    ) => {
      const pendingItems = await db
        .select()
        .from(drizzleTable)
        .where(eq(drizzleTable.syncStatus, "pending"));

      if (pendingItems.length > 0) {
        // Upsert ke Supabase
        const { error } = await supabase
          .from(tableName)
          .upsert(pendingItems.map(mapFn), { onConflict });

        if (error) {
          console.error(`Error syncing table ${tableName}:`, error);
          throw error;
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
    await syncTable(
      "students",
      students,
      (s) => ({
        id: s.id,
        nis: s.nis,
        full_name: s.fullName,
        gender: s.gender,
        grade: s.grade,
        parent_name: s.parentName,
        parent_phone: s.parentPhone,
        updated_at: new Date().toISOString(),
      }),
      "nis",
    );

    // 2. Users
    await syncTable(
      "users",
      users,
      (u) => ({
        id: u.id,
        full_name: u.fullName,
        email: u.email,
        role: u.role,
        password_hash: u.passwordHash,
        updated_at: new Date().toISOString(),
      }),
      "email",
    );

    // 3. Classes
    await syncTable("classes", classes, (c) => ({
      id: c.id,
      name: c.name,
      academic_year: c.academicYear,
      homeroom_teacher_id: c.homeroomTeacherId,
      updated_at: new Date().toISOString(),
    }));

    // 4. Subjects
    await syncTable(
      "subjects",
      subjects,
      (s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        updated_at: new Date().toISOString(),
      }),
      "code",
    );

    // 5. Attendance
    await syncTable("attendance", attendance, (a) => ({
      id: a.id,
      student_id: a.studentId,
      class_id: a.classId,
      date: a.date,
      status: a.status,
      notes: a.notes,
      recorded_by: a.recordedBy,
      created_at: a.createdAt,
      updated_at: new Date().toISOString(),
    }));

    // 6. Settings
    await syncTable("attendance_settings", attendanceSettings, (s) => ({
      id: s.id,
      day_of_week: s.dayOfWeek,
      start_time: s.startTime,
      end_time: s.endTime,
      late_threshold: s.lateThreshold,
      entity_type: s.entityType,
      is_active: s.isActive,
      updated_at: new Date().toISOString(),
    }));

    // 7. Holidays
    await syncTable("holidays", holidays, (h) => ({
      id: h.id,
      date: h.date,
      name: h.name,
      updated_at: new Date().toISOString(),
    }));

    // 8. Logs
    await syncTable(
      "student_daily_attendance",
      studentDailyAttendance,
      (l) => ({
        id: l.id,
        student_id: l.studentId,
        date: l.date,
        check_in_time: l.checkInTime,
        check_out_time: l.checkOutTime,
        status: l.status,
        late_duration: l.lateDuration,
        snapshot_student_name: l.snapshotStudentName,
        snapshot_student_nis: l.snapshotStudentNis,
        updated_at: new Date().toISOString(),
      }),
    );

    // 9. RBAC
    await syncTable("roles", roles, (r) => ({
      ...r,
      updated_at: new Date().toISOString(),
    }));
    await syncTable("permissions", permissions, (p) => ({
      ...p,
      updated_at: new Date().toISOString(),
    }));
    await syncTable("user_roles", userRoles, (ur) => ({
      ...ur,
      updated_at: new Date().toISOString(),
    }));
    await syncTable("role_permissions", rolePermissions, (rp) => ({
      ...rp,
      updated_at: new Date().toISOString(),
    }));

    // 10. Academic (New)
    await syncTable("tahun_ajaran", tahunAjaran, (t) => ({
      ...t,
      updated_at: new Date().toISOString(),
    }));
    await syncTable("semester", semester, (s) => ({
      ...s,
      updated_at: new Date().toISOString(),
    }));
    await syncTable("guru_mapel", guruMapel, (gm) => ({
      ...gm,
      updated_at: new Date().toISOString(),
    }));
    await syncTable("jadwal", jadwal, (j) => ({
      ...j,
      updated_at: new Date().toISOString(),
    }));

    // 11. Attendance (New)
    await syncTable("absensi", absensi, (a) => ({
      ...a,
      updated_at: new Date().toISOString(),
    }));
    await syncTable("absensi_scan_logs", absensiScanLogs, (asl) => ({
      ...asl,
      updated_at: new Date().toISOString(),
    }));
    await syncTable("student_id_cards", studentIdCards, (sic) => ({
      ...sic,
      updated_at: new Date().toISOString(),
    }));
    await syncTable("absensi_config", absensiConfig, (ac) => ({
      ...ac,
      updated_at: new Date().toISOString(),
    }));
    await syncTable("absensi_exceptions", absensiExceptions, (ae) => ({
      ...ae,
      updated_at: new Date().toISOString(),
    }));

    // 12. Nilai & Raport
    await syncTable("nilai", nilai, (n) => ({
      ...n,
      updated_at: new Date().toISOString(),
    }));
    await syncTable("raport", raport, (r) => ({
      ...r,
      updated_at: new Date().toISOString(),
    }));

    // 13. Finance
    await syncTable("kategori_biaya", kategoriBiaya, (kb) => ({
      ...kb,
      updated_at: new Date().toISOString(),
    }));
    await syncTable("tagihan", tagihan, (t) => ({
      ...t,
      updated_at: new Date().toISOString(),
    }));
    await syncTable("pembayaran", pembayaran, (p) => ({
      ...p,
      updated_at: new Date().toISOString(),
    }));

    // 14. Communication
    await syncTable("pengumuman", pengumuman, (p) => ({
      ...p,
      updated_at: new Date().toISOString(),
    }));
    await syncTable("notifikasi", notifikasi, (n) => ({
      ...n,
      updated_at: new Date().toISOString(),
    }));
    await syncTable("percakapan", percakapan, (p) => ({
      ...p,
      updated_at: new Date().toISOString(),
    }));
    await syncTable("peserta_percakapan", pesertaPercakapan, (pp) => ({
      ...pp,
      updated_at: new Date().toISOString(),
    }));
    await syncTable("pesan", pesan, (p) => ({
      ...p,
      updated_at: new Date().toISOString(),
    }));

    // 15. Library
    await syncTable("buku", buku, (b) => ({
      ...b,
      updated_at: new Date().toISOString(),
    }));
    await syncTable("anggota_perpustakaan", anggotaPerpustakaan, (ap) => ({
      ...ap,
      updated_at: new Date().toISOString(),
    }));
    await syncTable("peminjaman_buku", peminjamanBuku, (pb) => ({
      ...pb,
      updated_at: new Date().toISOString(),
    }));

    // 16. HR
    await syncTable("pegawai", pegawai, (p) => ({
      ...p,
      updated_at: new Date().toISOString(),
    }));
    await syncTable("cuti", cuti, (c) => ({
      ...c,
      updated_at: new Date().toISOString(),
    }));
    await syncTable("gaji_pegawai", gajiPegawai, (gp) => ({
      ...gp,
      updated_at: new Date().toISOString(),
    }));

    // 17. Inventory
    await syncTable("kategori_inventaris", kategoriInventaris, (ki) => ({
      ...ki,
      updated_at: new Date().toISOString(),
    }));
    await syncTable("aset", aset, (a) => ({
      ...a,
      updated_at: new Date().toISOString(),
    }));
    await syncTable("peminjaman_aset", peminjamanAset, (pa) => ({
      ...pa,
      updated_at: new Date().toISOString(),
    }));
    await syncTable("stok_barang", stokBarang, (sb) => ({
      ...sb,
      updated_at: new Date().toISOString(),
    }));
    await syncTable("transaksi_stok", transaksiStok, (ts) => ({
      ...ts,
      updated_at: new Date().toISOString(),
    }));

    // 18. Transport
    await syncTable("kendaraan", kendaraan, (k) => ({
      ...k,
      updated_at: new Date().toISOString(),
    }));

    return {
      status: "success",
      message: `Uploaded ${uploadedCount} records to cloud.`,
      uploaded: uploadedCount,
    };
  } catch (error) {
    console.error("Push error details:", JSON.stringify(error, null, 2));
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Failed to push data",
    };
  }
}

/**
 * 2. PULL: Download data dari Supabase -> Local
 * ✅ FIXED: Hanya update jika data Cloud LEBIH BARU (Timestamp Check)
 */
export async function pullFromSupabase(): Promise<SyncResult> {
  try {
    const db = await getDb();
    let downloadedCount = 0;
    let updatedCount = 0;

    // Fungsi Generic untuk Download
    const pullTable = async (
      tableName: string,
      drizzleTable: any,
      mapFn: (remote: any) => any,
    ) => {
      // Ambil semua data dari Cloud
      const { data: remoteData, error } = await supabase
        .from(tableName)
        .select("*");

      if (error) throw error;

      if (remoteData && remoteData.length > 0) {
        for (const remote of remoteData) {
          // 1. Cek data existing di Local
          const existing = await db
            .select()
            .from(drizzleTable)
            .where(eq(drizzleTable.id, remote.id))
            .limit(1);

          // Mapping data dari remote
          const mappedData = {
            ...mapFn(remote),
            syncStatus: "synced", // Set status synced agar tidak dipush balik
          };

          if (existing.length === 0) {
            // A. INSERT (Data belum ada di lokal)
            await db.insert(drizzleTable).values(mappedData);
            downloadedCount++;
          } else {
            // B. UPDATE (Data sudah ada) -> CEK TIMESTAMP DULU!
            const localItem = existing[0];

            // Konversi waktu ke miliseconds untuk perbandingan
            const remoteTime = new Date(remote.updated_at).getTime();
            const localTime = localItem.updatedAt
              ? new Date(localItem.updatedAt).getTime()
              : 0;

            // Toleransi perbedaan waktu (kadang beda ms sedikit karena proses save)
            // Kita update HANYA JIKA data cloud lebih baru > 1 detik (1000ms)
            // ATAU jika status lokal masih 'pending' (konflik, kita menangkan cloud/server wins)
            const shouldUpdate =
              remoteTime > localTime + 1000 ||
              localItem.syncStatus === "pending";

            if (shouldUpdate) {
              await db
                .update(drizzleTable)
                .set(mappedData)
                .where(eq(drizzleTable.id, remote.id));
              updatedCount++;
            }
          }
        }
      }
    };

    // --- URUTAN PULL (Sama seperti sebelumnya) ---

    // 1. Users
    await pullTable("users", users, (u) => ({
      id: u.id,
      fullName: u.full_name,
      email: u.email,
      role: u.role,
      passwordHash: u.password_hash,
      updatedAt: safeDate(u.updated_at),
      createdAt: safeDate(u.created_at),
    }));

    // 2. Students
    await pullTable("students", students, (s) => ({
      id: s.id,
      nis: s.nis,
      fullName: s.full_name,
      gender: s.gender,
      grade: s.grade,
      parentName: s.parent_name,
      parentPhone: s.parent_phone,
      updatedAt: safeDate(s.updated_at),
      createdAt: safeDate(s.created_at),
    }));

    // 3. Classes
    await pullTable("classes", classes, (c) => ({
      id: c.id,
      name: c.name,
      academicYear: c.academic_year,
      homeroomTeacherId: c.homeroom_teacher_id,
      updatedAt: safeDate(c.updated_at),
      createdAt: safeDate(c.created_at),
    }));

    // 4. Subjects
    await pullTable("subjects", subjects, (s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      updatedAt: safeDate(s.updated_at),
      createdAt: safeDate(s.created_at),
    }));

    // 5. Settings
    await pullTable("attendance_settings", attendanceSettings, (s) => ({
      id: s.id,
      dayOfWeek: s.day_of_week,
      startTime: s.start_time,
      endTime: s.end_time,
      lateThreshold: s.late_threshold,
      entityType: s.entity_type,
      isActive: s.is_active,
      updatedAt: safeDate(s.updated_at),
      createdAt: safeDate(s.created_at),
    }));

    // 6. Holidays
    await pullTable("holidays", holidays, (h) => ({
      id: h.id,
      date: h.date,
      name: h.name,
      updatedAt: safeDate(h.updated_at),
      createdAt: safeDate(h.created_at),
    }));

    // 7. Student Daily Attendance
    await pullTable(
      "student_daily_attendance",
      studentDailyAttendance,
      (a) => ({
        id: a.id,
        studentId: a.student_id,
        date: a.date,
        checkInTime: safeDate(a.check_in_time),
        checkOutTime: a.check_out_time ? safeDate(a.check_out_time) : null,
        status: a.status,
        lateDuration: a.late_duration,
        snapshotStudentName: a.snapshot_student_name,
        snapshotStudentNis: a.snapshot_student_nis,
        updatedAt: safeDate(a.updated_at),
      }),
    );

    // 8. Manual Attendance
    await pullTable("attendance", attendance, (a) => ({
      ...a,
      updatedAt: safeDate(a.updated_at),
      createdAt: safeDate(a.created_at),
    }));

    // 9. RBAC
    await pullTable("roles", roles, (r) => ({
      ...r,
      updatedAt: safeDate(r.updated_at),
      createdAt: safeDate(r.created_at),
    }));
    await pullTable("permissions", permissions, (p) => ({
      ...p,
      updatedAt: safeDate(p.updated_at),
      createdAt: safeDate(p.created_at),
    }));
    await pullTable("user_roles", userRoles, (ur) => ({
      ...ur,
      updatedAt: safeDate(ur.updated_at),
      createdAt: safeDate(ur.created_at),
    }));
    await pullTable("role_permissions", rolePermissions, (rp) => ({
      ...rp,
      updatedAt: safeDate(rp.updated_at),
      createdAt: safeDate(rp.created_at),
    }));

    // 10. Academic (New)
    await pullTable("tahun_ajaran", tahunAjaran, (t) => ({
      ...t,
      updatedAt: safeDate(t.updated_at),
      createdAt: safeDate(t.created_at),
    }));
    await pullTable("semester", semester, (s) => ({
      ...s,
      updatedAt: safeDate(s.updated_at),
      createdAt: safeDate(s.created_at),
    }));
    await pullTable("guru_mapel", guruMapel, (gm) => ({
      ...gm,
      updatedAt: safeDate(gm.updated_at),
      createdAt: safeDate(gm.created_at),
    }));
    await pullTable("jadwal", jadwal, (j) => ({
      ...j,
      updatedAt: safeDate(j.updated_at),
      createdAt: safeDate(j.created_at),
    }));

    // 11. Attendance (New)
    await pullTable("absensi", absensi, (a) => ({
      ...a,
      updatedAt: safeDate(a.updated_at),
      createdAt: safeDate(a.created_at),
    }));
    await pullTable("absensi_scan_logs", absensiScanLogs, (asl) => ({
      ...asl,
      updatedAt: safeDate(asl.updated_at),
      createdAt: safeDate(asl.created_at),
    }));
    await pullTable("student_id_cards", studentIdCards, (sic) => ({
      ...sic,
      updatedAt: safeDate(sic.updated_at),
      createdAt: safeDate(sic.created_at),
    }));
    await pullTable("absensi_config", absensiConfig, (ac) => ({
      ...ac,
      updatedAt: safeDate(ac.updated_at),
      createdAt: safeDate(ac.created_at),
    }));
    await pullTable("absensi_exceptions", absensiExceptions, (ae) => ({
      ...ae,
      updatedAt: safeDate(ae.updated_at),
      createdAt: safeDate(ae.created_at),
    }));

    // 12. Nilai & Raport
    await pullTable("nilai", nilai, (n) => ({
      ...n,
      updatedAt: safeDate(n.updated_at),
      createdAt: safeDate(n.created_at),
    }));
    await pullTable("raport", raport, (r) => ({
      ...r,
      updatedAt: safeDate(r.updated_at),
      createdAt: safeDate(r.created_at),
    }));

    // 13. Finance
    await pullTable("kategori_biaya", kategoriBiaya, (kb) => ({
      ...kb,
      updatedAt: safeDate(kb.updated_at),
      createdAt: safeDate(kb.created_at),
    }));
    await pullTable("tagihan", tagihan, (t) => ({
      ...t,
      updatedAt: safeDate(t.updated_at),
      createdAt: safeDate(t.created_at),
    }));
    await pullTable("pembayaran", pembayaran, (p) => ({
      ...p,
      updatedAt: safeDate(p.updated_at),
      createdAt: safeDate(p.created_at),
    }));

    // 14. Communication
    await pullTable("pengumuman", pengumuman, (p) => ({
      ...p,
      updatedAt: safeDate(p.updated_at),
      createdAt: safeDate(p.created_at),
    }));
    await pullTable("notifikasi", notifikasi, (n) => ({
      ...n,
      updatedAt: safeDate(n.updated_at),
      createdAt: safeDate(n.created_at),
    }));
    await pullTable("percakapan", percakapan, (p) => ({
      ...p,
      updatedAt: safeDate(p.updated_at),
      createdAt: safeDate(p.created_at),
    }));
    await pullTable("peserta_percakapan", pesertaPercakapan, (pp) => ({
      ...pp,
      updatedAt: safeDate(pp.updated_at),
      createdAt: safeDate(pp.created_at),
    }));
    await pullTable("pesan", pesan, (p) => ({
      ...p,
      updatedAt: safeDate(p.updated_at),
      createdAt: safeDate(p.created_at),
    }));

    // 15. Library
    await pullTable("buku", buku, (b) => ({
      ...b,
      updatedAt: safeDate(b.updated_at),
      createdAt: safeDate(b.created_at),
    }));
    await pullTable("anggota_perpustakaan", anggotaPerpustakaan, (ap) => ({
      ...ap,
      updatedAt: safeDate(ap.updated_at),
      createdAt: safeDate(ap.created_at),
    }));
    await pullTable("peminjaman_buku", peminjamanBuku, (pb) => ({
      ...pb,
      updatedAt: safeDate(pb.updated_at),
      createdAt: safeDate(pb.created_at),
    }));

    // 16. HR
    await pullTable("pegawai", pegawai, (p) => ({
      ...p,
      updatedAt: safeDate(p.updated_at),
      createdAt: safeDate(p.created_at),
    }));
    await pullTable("cuti", cuti, (c) => ({
      ...c,
      updatedAt: safeDate(c.updated_at),
      createdAt: safeDate(c.created_at),
    }));
    await pullTable("gaji_pegawai", gajiPegawai, (gp) => ({
      ...gp,
      updatedAt: safeDate(gp.updated_at),
      createdAt: safeDate(gp.created_at),
    }));

    // 17. Inventory
    await pullTable("kategori_inventaris", kategoriInventaris, (ki) => ({
      ...ki,
      updatedAt: safeDate(ki.updated_at),
      createdAt: safeDate(ki.created_at),
    }));
    await pullTable("aset", aset, (a) => ({
      ...a,
      updatedAt: safeDate(a.updated_at),
      createdAt: safeDate(a.created_at),
    }));
    await pullTable("peminjaman_aset", peminjamanAset, (pa) => ({
      ...pa,
      updatedAt: safeDate(pa.updated_at),
      createdAt: safeDate(pa.created_at),
    }));
    await pullTable("stok_barang", stokBarang, (sb) => ({
      ...sb,
      updatedAt: safeDate(sb.updated_at),
      createdAt: safeDate(sb.created_at),
    }));
    await pullTable("transaksi_stok", transaksiStok, (ts) => ({
      ...ts,
      updatedAt: safeDate(ts.updated_at),
      createdAt: safeDate(ts.created_at),
    }));

    // 18. Transport
    await pullTable("kendaraan", kendaraan, (k) => ({
      ...k,
      updatedAt: safeDate(k.updated_at),
      createdAt: safeDate(k.created_at),
    }));

    // 19. Projection sync (users -> students/classes + default attendance settings)
    await syncUsersToStudentsProjection();

    return {
      status: "success",
      message:
        downloadedCount + updatedCount === 0
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
    message: `Sync complete! Uploaded ${pushResult.uploaded || 0}, Downloaded ${
      pullResult.downloaded || 0
    } records.`,
    uploaded: pushResult.uploaded,
    downloaded: pullResult.downloaded,
  };
}
