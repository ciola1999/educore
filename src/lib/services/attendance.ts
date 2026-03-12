import { differenceInMinutes, format, isAfter, parse } from "date-fns";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  attendance,
  attendanceSettings,
  classes,
  holidays,
  studentDailyAttendance,
  studentIdCards,
  students,
  users,
} from "@/lib/db/schema";
import { ensureDefaultAttendanceSettings } from "@/lib/services/student-projection";

// --- TYPES ---
export type ScanResult = {
  success: boolean;
  message: string;
  data?: {
    fullName: string;
    nis: string;
    grade: string; // ✅ DITAMBAHKAN: Kelas siswa
    time: string; // HH:mm format
    status: "on-time" | "late";
    type: "in" | "out"; // ✅ DITAMBAHKAN: Penanda absen masuk atau pulang untuk UI
    lateMinutes: number;
    photo?: string;
  };
  type: "CHECK_IN" | "CHECK_OUT" | "ERROR";
};

// --- HELPERS ---
function parseTimeSetting(timeStr: string): Date {
  // Mengubah jam string (misal "07:30") menjadi Date Object hari ini
  return parse(timeStr, "HH:mm", new Date());
}

type ResolvedStudent = {
  id: string;
  fullName: string;
  nis: string;
  grade: string; // ✅ DITAMBAHKAN di Helper
  photo?: string;
};

function toUniqueValues(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      values.map((value) => value?.trim()).filter(Boolean) as string[],
    ),
  ];
}

function extractQrCandidates(qrData: string): {
  nisCandidates: string[];
  tokenCandidates: string[];
  idCandidates: string[];
} {
  const raw = qrData.trim();

  if (!raw) {
    return { nisCandidates: [], tokenCandidates: [], idCandidates: [] };
  }

  const nisCandidates: string[] = [raw];
  const tokenCandidates: string[] = [];
  const idCandidates: string[] = [];

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed && typeof parsed === "object") {
      const getString = (key: string): string | undefined => {
        const value = parsed[key];
        return typeof value === "string" ? value : undefined;
      };

      nisCandidates.push(getString("nis") ?? "");
      nisCandidates.push(getString("studentNis") ?? "");
      nisCandidates.push(getString("idNumber") ?? "");

      tokenCandidates.push(getString("token") ?? "");
      tokenCandidates.push(getString("cardToken") ?? "");
      tokenCandidates.push(getString("card_number") ?? "");
      tokenCandidates.push(getString("cardNumber") ?? "");

      idCandidates.push(getString("studentId") ?? "");
      idCandidates.push(getString("student_id") ?? "");
      idCandidates.push(getString("userId") ?? "");
      idCandidates.push(getString("id") ?? "");
    }
  } catch {
    // QR bukan JSON, lanjutkan dengan raw parsing
  }

  const taggedValue = raw.match(
    /(?:nis|token|id|card)\s*[:=]\s*([A-Za-z0-9._-]+)/i,
  )?.[1];
  if (taggedValue) {
    nisCandidates.push(taggedValue);
    tokenCandidates.push(taggedValue);
    idCandidates.push(taggedValue);
  }

  return {
    nisCandidates: toUniqueValues(nisCandidates),
    tokenCandidates: toUniqueValues(tokenCandidates),
    idCandidates: toUniqueValues(idCandidates),
  };
}

async function ensureStudentMirrorFromUser(
  user: typeof users.$inferSelect,
): Promise<ResolvedStudent | null> {
  const db = await getDb();

  const userNis = user.nis?.trim();
  if (!userNis) {
    return null;
  }

  const byNis = await db
    .select()
    .from(students)
    .where(and(eq(students.nis, userNis), isNull(students.deletedAt)))
    .limit(1);
  const existingStudent = byNis[0];

  if (existingStudent) {
    return {
      id: existingStudent.id,
      fullName: existingStudent.fullName,
      nis: existingStudent.nis,
      grade: existingStudent.grade || "UNASSIGNED", // ✅ MENGEMBALIKAN GRADE
      photo: user.foto ?? undefined,
    };
  }

  const normalizedGender = user.jenisKelamin === "P" ? "P" : "L";

  let normalizedGrade = "UNASSIGNED";
  const rawClassRef = user.kelasId?.trim();
  if (rawClassRef) {
    const classMatch = await db
      .select({ name: classes.name })
      .from(classes)
      .where(and(eq(classes.id, rawClassRef), isNull(classes.deletedAt)))
      .limit(1);

    normalizedGrade = classMatch[0]?.name || rawClassRef;
  }

  try {
    await db.insert(students).values({
      id: user.id,
      nis: userNis,
      fullName: user.fullName,
      gender: normalizedGender,
      grade: normalizedGrade,
      parentName: null,
      parentPhone: null,
      syncStatus: "pending",
      updatedAt: new Date(),
    });
  } catch {
    // Kemungkinan race/duplikasi NIS, fetch ulang sebagai sumber kebenaran
  }

  const syncedStudent = await db
    .select()
    .from(students)
    .where(and(eq(students.nis, userNis), isNull(students.deletedAt)))
    .limit(1);

  const student = syncedStudent[0];
  if (!student) {
    return null;
  }

  return {
    id: student.id,
    fullName: student.fullName,
    nis: student.nis,
    grade: student.grade || "UNASSIGNED", // ✅ MENGEMBALIKAN GRADE
    photo: user.foto ?? undefined,
  };
}

