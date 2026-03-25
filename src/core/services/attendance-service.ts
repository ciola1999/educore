import { differenceInMinutes, format, isAfter, parse } from "date-fns";
import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  like,
  lte,
  ne,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import {
  attendanceHistoryFilterSchema,
  attendanceSettingsSchema,
  type BulkAttendanceInput,
  bulkAttendanceSchema,
  holidayInputSchema,
} from "@/core/validation/schemas";
import { getDb } from "@/lib/db";
import {
  absensiConfig,
  attendance,
  attendanceSettings,
  classes,
  holidays,
  notifikasi,
  studentDailyAttendance,
  studentIdCards,
  students,
  users,
} from "@/lib/db/schema";
import { ensureDefaultAttendanceSettings } from "@/lib/services/student-projection";
import {
  isUuidLikeClassValue,
  sanitizeClassDisplayName,
} from "@/lib/utils/class-name";

export type AttendanceRosterStudent = {
  id: string;
  nis: string;
  nisn: string | null;
  fullName: string;
  grade: string;
  parentName: string | null;
  parentPhone: string | null;
  tempatLahir: string | null;
  tanggalLahir: Date | null;
  alamat: string | null;
};

export async function getAttendanceRosterStudents(classId: string): Promise<{
  className: string | null;
  students: AttendanceRosterStudent[];
}> {
  const db = await getDb();

  if (classId === "all") {
    const allStudents = await db
      .select({
        id: students.id,
        nis: students.nis,
        nisn: students.nisn,
        fullName: students.fullName,
        grade: students.grade,
        parentName: students.parentName,
        parentPhone: students.parentPhone,
        tempatLahir: students.tempatLahir,
        tanggalLahir: students.tanggalLahir,
        alamat: students.alamat,
      })
      .from(students)
      .where(isNull(students.deletedAt));

    return {
      className: null,
      students: allStudents,
    };
  }

  const classData = await db
    .select({ id: classes.id, name: classes.name })
    .from(classes)
    .where(
      and(
        eq(classes.id, classId),
        eq(classes.isActive, true),
        isNull(classes.deletedAt),
      ),
    )
    .limit(1);

  if (!classData[0]) {
    throw new Error("Kelas tidak ditemukan");
  }

  const rosterStudents = await db
    .select({
      id: students.id,
      nis: students.nis,
      nisn: students.nisn,
      fullName: students.fullName,
      grade: students.grade,
      parentName: students.parentName,
      parentPhone: students.parentPhone,
      tempatLahir: students.tempatLahir,
      tanggalLahir: students.tanggalLahir,
      alamat: students.alamat,
    })
    .from(students)
    .where(
      and(
        or(
          eq(sql`LOWER(${students.grade})`, classData[0].name.toLowerCase()),
          eq(students.grade, classData[0].id),
        ),
        isNull(students.deletedAt),
      ),
    );

  const userLinkedRows = await db
    .select({ studentId: users.id })
    .from(users)
    .where(
      and(
        eq(users.kelasId, classId),
        eq(users.role, "student"),
        eq(users.isActive, true),
        isNull(users.deletedAt),
      ),
    )
    .limit(5000);
  const userLinkedStudentIds = userLinkedRows.map((row) => row.studentId);

  let mergedStudents = rosterStudents;
  if (userLinkedStudentIds.length > 0) {
    const byUserClass = await db
      .select({
        id: students.id,
        nis: students.nis,
        nisn: students.nisn,
        fullName: students.fullName,
        grade: students.grade,
        parentName: students.parentName,
        parentPhone: students.parentPhone,
        tempatLahir: students.tempatLahir,
        tanggalLahir: students.tanggalLahir,
        alamat: students.alamat,
      })
      .from(students)
      .where(
        and(
          inArray(students.id, userLinkedStudentIds),
          isNull(students.deletedAt),
        ),
      )
      .limit(5000);

    const dedup = new Map(
      mergedStudents.map((student) => [student.id, student]),
    );
    for (const student of byUserClass) {
      if (!dedup.has(student.id)) {
        dedup.set(student.id, {
          ...student,
          grade: classData[0].name,
        });
      }
    }
    mergedStudents = [...dedup.values()];
  }

  return {
    className: classData[0].name,
    students: mergedStudents,
  };
}

export type ScanResult = {
  success: boolean;
  message: string;
  data?: {
    fullName: string;
    nis: string;
    grade: string;
    time: string;
    status: "on-time" | "late";
    type: "in" | "out";
    lateMinutes: number;
    photo?: string;
  };
  type: "CHECK_IN" | "CHECK_OUT" | "ERROR";
};

type ResolvedStudent = {
  id: string;
  fullName: string;
  nis: string;
  grade: string;
  photo?: string;
};

type AttendanceHistoryClassRow = {
  className: string | null;
  studentGrade?: string | null;
};

function parseTimeSetting(timeStr: string): Date {
  return parse(timeStr, "HH:mm", new Date());
}

async function resolveAttendanceHistoryClassNames<
  T extends AttendanceHistoryClassRow,
>(db: Awaited<ReturnType<typeof getDb>>, rows: T[]): Promise<T[]> {
  const classIds = [
    ...new Set(
      rows
        .flatMap((row) => [row.className, row.studentGrade])
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
        .filter((value) => isUuidLikeClassValue(value)),
    ),
  ];

  if (classIds.length === 0) {
    return rows.map((row) => ({
      ...row,
      className: sanitizeClassDisplayName(row.className, row.studentGrade),
    }));
  }

  const classRows = await db
    .select({ id: classes.id, name: classes.name })
    .from(classes)
    .where(and(inArray(classes.id, classIds), isNull(classes.deletedAt)));
  const classNameById = new Map(classRows.map((row) => [row.id, row.name]));

  return rows.map((row) => ({
    ...row,
    className: sanitizeClassDisplayName(
      row.className,
      row.studentGrade ? classNameById.get(row.studentGrade.trim()) : null,
      row.studentGrade,
      row.className ? classNameById.get(row.className.trim()) : null,
    ),
  }));
}

