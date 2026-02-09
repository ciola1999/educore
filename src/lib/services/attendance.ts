import { getDb } from "@/lib/db";
import {
  attendance,
  attendanceSettings,
  holidays,
  studentDailyAttendance,
  students,
} from "@/lib/db/schema";
import { scanSchema } from "@/lib/validations/schemas";
import { differenceInMinutes, format, isAfter, parse } from "date-fns";
import { and, eq } from "drizzle-orm";

// --- TYPES ---
export type ScanResult = {
  success: boolean;
  message: string;
  data?: {
    studentName: string;
    nis: string;
    checkInTime: Date;
    status: "PRESENT" | "LATE" | "EXCUSED";
    lateDuration?: number; // menit
  };
  type: "CHECK_IN" | "CHECK_OUT" | "ERROR";
};

// --- HELPERS ---
function parseTimeSetting(timeStr: string): Date {
  // Mengubah jam string (misal "07:30") menjadi Date Object hari ini
  return parse(timeStr, "HH:mm", new Date());
}

// --- CORE FUNCTION (SCAN QR) ---
export async function processQRScan(qrData: string): Promise<ScanResult> {
  const db = await getDb();
  
  // 1. Validasi Input (Format NIS)
  const validation = scanSchema.safeParse({ nis: qrData });
  if (!validation.success) {
      return { 
          success: false, 
          message: "Format QR Code tidak valid/terbaca.", 
          type: "ERROR" 
      };
  }
  const cleanNis = validation.data.nis;

  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");
  const dayOfWeek = now.getDay(); // 0 (Minggu) - 6 (Sabtu)

  try {
    // 2. Cek Hari Libur
    const isHoliday = await db.query.holidays.findFirst({
      where: eq(holidays.date, todayStr),
    });

    if (isHoliday) {
      return {
        success: false,
        message: `Hari ini libur: ${isHoliday.name}`,
        type: "ERROR",
      };
    }

    // 3. Cari Data Siswa berdasarkan NIS
    const student = await db.query.students.findFirst({
      where: eq(students.nis, cleanNis),
      columns: { id: true, fullName: true, nis: true },
    });

    if (!student) {
      return {
        success: false,
        message: "QR Code tidak dikenali (Siswa tidak ditemukan)",
        type: "ERROR",
      };
    }

    // 4. Ambil Pengaturan Jadwal Hari Ini
    // Default fallback jika setting belum dibuat: Masuk 07:15
    let lateThresholdTime = parseTimeSetting("07:15"); 
    
    const settings = await db.query.attendanceSettings.findFirst({
      where: and(
        eq(attendanceSettings.dayOfWeek, dayOfWeek),
        eq(attendanceSettings.entityType, "student"),
        eq(attendanceSettings.isActive, true),
      ),
    });

    if (settings) {
      lateThresholdTime = parseTimeSetting(settings.lateThreshold);
    } else if (dayOfWeek === 0) {
      // Jika hari Minggu & tidak ada setting khusus
      return {
        success: false,
        message: "Hari Minggu tidak ada jadwal",
        type: "ERROR",
      };
    }

    // 5. Cek Apakah Sudah Absen Hari Ini?
    const existingRecord = await db.query.studentDailyAttendance.findFirst({
      where: and(
        eq(studentDailyAttendance.studentId, student.id),
        eq(studentDailyAttendance.date, todayStr),
      ),
    });

    // --- LOGIC CHECK-OUT (Jika sudah check-in sebelumnya) ---
    if (existingRecord) {
      if (existingRecord.checkOutTime) {
        return {
          success: false,
          message: "Siswa sudah Check-out hari ini.",
          type: "ERROR",
        };
      }

      // Update waktu pulang
      await db
        .update(studentDailyAttendance)
        .set({
          checkOutTime: now,
          updatedAt: new Date(),
          syncStatus: "pending",
        })
        .where(eq(studentDailyAttendance.id, existingRecord.id));

      return {
        success: true,
        message: `Goodbye ${student.fullName.split(" ")[0]}! Hati-hati di jalan.`,
        type: "CHECK_OUT",
      };
    }

    // --- LOGIC CHECK-IN (Absen Masuk) ---

    // Hitung Keterlambatan
    let status: "PRESENT" | "LATE" = "PRESENT";
    let lateDuration = 0;

    if (isAfter(now, lateThresholdTime)) {
      status = "LATE";
      lateDuration = differenceInMinutes(now, lateThresholdTime);
    }

    // Simpan ke Database
    await db.insert(studentDailyAttendance).values({
      id: crypto.randomUUID(), 
      studentId: student.id,
      snapshotStudentName: student.fullName,
      snapshotStudentNis: student.nis,
      date: todayStr,
      checkInTime: now,
      status: status,
      lateDuration: lateDuration,
      syncStatus: "pending",
    });

    return {
      success: true,
      message:
        status === "LATE"
          ? `Terlambat ${lateDuration} menit`
          : "Check-in Berhasil",
      type: "CHECK_IN",
      data: {
        studentName: student.fullName,
        nis: student.nis,
        checkInTime: now,
        status,
        lateDuration,
      },
    };

  } catch (err) {
    console.error("[SCAN ERROR]", err);
    return {
      success: false,
      message: "Terjadi kesalahan sistem internal",
      type: "ERROR",
    };
  }
}