async function resolveStudentFromQr(
  qrData: string,
): Promise<ResolvedStudent | null> {
  const db = await getDb();
  const { nisCandidates, tokenCandidates, idCandidates } =
    extractQrCandidates(qrData);

  if (tokenCandidates.length > 0) {
    const cardList = await db
      .select()
      .from(studentIdCards)
      .where(
        and(
          or(
            inArray(studentIdCards.token, tokenCandidates),
            inArray(studentIdCards.cardNumber, tokenCandidates),
          ),
          eq(studentIdCards.isActive, true),
          isNull(studentIdCards.revokedAt),
          isNull(studentIdCards.deletedAt),
        ),
      )
      .limit(1);

    const card = cardList[0];
    if (card) {
      const userList = await db
        .select()
        .from(users)
        .where(and(eq(users.id, card.studentId), isNull(users.deletedAt)))
        .limit(1);
      const user = userList[0];

      if (user) {
        return await ensureStudentMirrorFromUser(user);
      }

      const studentList = await db
        .select()
        .from(students)
        .where(and(eq(students.id, card.studentId), isNull(students.deletedAt)))
        .limit(1);
      const student = studentList[0];

      if (student) {
        return {
          id: student.id,
          fullName: student.fullName,
          nis: student.nis,
          grade: student.grade || "UNASSIGNED", // ✅ GRADE DISERTAKAN
        };
      }
    }
  }

  const validNisCandidates = nisCandidates.filter(
    (candidate) => candidate.length >= 3,
  );
  if (validNisCandidates.length > 0) {
    const studentList = await db
      .select()
      .from(students)
      .where(
        and(
          inArray(students.nis, validNisCandidates),
          isNull(students.deletedAt),
        ),
      )
      .limit(1);
    const student = studentList[0];

    if (student) {
      return {
        id: student.id,
        fullName: student.fullName,
        nis: student.nis,
        grade: student.grade || "UNASSIGNED", // ✅ GRADE DISERTAKAN
      };
    }
  }

  const allUserCandidates = toUniqueValues([
    ...validNisCandidates,
    ...idCandidates,
  ]);
  if (allUserCandidates.length > 0) {
    const userList = await db
      .select()
      .from(users)
      .where(
        and(
          or(
            inArray(users.nis, allUserCandidates),
            inArray(users.id, allUserCandidates),
          ),
          isNull(users.deletedAt),
          eq(users.isActive, true),
        ),
      )
      .limit(1);
    const user = userList[0];

    if (user) {
      return await ensureStudentMirrorFromUser(user);
    }
  }

  return null;
}