function toUniqueValues(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((v) => v?.trim()).filter(Boolean) as string[])];
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
  } catch {
    // QR payload is not JSON.
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

async function resolveStudentFromQr(
  qrData: string,
): Promise<ResolvedStudent | null> {
  const db = await getDb();
  const { nisCandidates, tokenCandidates, idCandidates } =
    extractQrCandidates(qrData);

  // 1. Efficient Card Lookup
  if (tokenCandidates.length > 0) {
    const cardQuery = await db
      .select({
        studentId: studentIdCards.studentId,
        studentNis: students.nis,
        studentName: students.fullName,
        grade: students.grade,
        accountClassId: users.kelasId,
        accountClassName: classes.name,
        photo: users.foto,
      })
      .from(studentIdCards)
      .leftJoin(students, eq(studentIdCards.studentId, students.id))
      .leftJoin(users, eq(studentIdCards.studentId, users.id))
      .leftJoin(classes, eq(users.kelasId, classes.id))
      .where(
        and(
          or(
            inArray(studentIdCards.token, tokenCandidates),
            inArray(studentIdCards.cardNumber, tokenCandidates),
          ),
          eq(studentIdCards.isActive, true),
          isNull(studentIdCards.revokedAt),
          isNull(studentIdCards.deletedAt),
          isNull(students.deletedAt),
        ),
      )
      .limit(1);

    if (cardQuery[0]) {
      return {
        id: cardQuery[0].studentId,
        fullName: cardQuery[0].studentName || "UNKNOWN",
        nis: cardQuery[0].studentNis || "UNKNOWN",
        grade:
          cardQuery[0].accountClassName || cardQuery[0].grade || "UNASSIGNED",
        photo: cardQuery[0].photo ?? undefined,
      };
    }
  }

  // 2. Direct Student/User Lookup (Fallback)
  const allCandidates = toUniqueValues([
    ...nisCandidates,
    ...idCandidates,
  ]).filter((c) => c.length >= 3);

  if (allCandidates.length > 0) {
    const directQuery = await db
      .select({
        id: students.id,
        fullName: students.fullName,
        nis: students.nis,
        grade: students.grade,
        accountClassName: classes.name,
        photo: users.foto,
      })
      .from(students)
      .leftJoin(users, eq(students.id, users.id))
      .leftJoin(classes, eq(users.kelasId, classes.id))
      .where(
        and(
          or(
            inArray(students.nis, allCandidates),
            inArray(students.id, allCandidates),
          ),
          isNull(students.deletedAt),
        ),
      )
      .limit(1);

    if (directQuery[0]) {
      return {
        id: directQuery[0].id,
        fullName: directQuery[0].fullName,
        nis: directQuery[0].nis,
        grade:
          directQuery[0].accountClassName ||
          directQuery[0].grade ||
          "UNASSIGNED",
        photo: directQuery[0].photo ?? undefined,
      };
    }
  }

  return null;
}

export async function processQRScan(qrData: string): Promise<ScanResult> {
  const normalizedQr = (qrData || "").trim();

  if (!normalizedQr || normalizedQr.length < 3 || normalizedQr.length > 512) {
    return {
      success: false,
      message: "Format QR Code tidak valid atau tidak terbaca.",
      type: "ERROR",
    };
  }

  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");
  const currentTimeStr = format(now, "HH:mm");
  const dayOfWeek = now.getDay();

  try {
    const db = await getDb();

    // 1. Resolve student and perform preliminary checks in parallel
    const [student, holiday, settings] = await Promise.all([
      resolveStudentFromQr(normalizedQr),
      db
        .select()
        .from(holidays)
        .where(and(eq(holidays.date, todayStr), isNull(holidays.deletedAt)))
        .limit(1),
      db
        .select()
        .from(attendanceSettings)
        .where(
          and(
            eq(attendanceSettings.dayOfWeek, dayOfWeek),
            eq(attendanceSettings.entityType, "student"),
            eq(attendanceSettings.isActive, true),
            isNull(attendanceSettings.deletedAt),
          ),
        )
        .limit(1),
    ]);

    if (!student) {
      return {
        success: false,
        message: "Siswa tidak ditemukan. Pastikan kartu terdaftar.",
        type: "ERROR",
      };
    }

    if (holiday[0]) {
      return {
        success: false,
        message: `Hari ini libur: ${holiday[0].name}`,
        type: "ERROR",
        data: {
          fullName: student.fullName,
          nis: student.nis,
          grade: student.grade,
          time: currentTimeStr,
          status: "on-time",
          type: "in",
          lateMinutes: 0,
          photo: student.photo,
        },
      };
    }

    let lateThreshold = parseTimeSetting("07:15");
    if (settings[0]) {
      lateThreshold = parseTimeSetting(settings[0].lateThreshold);
    } else if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Weekend check if no settings found
      return {
        success: false,
        message: "Tidak ada jadwal sekolah hari ini.",
        type: "ERROR",
      };
    }

    // 2. Check current status for today
    const existingRecord = await db
      .select()
      .from(studentDailyAttendance)
      .where(
        and(
          eq(studentDailyAttendance.studentId, student.id),
          eq(studentDailyAttendance.date, todayStr),
          isNull(studentDailyAttendance.deletedAt),
        ),
      )
      .limit(1);

    const existing = existingRecord[0];

    if (existing) {
      if (existing.checkOutTime) {
        return {
          success: false,
          message: "Anda sudah melakukan Check-out hari ini.",
          type: "ERROR",
          data: {
            fullName: student.fullName,
            nis: student.nis,
            grade: student.grade,
            time: currentTimeStr,
            status: existing.status === "LATE" ? "late" : "on-time",
            type: "out",
            lateMinutes: existing.lateDuration || 0,
            photo: student.photo,
          },
        };
      }

      // Record Check-out
      await db
        .update(studentDailyAttendance)
        .set({
          checkOutTime: now,
          updatedAt: now,
          syncStatus: "pending",
        })
        .where(eq(studentDailyAttendance.id, existing.id));

      return {
        success: true,
        message: `Hati-hati di jalan, ${student.fullName.split(" ")[0]}!`,
        type: "CHECK_OUT",
        data: {
          fullName: student.fullName,
          nis: student.nis,
          grade: student.grade,
          time: currentTimeStr,
          status: existing.status === "LATE" ? "late" : "on-time",
          type: "out",
          lateMinutes: existing.lateDuration || 0,
          photo: student.photo,
        },
      };
    }

    // 3. Record Check-in
    const status = isAfter(now, lateThreshold) ? "late" : "on-time";
    const lateMinutes =
      status === "late" ? differenceInMinutes(now, lateThreshold) : 0;

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
      createdAt: now,
      updatedAt: now,
    });

    return {
      success: true,
      message:
        status === "late"
          ? `Terlambat ${lateMinutes} menit.`
          : `Selamat pagi, ${student.fullName.split(" ")[0]}!`,
      type: "CHECK_IN",
      data: {
        fullName: student.fullName,
        nis: student.nis,
        grade: student.grade,
        time: currentTimeStr,
        status,
        type: "in",
        lateMinutes,
        photo: student.photo,
      },
    };
  } catch (error: unknown) {
    const err = error as Error & { code?: number };
    if (err?.message?.includes("UNIQUE") || err?.code === 2067) {
      return {
        success: false,
        message: "Data sudah tercatat. Silakan coba lagi.",
        type: "ERROR",
      };
    }
    return {
      success: false,
      message: `Kesalahan sistem: ${err?.message || "Internal error"}`,
      type: "ERROR",
    };
  }
}

export async function getAttendanceSettings() {
  await ensureDefaultAttendanceSettings();

  const db = await getDb();
  return db
    .select()
    .from(attendanceSettings)
    .where(isNull(attendanceSettings.deletedAt))
    .orderBy(attendanceSettings.entityType, attendanceSettings.dayOfWeek);
}

export async function upsertAttendanceSetting(
  data: typeof attendanceSettings.$inferInsert,
) {
  const db = await getDb();
  const normalizedInput = data.id?.startsWith("temp-")
    ? { ...data, id: undefined }
    : data;
  const parsed = attendanceSettingsSchema.safeParse(normalizedInput);

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message || "Invalid schedule setting",
    );
  }

  const now = new Date();
  const payload = parsed.data;

  if (
    parseTimeSetting(payload.startTime) >= parseTimeSetting(payload.endTime)
  ) {
    throw new Error("Jam masuk harus lebih kecil dari jam selesai");
  }

  const sameDayCondition = payload.id
    ? and(
        eq(attendanceSettings.dayOfWeek, payload.dayOfWeek),
        eq(attendanceSettings.entityType, payload.entityType),
        eq(attendanceSettings.isActive, true),
        isNull(attendanceSettings.deletedAt),
        ne(attendanceSettings.id, payload.id),
      )
    : and(
        eq(attendanceSettings.dayOfWeek, payload.dayOfWeek),
        eq(attendanceSettings.entityType, payload.entityType),
        eq(attendanceSettings.isActive, true),
        isNull(attendanceSettings.deletedAt),
      );

  const sameDayActive = await db
    .select({ id: attendanceSettings.id })
    .from(attendanceSettings)
    .where(sameDayCondition);

  if (payload.isActive && sameDayActive.length > 0) {
    for (const activeRow of sameDayActive) {
      await db
        .update(attendanceSettings)
        .set({
          isActive: false,
          syncStatus: "pending",
          updatedAt: now,
        })
        .where(eq(attendanceSettings.id, activeRow.id));
    }
  }

  if (payload.id && !payload.id.startsWith("temp-")) {
    return db
      .update(attendanceSettings)
      .set({
        ...payload,
        updatedAt: now,
        syncStatus: "pending",
      })
      .where(eq(attendanceSettings.id, payload.id));
  }

  return db.insert(attendanceSettings).values({
    ...payload,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    syncStatus: "pending",
  });
}