// --- SETTINGS CRUD (Pengaturan Jam) ---

export async function getAttendanceSettings() {
  const db = await getDb();
  return await db.select().from(attendanceSettings);
}

export async function upsertAttendanceSetting(
  data: typeof attendanceSettings.$inferInsert,
) {
  const db = await getDb();

  // Jika ID ada dan bukan temp ID, lakukan UPDATE
  if (data.id && !data.id.startsWith("temp-")) {
    return await db
      .update(attendanceSettings)
      .set({ ...data, updatedAt: new Date(), syncStatus: "pending" })
      .where(eq(attendanceSettings.id, data.id));
  }
  
  // Jika tidak, lakukan INSERT baru
  return await db.insert(attendanceSettings).values({
    ...data,
    id: crypto.randomUUID(),
    updatedAt: new Date(),
    syncStatus: "pending",
  });
}

export async function deleteAttendanceSetting(id: string) {
  const db = await getDb();
  return await db
    .delete(attendanceSettings)
    .where(eq(attendanceSettings.id, id));
}

// --- HOLIDAYS CRUD (Hari Libur) ---

export async function getHolidays() {
  const db = await getDb();
  return await db.select().from(holidays);
}

export async function addHoliday(date: string, name: string) {
  const db = await getDb();
  return await db.insert(holidays).values({
    id: crypto.randomUUID(),
    date,
    name,
  });
}

// ==========================================
// 2. MANUAL ATTENDANCE (JURNAL GURU)
// ✅ INI YANG SEBELUMNYA HILANG
// ==========================================
export type BulkAttendanceInput = {
  classId: string;
  date: string; // YYYY-MM-DD
  recordedBy: string; // User ID (Guru)
  records: {
    studentId: string;
    status: "present" | "sick" | "permission" | "alpha"; 
    notes?: string;
  }[];
};

export async function recordBulkAttendance(data: BulkAttendanceInput) {
  const db = await getDb();

  try {
    // Kita loop setiap record siswa
    for (const record of data.records) {
      // 1. Cek apakah sudah ada data absen untuk siswa ini di tanggal & kelas tsb
      const existing = await db.query.attendance.findFirst({
        where: and(
          eq(attendance.studentId, record.studentId),
          eq(attendance.date, data.date),
          eq(attendance.classId, data.classId)
        ),
      });

      if (existing) {
        // 2a. UPDATE jika sudah ada
        await db
          .update(attendance)
          .set({
            status: record.status,
            notes: record.notes,
            recordedBy: data.recordedBy,
            syncStatus: "pending", // Tandai pending agar ter-sync ke cloud nanti
            updatedAt: new Date(),
          })
          .where(eq(attendance.id, existing.id));
      } else {
        // 2b. INSERT jika belum ada
        await db.insert(attendance).values({
          id: crypto.randomUUID(),
          studentId: record.studentId,
          classId: data.classId,
          date: data.date,
          status: record.status,
          notes: record.notes,
          recordedBy: data.recordedBy,
          syncStatus: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    return { success: true, message: "Data absensi berhasil disimpan" };
  } catch (error) {
    console.error("Bulk attendance error:", error);
    return { success: false, message: "Gagal menyimpan data absensi" };
  }
}