// --- CORE FUNCTION (SCAN QR) ---
export async function processQRScan(qrData: string): Promise<ScanResult> {
  const db = await getDb();
  const normalizedQr = qrData.trim();

  if (!normalizedQr || normalizedQr.length < 3) {
    return {
      success: false,
      message: "Format QR Code tidak valid atau tidak terbaca.",
      type: "ERROR",
    };
  }

  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");
  const currentTimeStr = format(now, "HH:mm");
  const dayOfWeek = now.getDay(); // 0 (Minggu) - 6 (Sabtu)

  try {
    // 2. Cek Hari Libur
    const holidayList = await db
      .select()
      .from(holidays)
      .where(eq(holidays.date, todayStr))
      .limit(1);
    const isHoliday = holidayList[0];

    if (isHoliday) {
      return {
        success: false,
        message: `Hari ini libur: ${isHoliday.name || "Tanpa Keterangan"}`,
        type: "ERROR",
      };
    }

    // 3. Resolve student dari QR (NIS / token / user id) + auto-sync users -> students
    const student = await resolveStudentFromQr(normalizedQr);

    if (!student) {
      return {
        success: false,
        message:
          "Data siswa tidak ditemukan atau belum tersinkron. Pastikan NIS/token kartu sudah terdaftar.",
        type: "ERROR",
      };
    }

    // 4. Ambil Pengaturan Jadwal Hari Ini
    let lateThresholdTime = parseTimeSetting("07:15");

    const settingsList = await db
      .select()
      .from(attendanceSettings)
      .where(
        and(
          eq(attendanceSettings.dayOfWeek, dayOfWeek),
          eq(attendanceSettings.entityType, "student"),
          eq(attendanceSettings.isActive, true),
        ),
      )
      .limit(1);
    const settings = settingsList[0];

    if (settings) {
      lateThresholdTime = parseTimeSetting(settings.lateThreshold);
    } else if (dayOfWeek === 0) {
      return {
        success: false,
        message: "Hari Minggu tidak ada jadwal sekolah.",
        type: "ERROR",
      };
    }

    // 5. Cek Apakah Sudah Absen Hari Ini?
    const checkRecords = await db
      .select()
      .from(studentDailyAttendance)
      .where(
        and(
          eq(studentDailyAttendance.studentId, student.id),
          eq(studentDailyAttendance.date, todayStr),
        ),
      )
      .limit(1);
    const existingRecord = checkRecords[0];

    // --- LOGIC CHECK-OUT (Jika sudah check-in sebelumnya) ---
    if (existingRecord) {
      if (existingRecord.checkOutTime) {
        return {
          success: false,
          message: `${student.fullName} sudah melakukan Check-out hari ini.`,
          type: "ERROR",
          data: {
            fullName: student.fullName,
            nis: student.nis,
            grade: student.grade, // ✅
            time: currentTimeStr,
            status: existingRecord.status === "LATE" ? "late" : "on-time",
            type: "out", // ✅
            lateMinutes: existingRecord.lateDuration || 0,
          },
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
        data: {
          fullName: student.fullName,
          nis: student.nis,
          grade: student.grade, // ✅
          time: currentTimeStr,
          status: existingRecord.status === "LATE" ? "late" : "on-time",
          type: "out", // ✅
          lateMinutes: existingRecord.lateDuration || 0,
        },
      };
    }

    // --- LOGIC CHECK-IN (Absen Masuk) ---
    let status: "on-time" | "late" = "on-time";
    let lateMinutes = 0;

    if (isAfter(now, lateThresholdTime)) {
      status = "late";
      lateMinutes = differenceInMinutes(now, lateThresholdTime);
    }

    // Simpan ke Database
    await db.insert(studentDailyAttendance).values({
      id: crypto.randomUUID(),
      studentId: student.id,
      snapshotStudentName: student.fullName,
      snapshotStudentNis: student.nis,
      date: todayStr,
      checkInTime: now,
      status: status === "late" ? "LATE" : "PRESENT",
      lateDuration: lateMinutes,
      syncStatus: "pending",
    });

    return {
      success: true,
      message:
        status === "late"
          ? `Terlambat ${lateMinutes} menit.`
          : `Check-in Berhasil. Selamat pagi, ${student.fullName.split(" ")[0]}!`,
      type: "CHECK_IN",
      data: {
        fullName: student.fullName,
        nis: student.nis,
        grade: student.grade, // ✅
        time: currentTimeStr,
        status,
        type: "in", // ✅
        lateMinutes,
      },
    };
  } catch (err: unknown) {
    // ✅ PERBAIKAN BIOME (Type-safe catch)
    const errorObj = err as Record<string, unknown>;
    const errorMessage = errorObj.message as string | undefined;

    // Handle UNIQUE constraint (Duplicate scan race condition)
    if (errorMessage?.includes("UNIQUE") || errorObj.code === 2067) {
      return {
        success: false,
        message:
          "Proses terlalu cepat atau data sudah tercatat. Silakan coba lagi.",
        type: "ERROR",
      };
    }

    return {
      success: false,
      message: "Terjadi kesalahan sistem internal.",
      type: "ERROR",
    };
  }
}

// ... (Pengaturan Settings, Holiday, dan Bulk Attendance tetap sama seperti aslinya)

export async function getAttendanceSettings() {
  await ensureDefaultAttendanceSettings();
  const db = await getDb();
  return await db.select().from(attendanceSettings);
}

export async function upsertAttendanceSetting(
  data: typeof attendanceSettings.$inferInsert,
) {
  const db = await getDb();
  if (data.id && !data.id.startsWith("temp-")) {
    return await db
      .update(attendanceSettings)
      .set({ ...data, updatedAt: new Date(), syncStatus: "pending" })
      .where(eq(attendanceSettings.id, data.id));
  }
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

export type BulkAttendanceInput = {
  classId: string;
  date: string;
  recordedBy: string;
  records: {
    studentId: string;
    status: "present" | "sick" | "permission" | "alpha";
    notes?: string;
  }[];
};

export async function recordBulkAttendance(data: BulkAttendanceInput) {
  const db = await getDb();
  try {
    for (const record of data.records) {
      const existingList = await db
        .select()
        .from(attendance)
        .where(
          and(
            eq(attendance.studentId, record.studentId),
            eq(attendance.date, data.date),
            eq(attendance.classId, data.classId),
          ),
        )
        .limit(1);
      const existing = existingList[0];

      if (existing) {
        await db
          .update(attendance)
          .set({
            status: record.status,
            notes: record.notes,
            recordedBy: data.recordedBy,
            syncStatus: "pending",
            updatedAt: new Date(),
          })
          .where(eq(attendance.id, existing.id));
      } else {
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
  } catch {
    return { success: false, message: "Gagal menyimpan data absensi" };
  }
}

export async function getTodayAttendanceRecords() {
  const db = await getDb();
  const todayStr = format(new Date(), "yyyy-MM-dd");

  return await db
    .select()
    .from(studentDailyAttendance)
    .where(eq(studentDailyAttendance.date, todayStr))
    .orderBy(desc(studentDailyAttendance.checkInTime));
}