export async function deleteAttendanceSetting(id: string) {
  const db = await getDb();
  const now = new Date();

  return db
    .update(attendanceSettings)
    .set({
      deletedAt: now,
      updatedAt: now,
      syncStatus: "pending",
      isActive: false,
    })
    .where(eq(attendanceSettings.id, id));
}

export async function getHolidays() {
  const db = await getDb();
  return db
    .select()
    .from(holidays)
    .where(isNull(holidays.deletedAt))
    .orderBy(holidays.date);
}

export async function addHoliday(date: string, name: string) {
  const db = await getDb();
  const parsed = holidayInputSchema.safeParse({ date, name });

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message || "Data hari libur tidak valid",
    );
  }

  const now = new Date();
  const existing = await db
    .select({ id: holidays.id })
    .from(holidays)
    .where(and(eq(holidays.date, parsed.data.date), isNull(holidays.deletedAt)))
    .limit(1);

  if (existing[0]) {
    return db
      .update(holidays)
      .set({
        name: parsed.data.name,
        updatedAt: now,
        syncStatus: "pending",
      })
      .where(eq(holidays.id, existing[0].id));
  }

  return db.insert(holidays).values({
    id: crypto.randomUUID(),
    date: parsed.data.date,
    name: parsed.data.name,
    createdAt: now,
    updatedAt: now,
    syncStatus: "pending",
  });
}

export async function deleteHoliday(id: string) {
  const db = await getDb();
  const now = new Date();

  return db
    .update(holidays)
    .set({
      deletedAt: now,
      updatedAt: now,
      syncStatus: "pending",
    })
    .where(eq(holidays.id, id));
}

export async function recordBulkAttendance(data: BulkAttendanceInput) {
  const db = await getDb();
  const parsed = bulkAttendanceSchema.safeParse(data);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message || "Payload absensi tidak valid",
    };
  }

  const payload = parsed.data;
  const now = new Date();

  let rosterStudentIds: Set<string>;
  try {
    const roster = await getAttendanceRosterStudents(payload.classId);
    rosterStudentIds = new Set(roster.students.map((student) => student.id));
  } catch {
    return {
      success: false,
      message: "Kelas tidak ditemukan atau tidak aktif",
    };
  }

  const recorder = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.id, payload.recordedBy),
        eq(users.isActive, true),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  if (!recorder[0]) {
    return { success: false, message: "User pencatat absensi tidak valid" };
  }

  const normalizedMap = new Map<string, (typeof payload.records)[number]>();
  for (const record of payload.records) {
    normalizedMap.set(record.studentId, record);
  }
  const normalizedRecords = [...normalizedMap.values()];

  const studentIds = normalizedRecords.map((record) => record.studentId);
  const validStudents = await db
    .select({ id: students.id })
    .from(students)
    .where(and(inArray(students.id, studentIds), isNull(students.deletedAt)));
  const validStudentIds = new Set(validStudents.map((student) => student.id));

  const invalidStudentId = studentIds.find((id) => !validStudentIds.has(id));
  if (invalidStudentId) {
    return {
      success: false,
      message: "Ditemukan siswa tidak valid pada data absensi",
    };
  }

  const invalidRosterStudentId = studentIds.find(
    (id) => !rosterStudentIds.has(id),
  );
  if (invalidRosterStudentId) {
    return {
      success: false,
      message: "Ditemukan siswa di luar roster kelas yang dipilih",
    };
  }

  try {
    for (const record of normalizedRecords) {
      const existing = await db
        .select({ id: attendance.id })
        .from(attendance)
        .where(
          and(
            eq(attendance.studentId, record.studentId),
            eq(attendance.date, payload.date),
            eq(attendance.classId, payload.classId),
            isNull(attendance.deletedAt),
          ),
        )
        .limit(1);

      if (existing[0]) {
        await db
          .update(attendance)
          .set({
            status: record.status,
            notes: record.notes,
            recordedBy: payload.recordedBy,
            syncStatus: "pending",
            updatedAt: now,
          })
          .where(eq(attendance.id, existing[0].id));
        continue;
      }

      await db.insert(attendance).values({
        id: crypto.randomUUID(),
        studentId: record.studentId,
        classId: payload.classId,
        date: payload.date,
        status: record.status,
        notes: record.notes,
        recordedBy: payload.recordedBy,
        syncStatus: "pending",
        createdAt: now,
        updatedAt: now,
      });
    }

    return {
      success: true,
      message: `Data absensi berhasil disimpan (${normalizedRecords.length} siswa)`,
    };
  } catch {
    return { success: false, message: "Gagal menyimpan data absensi" };
  }
}

export async function getTodayAttendanceRecords() {
  const db = await getDb();
  const todayStr = format(new Date(), "yyyy-MM-dd");

  return db
    .select()
    .from(studentDailyAttendance)
    .where(
      and(
        eq(studentDailyAttendance.date, todayStr),
        isNull(studentDailyAttendance.deletedAt),
      ),
    )
    .orderBy(desc(studentDailyAttendance.checkInTime));
}

export type AttendanceHistoryFilter = {
  startDate?: string;
  endDate?: string;
  sortBy?: "earliest" | "latest";
  limit?: number;
  offset?: number;
  studentId?: string;
  status?: string;
  searchQuery?: string;
  source?: "all" | "qr" | "manual";
  className?: string;
};

const ATTENDANCE_HISTORY_EXPORT_BATCH = 500;

export type AttendanceHistoryRecord = {
  id: string;
  studentId: string;
  snapshotStudentName: string | null;
  snapshotStudentNis: string | null;
  className: string | null;
  date: string;
  checkInTime: Date | null;
  checkOutTime: Date | null;
  status: "PRESENT" | "LATE" | "EXCUSED" | "ABSENT";
  lateDuration: number | null;
  notes: string | null;
  syncStatus: "synced" | "pending" | "error";
  version: number;
  hlc: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  source: "qr" | "manual";
};

export type AttendanceHistorySummary = {
  total: number;
  present: number;
  late: number;
  excused: number;
  absent: number;
  qr: number;
  manual: number;
};

export type AttendanceHistoryClassSummary = {
  className: string;
  total: number;
  present: number;
  late: number;
  excused: number;
  absent: number;
  qr: number;
  manual: number;
  attendanceRate: number;
};

export type AttendanceHistoryStudentSummary = {
  studentId: string;
  studentName: string;
  nis: string;
  className: string;
  total: number;
  present: number;
  late: number;
  excused: number;
  absent: number;
  qr: number;
  manual: number;
  attendanceRate: number;
};

export type AttendanceHistoryTrendPoint = {
  label: string;
  period: string;
  total: number;
  present: number;
  late: number;
  excused: number;
  absent: number;
  attendanceRate: number;
};

export type AttendanceHistoryHeatmapPoint = {
  date: string;
  dayLabel: string;
  total: number;
  present: number;
  late: number;
  excused: number;
  absent: number;
  attendanceRate: number;
};

export type AttendanceHistoryAnalyticsBundle = {
  summary: AttendanceHistorySummary;
  classSummary: AttendanceHistoryClassSummary[];
  studentSummary: AttendanceHistoryStudentSummary[];
  trend: AttendanceHistoryTrendPoint[];
  heatmap: AttendanceHistoryHeatmapPoint[];
};

export type AttendanceRiskSettings = {
  alphaThreshold: number;
  lateThreshold: number;
  rateThreshold: number;
};

export type AttendanceRiskStudent = AttendanceHistoryStudentSummary & {
  riskFlags: string[];
};

const ATTENDANCE_RISK_SETTINGS_KEY = "attendance_risk_thresholds";

export const DEFAULT_ATTENDANCE_RISK_SETTINGS: AttendanceRiskSettings = {
  alphaThreshold: 3,
  lateThreshold: 5,
  rateThreshold: 75,
};

type NormalizedAttendanceHistoryStatus = {
  qrStatuses: Array<"PRESENT" | "LATE" | "EXCUSED" | "ABSENT">;
  manualStatuses: Array<"present" | "sick" | "permission" | "alpha">;
};

