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

function parseTimeSetting(timeStr: string): Date {
  return parse(timeStr, "HH:mm", new Date());
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
        photo: users.foto,
      })
      .from(studentIdCards)
      .leftJoin(students, eq(studentIdCards.studentId, students.id))
      .leftJoin(users, eq(studentIdCards.studentId, users.id))
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
        grade: cardQuery[0].grade || "UNASSIGNED",
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
        photo: users.foto,
      })
      .from(students)
      .leftJoin(users, eq(students.id, users.id))
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
        grade: directQuery[0].grade || "UNASSIGNED",
        photo: directQuery[0].photo ?? undefined,
      };
    }
  }

  return null;
}

export async function processQRScan(qrData: string): Promise<ScanResult> {
  const db = await getDb();
  const normalizedQr = qrData.trim();

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
    .where(isNull(attendanceSettings.deletedAt));
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
  return db.select().from(holidays).where(isNull(holidays.deletedAt));
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

  const classRow = await db
    .select({ id: classes.id })
    .from(classes)
    .where(
      and(
        eq(classes.id, payload.classId),
        eq(classes.isActive, true),
        isNull(classes.deletedAt),
      ),
    )
    .limit(1);

  if (!classRow[0]) {
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
};

export type AttendanceHistoryRecord = {
  id: string;
  studentId: string;
  snapshotStudentName: string | null;
  snapshotStudentNis: string | null;
  date: string;
  checkInTime: Date | null;
  checkOutTime: Date | null;
  status: "PRESENT" | "LATE" | "EXCUSED" | "ABSENT";
  lateDuration: number | null;
  syncStatus: "synced" | "pending" | "error";
  version: number;
  hlc: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

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
  } = parsed.data;

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

  if (status && status !== "all") {
    qrConditions.push(
      eq(
        studentDailyAttendance.status,
        status.toUpperCase() as "PRESENT" | "LATE" | "EXCUSED" | "ABSENT",
      ),
    );
  }

  if (!startDate && !endDate) {
    const sevenDaysAgo = format(
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      "yyyy-MM-dd",
    );
    qrConditions.push(gte(studentDailyAttendance.date, sevenDaysAgo));
  }

  // Fetch QR records
  const qrResults = await db
    .select()
    .from(studentDailyAttendance)
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

  if (status && status !== "all") {
    manualConditions.push(eq(attendance.status, status.toLowerCase()));
  }

  if (!startDate && !endDate) {
    const sevenDaysAgo = format(
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      "yyyy-MM-dd",
    );
    manualConditions.push(gte(attendance.date, sevenDaysAgo));
  }

  // Fetch Manual records with student details
  const manualResults = await db
    .select({
      id: attendance.id,
      studentId: attendance.studentId,
      date: attendance.date,
      status: attendance.status,
      notes: attendance.notes,
      fullName: students.fullName,
      nis: students.nis,
      createdAt: attendance.createdAt,
    })
    .from(attendance)
    .innerJoin(students, eq(attendance.studentId, students.id))
    .where(and(...manualConditions));

  // Map to unified structure
  const unified: AttendanceHistoryRecord[] = qrResults.map((r) => ({
    ...r,
    status: r.status as "PRESENT" | "LATE" | "EXCUSED" | "ABSENT",
  }));

  const qrKeys = new Set(qrResults.map((r) => `${r.studentId}_${r.date}`));

  for (const m of manualResults) {
    if (!qrKeys.has(`${m.studentId}_${m.date}`)) {
      unified.push({
        id: m.id,
        studentId: m.studentId,
        date: m.date,
        snapshotStudentName: m.fullName,
        snapshotStudentNis: m.nis,
        checkInTime: null,
        checkOutTime: null,
        status: m.status.toUpperCase() as
          | "PRESENT"
          | "LATE"
          | "EXCUSED"
          | "ABSENT",
        lateDuration: 0,
        syncStatus: "synced",
        version: 1,
        hlc: null,
        createdAt: m.createdAt,
        updatedAt: m.createdAt,
        deletedAt: null,
      });
    }
  }

  if (sortBy === "latest") {
    return unified.sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }
  return unified.sort(
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
  const { startDate, endDate, status } = parsed.data;

  // Build conditions for QR records
  const qrConditions = [isNull(studentDailyAttendance.deletedAt)];
  if (startDate) qrConditions.push(gte(studentDailyAttendance.date, startDate));
  if (endDate) qrConditions.push(lte(studentDailyAttendance.date, endDate));
  if (status && status !== "all") {
    qrConditions.push(
      eq(
        studentDailyAttendance.status,
        status.toUpperCase() as "PRESENT" | "LATE" | "EXCUSED" | "ABSENT",
      ),
    );
  }

  // If no date filter, get last 7 days by default
  if (!startDate && !endDate) {
    const sevenDaysAgo = format(
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      "yyyy-MM-dd",
    );
    qrConditions.push(gte(studentDailyAttendance.date, sevenDaysAgo));
  }

  const qrCountResult = await db
    .select({ count: count() })
    .from(studentDailyAttendance)
    .where(and(...qrConditions));

  // Build conditions for Manual records count
  const manualConditions = [isNull(attendance.deletedAt)];
  if (startDate) manualConditions.push(gte(attendance.date, startDate));
  if (endDate) manualConditions.push(lte(attendance.date, endDate));
  if (status && status !== "all") {
    manualConditions.push(eq(attendance.status, status.toLowerCase()));
  }

  if (!startDate && !endDate) {
    const sevenDaysAgo = format(
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      "yyyy-MM-dd",
    );
    manualConditions.push(gte(attendance.date, sevenDaysAgo));
  }

  const manualCountResult = await db
    .select({ count: count() })
    .from(attendance)
    .where(and(...manualConditions));

  return (
    Number(qrCountResult[0]?.count || 0) +
    Number(manualCountResult[0]?.count || 0)
  );
}

/**
 * Get unique dates that have attendance records
 * Useful for date picker suggestions
 */
export async function getAttendanceHistoryDates(): Promise<string[]> {
  const db = await getDb();

  const qrResults = await db
    .selectDistinct({ date: studentDailyAttendance.date })
    .from(studentDailyAttendance)
    .where(isNull(studentDailyAttendance.deletedAt))
    .orderBy(desc(studentDailyAttendance.date));

  const manualResults = await db
    .selectDistinct({ date: attendance.date })
    .from(attendance)
    .where(isNull(attendance.deletedAt))
    .orderBy(desc(attendance.date));

  const allDates = new Set([
    ...qrResults.map((r) => r.date),
    ...manualResults.map((r) => r.date),
  ]);

  return Array.from(allDates)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 30);
}
