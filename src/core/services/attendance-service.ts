import { differenceInMinutes, format, isAfter, parse } from "date-fns";
import { and, desc, eq, inArray, isNull, ne, or } from "drizzle-orm";
import {
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

  if (byNis[0]) {
    return {
      id: byNis[0].id,
      fullName: byNis[0].fullName,
      nis: byNis[0].nis,
      grade: byNis[0].grade || "UNASSIGNED",
      photo: user.foto ?? undefined,
    };
  }

  const normalizedGender = user.jenisKelamin === "P" ? "P" : "L";
  let normalizedGrade = "UNASSIGNED";
  const classRef = user.kelasId?.trim();

  if (classRef) {
    const classRow = await db
      .select({ name: classes.name })
      .from(classes)
      .where(and(eq(classes.id, classRef), isNull(classes.deletedAt)))
      .limit(1);

    normalizedGrade = classRow[0]?.name || classRef;
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
    // Race condition on insert is acceptable here.
  }

  const synced = await db
    .select()
    .from(students)
    .where(and(eq(students.nis, userNis), isNull(students.deletedAt)))
    .limit(1);

  if (!synced[0]) {
    return null;
  }

  return {
    id: synced[0].id,
    fullName: synced[0].fullName,
    nis: synced[0].nis,
    grade: synced[0].grade || "UNASSIGNED",
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
    const cards = await db
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

    const card = cards[0];
    if (card) {
      const userList = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.id, card.studentId),
            isNull(users.deletedAt),
            eq(users.isActive, true),
          ),
        )
        .limit(1);

      if (userList[0]) {
        return ensureStudentMirrorFromUser(userList[0]);
      }

      const studentList = await db
        .select()
        .from(students)
        .where(and(eq(students.id, card.studentId), isNull(students.deletedAt)))
        .limit(1);

      if (studentList[0]) {
        return {
          id: studentList[0].id,
          fullName: studentList[0].fullName,
          nis: studentList[0].nis,
          grade: studentList[0].grade || "UNASSIGNED",
        };
      }
    }
  }

  const validNis = nisCandidates.filter((candidate) => candidate.length >= 3);
  if (validNis.length > 0) {
    const byNis = await db
      .select()
      .from(students)
      .where(and(inArray(students.nis, validNis), isNull(students.deletedAt)))
      .limit(1);

    if (byNis[0]) {
      return {
        id: byNis[0].id,
        fullName: byNis[0].fullName,
        nis: byNis[0].nis,
        grade: byNis[0].grade || "UNASSIGNED",
      };
    }
  }

  const userCandidates = toUniqueValues([...validNis, ...idCandidates]);
  if (userCandidates.length > 0) {
    const byUser = await db
      .select()
      .from(users)
      .where(
        and(
          or(
            inArray(users.nis, userCandidates),
            inArray(users.id, userCandidates),
          ),
          isNull(users.deletedAt),
          eq(users.isActive, true),
        ),
      )
      .limit(1);

    if (byUser[0]) {
      return ensureStudentMirrorFromUser(byUser[0]);
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
    const holiday = await db
      .select()
      .from(holidays)
      .where(and(eq(holidays.date, todayStr), isNull(holidays.deletedAt)))
      .limit(1);

    if (holiday[0]) {
      return {
        success: false,
        message: `Hari ini libur: ${holiday[0].name || "Tanpa Keterangan"}`,
        type: "ERROR",
      };
    }

    const student = await resolveStudentFromQr(normalizedQr);
    if (!student) {
      return {
        success: false,
        message:
          "Data siswa tidak ditemukan atau belum tersinkron. Pastikan NIS/token kartu sudah terdaftar.",
        type: "ERROR",
      };
    }

    let lateThreshold = parseTimeSetting("07:15");
    const settings = await db
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
      .limit(1);

    if (settings[0]) {
      lateThreshold = parseTimeSetting(settings[0].lateThreshold);
    } else if (dayOfWeek === 0) {
      return {
        success: false,
        message: "Hari Minggu tidak ada jadwal sekolah.",
        type: "ERROR",
      };
    }

    const records = await db
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

    const existing = records[0];

    if (existing) {
      if (existing.checkOutTime) {
        return {
          success: false,
          message: `${student.fullName} sudah melakukan Check-out hari ini.`,
          type: "ERROR",
          data: {
            fullName: student.fullName,
            nis: student.nis,
            grade: student.grade,
            time: currentTimeStr,
            status: existing.status === "LATE" ? "late" : "on-time",
            type: "out",
            lateMinutes: existing.lateDuration || 0,
          },
        };
      }

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
        message: `Goodbye ${student.fullName.split(" ")[0]}! Hati-hati di jalan.`,
        type: "CHECK_OUT",
        data: {
          fullName: student.fullName,
          nis: student.nis,
          grade: student.grade,
          time: currentTimeStr,
          status: existing.status === "LATE" ? "late" : "on-time",
          type: "out",
          lateMinutes: existing.lateDuration || 0,
        },
      };
    }

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
          : `Check-in Berhasil. Selamat pagi, ${student.fullName.split(" ")[0]}!`,
      type: "CHECK_IN",
      data: {
        fullName: student.fullName,
        nis: student.nis,
        grade: student.grade,
        time: currentTimeStr,
        status,
        type: "in",
        lateMinutes,
      },
    };
  } catch (error: unknown) {
    const errorObj = error as Record<string, unknown>;
    const errorMessage =
      typeof errorObj.message === "string" ? errorObj.message : "";

    if (errorMessage.includes("UNIQUE") || errorObj.code === 2067) {
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