function resolveAttendanceHistoryStatus(
  status?: string,
): NormalizedAttendanceHistoryStatus | null {
  switch (status?.trim().toLowerCase()) {
    case undefined:
    case "":
    case "all":
      return null;
    case "present":
      return {
        qrStatuses: ["PRESENT"],
        manualStatuses: ["present"],
      };
    case "late":
      return {
        qrStatuses: ["LATE"],
        manualStatuses: [],
      };
    case "sick":
      return {
        qrStatuses: [],
        manualStatuses: ["sick"],
      };
    case "permission":
    case "excused":
      return {
        qrStatuses: ["EXCUSED"],
        manualStatuses: ["permission"],
      };
    case "alpha":
    case "absent":
      return {
        qrStatuses: ["ABSENT"],
        manualStatuses: ["alpha"],
      };
    default:
      throw new Error("Status absensi tidak valid");
  }
}

/**
 * Get attendance history with flexible filtering
 * Supports filtering by date range and sorting by check-in time
 */
export async function getAttendanceHistory(
  filter: AttendanceHistoryFilter,
): Promise<AttendanceHistoryRecord[]> {
  const parsed = attendanceHistoryFilterSchema.safeParse(filter);

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message || "Invalid filter parameters",
    );
  }

  const db = await getDb();
  const {
    startDate,
    endDate,
    sortBy = "latest",
    studentId,
    status,
    source = "all",
  } = parsed.data;
  const className = filter.className?.trim();
  const normalizedStatus = resolveAttendanceHistoryStatus(status);

  // Build conditions for QR records
  const qrConditions = [isNull(studentDailyAttendance.deletedAt)];
  if (startDate) qrConditions.push(gte(studentDailyAttendance.date, startDate));
  if (endDate) qrConditions.push(lte(studentDailyAttendance.date, endDate));
  if (studentId)
    qrConditions.push(eq(studentDailyAttendance.studentId, studentId));

  if (parsed.data.searchQuery) {
    const q = `%${parsed.data.searchQuery}%`;
    qrConditions.push(
      or(
        like(studentDailyAttendance.snapshotStudentName, q),
        like(studentDailyAttendance.snapshotStudentNis, q),
      ) as SQL,
    );
  }

  if (normalizedStatus?.qrStatuses.length === 1) {
    qrConditions.push(
      eq(studentDailyAttendance.status, normalizedStatus.qrStatuses[0]),
    );
  } else if (normalizedStatus && normalizedStatus.qrStatuses.length > 1) {
    qrConditions.push(
      inArray(studentDailyAttendance.status, normalizedStatus.qrStatuses),
    );
  }

  // Fetch QR records
  const qrResults =
    source === "manual"
      ? []
      : await db
          .select({
            id: studentDailyAttendance.id,
            studentId: studentDailyAttendance.studentId,
            snapshotStudentName: studentDailyAttendance.snapshotStudentName,
            snapshotStudentNis: studentDailyAttendance.snapshotStudentNis,
            className: classes.name,
            studentGrade: students.grade,
            date: studentDailyAttendance.date,
            checkInTime: studentDailyAttendance.checkInTime,
            checkOutTime: studentDailyAttendance.checkOutTime,
            status: studentDailyAttendance.status,
            lateDuration: studentDailyAttendance.lateDuration,
            syncStatus: studentDailyAttendance.syncStatus,
            version: studentDailyAttendance.version,
            hlc: studentDailyAttendance.hlc,
            createdAt: studentDailyAttendance.createdAt,
            updatedAt: studentDailyAttendance.updatedAt,
            deletedAt: studentDailyAttendance.deletedAt,
          })
          .from(studentDailyAttendance)
          .leftJoin(students, eq(studentDailyAttendance.studentId, students.id))
          .leftJoin(users, eq(studentDailyAttendance.studentId, users.id))
          .leftJoin(classes, eq(users.kelasId, classes.id))
          .where(and(...qrConditions));

  // Build conditions for Manual records
  const manualConditions = [isNull(attendance.deletedAt)];
  if (startDate) manualConditions.push(gte(attendance.date, startDate));
  if (endDate) manualConditions.push(lte(attendance.date, endDate));
  if (studentId) manualConditions.push(eq(attendance.studentId, studentId));

  if (parsed.data.searchQuery) {
    const q = `%${parsed.data.searchQuery}%`;
    manualConditions.push(
      or(like(students.fullName, q), like(students.nis, q)) as SQL,
    );
  }

  if (normalizedStatus?.manualStatuses.length === 1) {
    manualConditions.push(
      eq(attendance.status, normalizedStatus.manualStatuses[0]),
    );
  } else if (normalizedStatus && normalizedStatus.manualStatuses.length > 1) {
    manualConditions.push(
      inArray(attendance.status, normalizedStatus.manualStatuses),
    );
  }

  // Fetch Manual records with student details
  const manualResults =
    source === "qr"
      ? []
      : await db
          .select({
            id: attendance.id,
            studentId: attendance.studentId,
            date: attendance.date,
            status: attendance.status,
            fullName: students.fullName,
            nis: students.nis,
            className: classes.name,
            studentGrade: students.grade,
            notes: attendance.notes,
            createdAt: attendance.createdAt,
          })
          .from(attendance)
          .innerJoin(students, eq(attendance.studentId, students.id))
          .leftJoin(users, eq(attendance.studentId, users.id))
          .leftJoin(classes, eq(users.kelasId, classes.id))
          .where(and(...manualConditions));

  const [normalizedQrResults, normalizedManualResults] = await Promise.all([
    resolveAttendanceHistoryClassNames(db, qrResults),
    resolveAttendanceHistoryClassNames(db, manualResults),
  ]);

  // Map to unified structure
  const unified: AttendanceHistoryRecord[] = normalizedQrResults.map((r) => ({
    ...r,
    className: r.className,
    status: r.status as "PRESENT" | "LATE" | "EXCUSED" | "ABSENT",
    notes: null,
    source: "qr",
  }));

  const qrKeys = new Set(
    normalizedQrResults.map((r) => `${r.studentId}_${r.date}`),
  );

  for (const m of normalizedManualResults) {
    if (!qrKeys.has(`${m.studentId}_${m.date}`)) {
      unified.push({
        id: m.id,
        studentId: m.studentId,
        date: m.date,
        snapshotStudentName: m.fullName,
        snapshotStudentNis: m.nis,
        className: m.className,
        checkInTime: null,
        checkOutTime: null,
        status:
          m.status === "permission"
            ? "EXCUSED"
            : m.status === "alpha"
              ? "ABSENT"
              : m.status === "sick"
                ? "EXCUSED"
                : "PRESENT",
        lateDuration: 0,
        syncStatus: "synced",
        version: 1,
        hlc: null,
        createdAt: m.createdAt,
        updatedAt: m.createdAt,
        deletedAt: null,
        source: "manual",
        notes: m.notes,
      });
    }
  }

  const filtered =
    className && className !== "all"
      ? unified.filter(
          (row) => (row.className?.trim() || "UNASSIGNED") === className,
        )
      : unified;

  if (sortBy === "latest") {
    return filtered.sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }
  return filtered.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );
}

/**
 * Get attendance count for pagination
 */
export async function getAttendanceHistoryCount(
  filter: Omit<AttendanceHistoryFilter, "limit">,
): Promise<number> {
  const parsed = attendanceHistoryFilterSchema.safeParse({
    ...filter,
    limit: 100, // dummy value for validation
  });

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message || "Invalid filter parameters",
    );
  }

  const db = await getDb();
  const {
    startDate,
    endDate,
    status,
    studentId,
    searchQuery,
    source = "all",
  } = parsed.data;
  const normalizedStatus = resolveAttendanceHistoryStatus(status);

  // Build conditions for QR records
  const qrConditions = [isNull(studentDailyAttendance.deletedAt)];
  if (startDate) qrConditions.push(gte(studentDailyAttendance.date, startDate));
  if (endDate) qrConditions.push(lte(studentDailyAttendance.date, endDate));
  if (studentId)
    qrConditions.push(eq(studentDailyAttendance.studentId, studentId));
  if (searchQuery) {
    const q = `%${searchQuery}%`;
    qrConditions.push(
      or(
        like(studentDailyAttendance.snapshotStudentName, q),
        like(studentDailyAttendance.snapshotStudentNis, q),
      ) as SQL,
    );
  }
  if (normalizedStatus?.qrStatuses.length === 1) {
    qrConditions.push(
      eq(studentDailyAttendance.status, normalizedStatus.qrStatuses[0]),
    );
  } else if (normalizedStatus && normalizedStatus.qrStatuses.length > 1) {
    qrConditions.push(
      inArray(studentDailyAttendance.status, normalizedStatus.qrStatuses),
    );
  }

  const qrCountResult =
    source === "manual"
      ? [{ count: 0 }]
      : await db
          .select({ count: count() })
          .from(studentDailyAttendance)
          .where(and(...qrConditions));

  // Build conditions for Manual records count
  const manualConditions = [isNull(attendance.deletedAt)];
  if (startDate) manualConditions.push(gte(attendance.date, startDate));
  if (endDate) manualConditions.push(lte(attendance.date, endDate));
  if (studentId) manualConditions.push(eq(attendance.studentId, studentId));
  if (searchQuery) {
    const q = `%${searchQuery}%`;
    manualConditions.push(
      or(like(students.fullName, q), like(students.nis, q)) as SQL,
    );
  }
  if (normalizedStatus?.manualStatuses.length === 1) {
    manualConditions.push(
      eq(attendance.status, normalizedStatus.manualStatuses[0]),
    );
  } else if (normalizedStatus && normalizedStatus.manualStatuses.length > 1) {
    manualConditions.push(
      inArray(attendance.status, normalizedStatus.manualStatuses),
    );
  }

  const manualCountResult =
    source === "qr"
      ? [{ count: 0 }]
      : await db
          .select({ count: count() })
          .from(attendance)
          .innerJoin(students, eq(attendance.studentId, students.id))
          .where(and(...manualConditions));

  return (
    Number(qrCountResult[0]?.count || 0) +
    Number(manualCountResult[0]?.count || 0)
  );
}

export async function getAttendanceHistoryExportRows(
  filter: AttendanceHistoryFilter,
): Promise<AttendanceHistoryRecord[]> {
  const parsed = attendanceHistoryFilterSchema.safeParse({
    ...filter,
    limit: ATTENDANCE_HISTORY_EXPORT_BATCH,
  });

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message || "Invalid export filter parameters",
    );
  }

  const baseFilter: AttendanceHistoryFilter = {
    ...filter,
    limit: ATTENDANCE_HISTORY_EXPORT_BATCH,
  };

  const total = await getAttendanceHistoryCount(baseFilter);
  if (total === 0) {
    return [];
  }

  const pages = Math.ceil(total / ATTENDANCE_HISTORY_EXPORT_BATCH);
  const chunks = await Promise.all(
    Array.from({ length: pages }, (_, index) =>
      getAttendanceHistory({
        ...baseFilter,
        limit: ATTENDANCE_HISTORY_EXPORT_BATCH,
        offset: index * ATTENDANCE_HISTORY_EXPORT_BATCH,
      }),
    ),
  );

  return chunks.flat();
}

export async function getAttendanceHistorySummary(
  filter: AttendanceHistoryFilter,
): Promise<AttendanceHistorySummary> {
  return buildAttendanceHistorySummary(
    await getAttendanceHistoryExportRows(filter),
  );
}

function buildAttendanceHistorySummary(
  rows: AttendanceHistoryRecord[],
): AttendanceHistorySummary {
  return rows.reduce<AttendanceHistorySummary>(
    (summary, row) => {
      summary.total += 1;

      if (row.status === "PRESENT") summary.present += 1;
      if (row.status === "LATE") summary.late += 1;
      if (row.status === "EXCUSED") summary.excused += 1;
      if (row.status === "ABSENT") summary.absent += 1;

      if (row.source === "qr") summary.qr += 1;
      if (row.source === "manual") summary.manual += 1;

      return summary;
    },
    {
      total: 0,
      present: 0,
      late: 0,
      excused: 0,
      absent: 0,
      qr: 0,
      manual: 0,
    },
  );
}

export async function getAttendanceHistoryClassSummary(
  filter: AttendanceHistoryFilter,
): Promise<AttendanceHistoryClassSummary[]> {
  return buildAttendanceHistoryClassSummary(
    await getAttendanceHistoryExportRows(filter),
  );
}

function buildAttendanceHistoryClassSummary(
  rows: AttendanceHistoryRecord[],
): AttendanceHistoryClassSummary[] {
  const grouped = new Map<string, AttendanceHistoryClassSummary>();

  for (const row of rows) {
    const className = row.className?.trim() || "UNASSIGNED";
    const current = grouped.get(className) ?? {
      className,
      total: 0,
      present: 0,
      late: 0,
      excused: 0,
      absent: 0,
      qr: 0,
      manual: 0,
      attendanceRate: 0,
    };

    current.total += 1;
    if (row.status === "PRESENT") current.present += 1;
    if (row.status === "LATE") current.late += 1;
    if (row.status === "EXCUSED") current.excused += 1;
    if (row.status === "ABSENT") current.absent += 1;
    if (row.source === "qr") current.qr += 1;
    if (row.source === "manual") current.manual += 1;

    grouped.set(className, current);
  }

  return [...grouped.values()]
    .map((item) => ({
      ...item,
      attendanceRate:
        item.total === 0
          ? 0
          : Number(
              (((item.present + item.late) / item.total) * 100).toFixed(1),
            ),
    }))
    .sort(
      (a, b) =>
        b.total - a.total ||
        b.attendanceRate - a.attendanceRate ||
        a.className.localeCompare(b.className),
    );
}

export async function getAttendanceHistoryStudentSummary(
  filter: AttendanceHistoryFilter,
): Promise<AttendanceHistoryStudentSummary[]> {
  return buildAttendanceHistoryStudentSummary(
    await getAttendanceHistoryExportRows(filter),
  );
}

function buildAttendanceHistoryStudentSummary(
  rows: AttendanceHistoryRecord[],
): AttendanceHistoryStudentSummary[] {
  const grouped = new Map<string, AttendanceHistoryStudentSummary>();

  for (const row of rows) {
    const studentId = row.studentId;
    const current = grouped.get(studentId) ?? {
      studentId,
      studentName: row.snapshotStudentName?.trim() || "Siswa",
      nis: row.snapshotStudentNis?.trim() || "-",
      className: row.className?.trim() || "UNASSIGNED",
      total: 0,
      present: 0,
      late: 0,
      excused: 0,
      absent: 0,
      qr: 0,
      manual: 0,
      attendanceRate: 0,
    };

    current.total += 1;
    if (row.status === "PRESENT") current.present += 1;
    if (row.status === "LATE") current.late += 1;
    if (row.status === "EXCUSED") current.excused += 1;
    if (row.status === "ABSENT") current.absent += 1;
    if (row.source === "qr") current.qr += 1;
    if (row.source === "manual") current.manual += 1;

    grouped.set(studentId, current);
  }

  return [...grouped.values()]
    .map((item) => ({
      ...item,
      attendanceRate:
        item.total === 0
          ? 0
          : Number(
              (((item.present + item.late) / item.total) * 100).toFixed(1),
            ),
    }))
    .sort(
      (a, b) =>
        b.total - a.total ||
        b.attendanceRate - a.attendanceRate ||
        a.studentName.localeCompare(b.studentName),
    );
}

export async function getAttendanceHistoryTrend(
  filter: AttendanceHistoryFilter,
): Promise<AttendanceHistoryTrendPoint[]> {
  return buildAttendanceHistoryTrend(
    await getAttendanceHistoryExportRows(filter),
    filter,
  );
}

function buildAttendanceHistoryTrend(
  rows: AttendanceHistoryRecord[],
  filter: AttendanceHistoryFilter,
): AttendanceHistoryTrendPoint[] {
  const startDate = filter.startDate ?? "";
  const endDate = filter.endDate ?? "";
  const hasWideRange =
    Boolean(startDate) &&
    Boolean(endDate) &&
    startDate.slice(0, 7) !== endDate.slice(0, 7);
  const grouped = new Map<string, AttendanceHistoryTrendPoint>();

  for (const row of rows) {
    const period = hasWideRange ? row.date.slice(0, 7) : row.date;
    const label = hasWideRange ? period : row.date;
    const current = grouped.get(period) ?? {
      label,
      period,
      total: 0,
      present: 0,
      late: 0,
      excused: 0,
      absent: 0,
      attendanceRate: 0,
    };

    current.total += 1;
    if (row.status === "PRESENT") current.present += 1;
    if (row.status === "LATE") current.late += 1;
    if (row.status === "EXCUSED") current.excused += 1;
    if (row.status === "ABSENT") current.absent += 1;

    grouped.set(period, current);
  }

  return [...grouped.values()]
    .map((item) => ({
      ...item,
      attendanceRate:
        item.total === 0
          ? 0
          : Number(
              (((item.present + item.late) / item.total) * 100).toFixed(1),
            ),
    }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

export async function getAttendanceHistoryHeatmap(
  filter: AttendanceHistoryFilter,
): Promise<AttendanceHistoryHeatmapPoint[]> {
  return buildAttendanceHistoryHeatmap(
    await getAttendanceHistoryExportRows(filter),
  );
}

function buildAttendanceHistoryHeatmap(
  rows: AttendanceHistoryRecord[],
): AttendanceHistoryHeatmapPoint[] {
  const grouped = new Map<string, AttendanceHistoryHeatmapPoint>();

  for (const row of rows) {
    const current = grouped.get(row.date) ?? {
      date: row.date,
      dayLabel: row.date.slice(8, 10),
      total: 0,
      present: 0,
      late: 0,
      excused: 0,
      absent: 0,
      attendanceRate: 0,
    };

    current.total += 1;
    if (row.status === "PRESENT") current.present += 1;
    if (row.status === "LATE") current.late += 1;
    if (row.status === "EXCUSED") current.excused += 1;
    if (row.status === "ABSENT") current.absent += 1;

    grouped.set(row.date, current);
  }

  return [...grouped.values()]
    .map((item) => ({
      ...item,
      attendanceRate:
        item.total === 0
          ? 0
          : Number(
              (((item.present + item.late) / item.total) * 100).toFixed(1),
            ),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getAttendanceHistoryAnalyticsBundle(
  filter: AttendanceHistoryFilter,
): Promise<AttendanceHistoryAnalyticsBundle> {
  const rows = await getAttendanceHistoryExportRows(filter);
  return {
    summary: buildAttendanceHistorySummary(rows),
    classSummary: buildAttendanceHistoryClassSummary(rows),
    studentSummary: buildAttendanceHistoryStudentSummary(rows),
    trend: buildAttendanceHistoryTrend(rows, filter),
    heatmap: buildAttendanceHistoryHeatmap(rows),
  };
}

export async function getAttendanceRiskSettings(): Promise<AttendanceRiskSettings> {
  const db = await getDb();
  const existing = await db
    .select({
      toleranceMinutes: absensiConfig.toleranceMinutes,
      jamMasukNormal: absensiConfig.jamMasukNormal,
      jamPulangNormal: absensiConfig.jamPulangNormal,
    })
    .from(absensiConfig)
    .where(
      and(
        eq(absensiConfig.key, ATTENDANCE_RISK_SETTINGS_KEY),
        isNull(absensiConfig.deletedAt),
      ),
    )
    .limit(1);

  if (!existing[0]) {
    return DEFAULT_ATTENDANCE_RISK_SETTINGS;
  }

  return {
    alphaThreshold: Math.max(
      0,
      Number(existing[0].toleranceMinutes) ||
        DEFAULT_ATTENDANCE_RISK_SETTINGS.alphaThreshold,
    ),
    lateThreshold: Math.max(
      0,
      Number(existing[0].jamMasukNormal) ||
        DEFAULT_ATTENDANCE_RISK_SETTINGS.lateThreshold,
    ),
    rateThreshold: Math.max(
      0,
      Number(existing[0].jamPulangNormal) ||
        DEFAULT_ATTENDANCE_RISK_SETTINGS.rateThreshold,
    ),
  };
}

export async function upsertAttendanceRiskSettings(
  settings: AttendanceRiskSettings,
): Promise<AttendanceRiskSettings> {
  const db = await getDb();
  const now = new Date();
  const normalized: AttendanceRiskSettings = {
    alphaThreshold: Math.max(0, settings.alphaThreshold),
    lateThreshold: Math.max(0, settings.lateThreshold),
    rateThreshold: Math.max(0, settings.rateThreshold),
  };

  const existing = await db
    .select({ id: absensiConfig.id })
    .from(absensiConfig)
    .where(
      and(
        eq(absensiConfig.key, ATTENDANCE_RISK_SETTINGS_KEY),
        isNull(absensiConfig.deletedAt),
      ),
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(absensiConfig)
      .set({
        toleranceMinutes: normalized.alphaThreshold,
        jamMasukNormal: String(normalized.lateThreshold),
        jamPulangNormal: String(normalized.rateThreshold),
        activeDays: "attendance_risk_thresholds",
        updatedAt: now,
        syncStatus: "pending",
      })
      .where(eq(absensiConfig.id, existing[0].id));
    return normalized;
  }

  await db.insert(absensiConfig).values({
    id: crypto.randomUUID(),
    key: ATTENDANCE_RISK_SETTINGS_KEY,
    toleranceMinutes: normalized.alphaThreshold,
    jamMasukNormal: String(normalized.lateThreshold),
    jamPulangNormal: String(normalized.rateThreshold),
    activeDays: "attendance_risk_thresholds",
    createdAt: now,
    updatedAt: now,
    syncStatus: "pending",
  });

  return normalized;
}

export async function getAttendanceRiskStudents(
  filter: AttendanceHistoryFilter,
  settings?: AttendanceRiskSettings,
): Promise<AttendanceRiskStudent[]> {
  const [resolvedSettings, studentSummary] = await Promise.all([
    settings ? Promise.resolve(settings) : getAttendanceRiskSettings(),
    getAttendanceHistoryStudentSummary(filter),
  ]);

  return studentSummary
    .map((student) => {
      const riskFlags: string[] = [];
      if (student.absent >= resolvedSettings.alphaThreshold) {
        riskFlags.push(`Alpha >= ${resolvedSettings.alphaThreshold}`);
      }
      if (student.late >= resolvedSettings.lateThreshold) {
        riskFlags.push(`Terlambat >= ${resolvedSettings.lateThreshold}`);
      }
      if (student.attendanceRate < resolvedSettings.rateThreshold) {
        riskFlags.push(`Rate < ${resolvedSettings.rateThreshold}%`);
      }

      return { ...student, riskFlags };
    })
    .filter((student) => student.riskFlags.length > 0)
    .sort(
      (a, b) =>
        a.attendanceRate - b.attendanceRate ||
        b.absent - a.absent ||
        b.late - a.late ||
        a.studentName.localeCompare(b.studentName),
    );
}

function buildAttendanceRiskFollowUpMessage(input: {
  studentName: string;
  nis: string;
  className: string;
  riskFlags: string[];
  note?: string;
  deadline?: string | null;
}) {
  const parts = [
    `${input.studentName} (${input.nis}) kelas ${input.className} membutuhkan tindak lanjut.`,
    `Indikator: ${input.riskFlags.join(", ")}`,
  ];

  if (input.deadline) {
    parts.push(`Deadline: ${input.deadline}`);
  }

  if (input.note?.trim()) {
    parts.push(`Catatan: ${input.note.trim()}`);
  }

  return parts.join(". ");
}

async function createAttendanceRiskAuditLog(input: {
  actorUserId: string;
  followUpId: string;
  studentId: string;
  studentName: string;
  assigneeUserId: string;
  action: "created" | "updated" | "completed";
  note?: string | null;
  deadline?: string | null;
  extraMessage?: string | null;
}) {
  const db = await getDb();
  const now = new Date();
  const actionLabel =
    input.action === "created"
      ? "Follow-up dibuat"
      : input.action === "completed"
        ? "Follow-up diselesaikan"
        : "Follow-up diperbarui";
  const detailParts = [actionLabel];

  if (input.deadline) {
    detailParts.push(`deadline ${input.deadline}`);
  }

  if (input.note?.trim()) {
    detailParts.push(`catatan ${input.note.trim()}`);
  }

  if (input.extraMessage?.trim()) {
    detailParts.push(input.extraMessage.trim());
  }

  await db.insert(notifikasi).values({
    id: crypto.randomUUID(),
    userId: input.assigneeUserId,
    judul: `Audit Follow-up: ${input.studentName}`,
    pesan: detailParts.join(" • "),
    tipe: "attendance-risk-log",
    link: `/dashboard/attendance?tab=history&studentId=${input.studentId}&followUpId=${input.followUpId}`,
    isRead: true,
    createdAt: now,
    updatedAt: now,
    syncStatus: "pending",
  });
}

function parseAttendanceRiskFollowUpMessage(message: string) {
  const result = {
    riskFlags: [] as string[],
    note: null as string | null,
    deadline: null as string | null,
  };

  const indicatorMatch = message.match(
    /Indikator:\s*(.+?)(?=\. Deadline:|\. Catatan:|$)/,
  );
  if (indicatorMatch?.[1]) {
    result.riskFlags = indicatorMatch[1]
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  const deadlineMatch = message.match(/Deadline:\s*(\d{4}-\d{2}-\d{2})/);
  if (deadlineMatch?.[1]) {
    result.deadline = deadlineMatch[1];
  }

  const noteMatch = message.match(/Catatan:\s*(.+)$/);
  if (noteMatch?.[1]) {
    result.note = noteMatch[1].trim();
  }

  return result;
}

function extractAttendanceRiskClassName(
  link: string | null,
  message: string,
): string | null {
  if (link) {
    try {
      const url = new URL(link, "https://educore.local");
      const className = url.searchParams.get("className");
      if (className?.trim()) {
        return className.trim();
      }
    } catch {
      // Ignore invalid relative URL parsing and fallback to message parsing.
    }
  }

  const messageMatch = message.match(
    /\)\s+kelas\s+(.+?)\s+membutuhkan tindak lanjut\./,
  );
  return messageMatch?.[1]?.trim() || null;
}

export async function createAttendanceRiskFollowUp(input: {
  actorUserId: string;
  studentId: string;
  studentName: string;
  nis: string;
  className: string;
  riskFlags: string[];
  note?: string;
  deadline?: string | null;
}): Promise<void> {
  const db = await getDb();
  const now = new Date();
  const normalizedNote = input.note?.trim().slice(0, 300) || "";
  const normalizedDeadline = input.deadline?.trim() || null;
  const classRow = await db
    .select({
      homeroomTeacherId: classes.homeroomTeacherId,
    })
    .from(classes)
    .where(
      and(
        eq(classes.name, input.className),
        eq(classes.isActive, true),
        isNull(classes.deletedAt),
      ),
    )
    .limit(1);
  const assigneeUserId =
    classRow[0]?.homeroomTeacherId?.trim() || input.actorUserId;

  const followUpId = crypto.randomUUID();

  await db.insert(notifikasi).values({
    id: followUpId,
    userId: assigneeUserId,
    judul: `Follow-up Attendance: ${input.studentName}`,
    pesan: buildAttendanceRiskFollowUpMessage({
      studentName: input.studentName,
      nis: input.nis,
      className: input.className,
      riskFlags: input.riskFlags,
      note: normalizedNote,
      deadline: normalizedDeadline,
    }),
    tipe: "attendance-risk",
    link: `/dashboard/attendance?tab=history&studentId=${input.studentId}&className=${encodeURIComponent(input.className)}${normalizedDeadline ? `&followUpDeadline=${encodeURIComponent(normalizedDeadline)}` : ""}`,
    isRead: false,
    createdAt: now,
    updatedAt: now,
    syncStatus: "pending",
  });

  await createAttendanceRiskAuditLog({
    actorUserId: input.actorUserId,
    followUpId,
    studentId: input.studentId,
    studentName: input.studentName,
    assigneeUserId,
    action: "created",
    note: normalizedNote,
    deadline: normalizedDeadline,
  });
}

export async function getAttendanceRiskNotifications(assigneeUserId: string) {
  const db = await getDb();
  const rows = await db
    .select({
      id: notifikasi.id,
      judul: notifikasi.judul,
      pesan: notifikasi.pesan,
      link: notifikasi.link,
      isRead: notifikasi.isRead,
      createdAt: notifikasi.createdAt,
    })
    .from(notifikasi)
    .where(
      and(
        eq(notifikasi.userId, assigneeUserId),
        eq(notifikasi.tipe, "attendance-risk"),
        isNull(notifikasi.deletedAt),
      ),
    )
    .orderBy(desc(notifikasi.createdAt))
    .limit(50);

  return rows.map((row) => {
    const parsed = parseAttendanceRiskFollowUpMessage(row.pesan);
    return {
      ...row,
      className: extractAttendanceRiskClassName(row.link, row.pesan),
      note: parsed.note,
      deadline: parsed.deadline,
      riskFlags: parsed.riskFlags,
    };
  });
}

export async function getAttendanceRiskNotificationSummary(
  assigneeUserId: string,
) {
  const db = await getDb();
  const rows = await db
    .select({
      isRead: notifikasi.isRead,
      total: count(),
    })
    .from(notifikasi)
    .where(
      and(
        eq(notifikasi.userId, assigneeUserId),
        eq(notifikasi.tipe, "attendance-risk"),
        isNull(notifikasi.deletedAt),
      ),
    )
    .groupBy(notifikasi.isRead);

  const done = Number(rows.find((row) => row.isRead)?.total || 0);
  const pending = Number(rows.find((row) => !row.isRead)?.total || 0);

  return {
    done,
    pending,
    total: done + pending,
  };
}

export async function markAttendanceRiskNotificationRead(
  notificationId: string,
  userId: string,
  options?: { allowAnyAssignee?: boolean },
) {
  const db = await getDb();
  const now = new Date();
  const ownerCondition = options?.allowAnyAssignee
    ? eq(notifikasi.id, notificationId)
    : and(eq(notifikasi.id, notificationId), eq(notifikasi.userId, userId));
  const existing = await db
    .select({
      id: notifikasi.id,
      judul: notifikasi.judul,
      pesan: notifikasi.pesan,
      link: notifikasi.link,
      userId: notifikasi.userId,
      isRead: notifikasi.isRead,
    })
    .from(notifikasi)
    .where(
      and(
        ownerCondition,
        eq(notifikasi.tipe, "attendance-risk"),
        isNull(notifikasi.deletedAt),
      ),
    )
    .limit(1);

  await db
    .update(notifikasi)
    .set({
      isRead: true,
      updatedAt: now,
      syncStatus: "pending",
    })
    .where(
      and(
        ownerCondition,
        eq(notifikasi.tipe, "attendance-risk"),
        isNull(notifikasi.deletedAt),
      ),
    );

  const current = existing[0];
  if (current && !current.isRead) {
    const studentId =
      new URL(
        current.link || "/dashboard/attendance",
        "https://educore.local",
      ).searchParams.get("studentId") || "";
    const studentMatch = current.pesan.match(
      /^(.+?) \((.+?)\) kelas (.+?) membutuhkan tindak lanjut\./,
    );

    await createAttendanceRiskAuditLog({
      actorUserId: userId,
      followUpId: current.id,
      studentId,
      studentName: studentMatch?.[1]?.trim() || current.judul,
      assigneeUserId: current.userId,
      action: "completed",
    });
  }
}

export async function updateAttendanceRiskFollowUp(
  notificationId: string,
  userId: string,
  input: {
    note?: string | null;
    deadline?: string | null;
    isRead?: boolean;
    assigneeUserId?: string | null;
  },
  options?: { allowAnyAssignee?: boolean },
) {
  const db = await getDb();
  const ownerCondition = options?.allowAnyAssignee
    ? eq(notifikasi.id, notificationId)
    : and(eq(notifikasi.id, notificationId), eq(notifikasi.userId, userId));
  const existing = await db
    .select({
      id: notifikasi.id,
      judul: notifikasi.judul,
      pesan: notifikasi.pesan,
      link: notifikasi.link,
      userId: notifikasi.userId,
      isRead: notifikasi.isRead,
    })
    .from(notifikasi)
    .where(
      and(
        ownerCondition,
        eq(notifikasi.tipe, "attendance-risk"),
        isNull(notifikasi.deletedAt),
      ),
    )
    .limit(1);

  if (!existing[0]) {
    throw new Error("Follow-up tidak ditemukan");
  }

  const current = existing[0];
  const parsedMessage = parseAttendanceRiskFollowUpMessage(current.pesan);
  const className = extractAttendanceRiskClassName(current.link, current.pesan);
  const studentMatch = current.pesan.match(
    /^(.+?) \((.+?)\) kelas (.+?) membutuhkan tindak lanjut\./,
  );
  const studentName = studentMatch?.[1]?.trim();
  const nis = studentMatch?.[2]?.trim();

  if (!studentName || !nis || !className) {
    throw new Error("Format follow-up tidak valid untuk diperbarui");
  }

  const baseUrl = new URL(
    current.link || `/dashboard/attendance?tab=history`,
    "https://educore.local",
  );
  const normalizedNote =
    input.note === undefined ? parsedMessage.note : input.note?.trim() || null;
  const normalizedDeadline =
    input.deadline === undefined
      ? parsedMessage.deadline
      : input.deadline?.trim() || null;
  const normalizedAssigneeUserId =
    input.assigneeUserId === undefined
      ? currentUserIdFromNotification(current)
      : input.assigneeUserId?.trim() || currentUserIdFromNotification(current);
  let assigneeChangeMessage: string | null = null;

  if (
    normalizedAssigneeUserId &&
    normalizedAssigneeUserId !== currentUserIdFromNotification(current)
  ) {
    const assigneeRows = await db
      .select({
        id: users.id,
        fullName: users.fullName,
      })
      .from(users)
      .where(
        and(
          inArray(users.id, [
            currentUserIdFromNotification(current),
            normalizedAssigneeUserId,
          ]),
          isNull(users.deletedAt),
        ),
      );
    const previousAssignee =
      assigneeRows.find(
        (row) => row.id === currentUserIdFromNotification(current),
      )?.fullName || "Assignee lama";
    const nextAssignee =
      assigneeRows.find((row) => row.id === normalizedAssigneeUserId)
        ?.fullName || "Assignee baru";
    assigneeChangeMessage = `reassign ${previousAssignee} -> ${nextAssignee}`;
  }

  baseUrl.searchParams.set("className", className);
  if (normalizedDeadline) {
    baseUrl.searchParams.set("followUpDeadline", normalizedDeadline);
  } else {
    baseUrl.searchParams.delete("followUpDeadline");
  }

  await db
    .update(notifikasi)
    .set({
      userId: normalizedAssigneeUserId,
      pesan: buildAttendanceRiskFollowUpMessage({
        studentName,
        nis,
        className,
        riskFlags: parsedMessage.riskFlags,
        note: normalizedNote || undefined,
        deadline: normalizedDeadline,
      }),
      link: `${baseUrl.pathname}${baseUrl.search}`,
      isRead: input.isRead ?? current.isRead,
      updatedAt: new Date(),
      syncStatus: "pending",
    })
    .where(eq(notifikasi.id, current.id));

  const studentId = baseUrl.searchParams.get("studentId") || "";
  await createAttendanceRiskAuditLog({
    actorUserId: userId,
    followUpId: current.id,
    studentId,
    studentName,
    assigneeUserId: normalizedAssigneeUserId,
    action: input.isRead ? "completed" : "updated",
    note: normalizedNote,
    deadline: normalizedDeadline,
    extraMessage: assigneeChangeMessage,
  });
}

export async function getAttendanceRiskFollowUpAuditTrail(
  followUpId: string,
  userId: string,
  options?: { allowAnyAssignee?: boolean },
) {
  const db = await getDb();
  return db
    .select({
      id: notifikasi.id,
      judul: notifikasi.judul,
      pesan: notifikasi.pesan,
      createdAt: notifikasi.createdAt,
      link: notifikasi.link,
    })
    .from(notifikasi)
    .where(
      and(
        options?.allowAnyAssignee ? sql`1 = 1` : eq(notifikasi.userId, userId),
        eq(notifikasi.tipe, "attendance-risk-log"),
        like(notifikasi.link, `%followUpId=${followUpId}%`),
        isNull(notifikasi.deletedAt),
      ),
    )
    .orderBy(desc(notifikasi.createdAt))
    .limit(20);
}

function currentUserIdFromNotification(notification: { userId?: string }) {
  return notification.userId?.trim() || "";
}

export async function getAttendanceRiskAssignmentSummary() {
  const db = await getDb();
  const notifications = await db
    .select({
      userId: notifikasi.userId,
      assigneeName: users.fullName,
      isRead: notifikasi.isRead,
      pesan: notifikasi.pesan,
    })
    .from(notifikasi)
    .innerJoin(users, eq(notifikasi.userId, users.id))
    .where(
      and(
        eq(notifikasi.tipe, "attendance-risk"),
        isNull(notifikasi.deletedAt),
        isNull(users.deletedAt),
      ),
    );

  const today = new Date().toISOString().slice(0, 10);
  const grouped = new Map<
    string,
    {
      userId: string;
      assigneeName: string;
      total: number;
      pending: number;
      done: number;
      overdue: number;
    }
  >();

  for (const item of notifications) {
    const current = grouped.get(item.userId) ?? {
      userId: item.userId,
      assigneeName: item.assigneeName,
      total: 0,
      pending: 0,
      done: 0,
      overdue: 0,
    };
    const parsed = parseAttendanceRiskFollowUpMessage(item.pesan);

    current.total += 1;
    if (item.isRead) {
      current.done += 1;
    } else {
      current.pending += 1;
      if (parsed.deadline && parsed.deadline < today) {
        current.overdue += 1;
      }
    }
    grouped.set(item.userId, current);
  }

  return [...grouped.values()].sort(
    (a, b) =>
      b.pending - a.pending ||
      b.overdue - a.overdue ||
      a.assigneeName.localeCompare(b.assigneeName),
  );
}

export async function getAttendanceRiskFollowUpHistory(
  studentId: string,
  options: {
    assigneeUserId: string;
    allowAnyAssignee?: boolean;
  },
) {
  const db = await getDb();
  const normalizedStudentId = studentId.trim();
  const encodedStudentId = encodeURIComponent(normalizedStudentId);
  const ownerCondition = options.allowAnyAssignee
    ? sql`1 = 1`
    : eq(notifikasi.userId, options.assigneeUserId);

  return db
    .select({
      id: notifikasi.id,
      judul: notifikasi.judul,
      pesan: notifikasi.pesan,
      link: notifikasi.link,
      isRead: notifikasi.isRead,
      createdAt: notifikasi.createdAt,
    })
    .from(notifikasi)
    .where(
      and(
        ownerCondition,
        eq(notifikasi.tipe, "attendance-risk"),
        or(
          like(notifikasi.link, `%studentId=${normalizedStudentId}%`),
          like(notifikasi.link, `%studentId=${encodedStudentId}%`),
        ),
        isNull(notifikasi.deletedAt),
      ),
    )
    .orderBy(desc(notifikasi.createdAt))
    .limit(20);
}
