import { and, desc, eq, isNull, ne, or, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  attendance,
  classes,
  guruMapel,
  jadwal,
  nilai,
  pengumuman,
  raport,
  semester,
  subjects,
  tahunAjaran,
  users,
} from "../db/schema";
import {
  academicYearInsertSchema,
  classInsertSchema,
  jadwalInsertSchema,
  semesterInsertSchema,
  subjectInsertSchema,
  teacherSubjectInsertSchema,
} from "../validations/schemas";
import {
  findClassScheduleUsage,
  findSubjectScheduleUsage,
  hasAnyScheduleUsage,
} from "./schedule-usage";

type AcademicServiceResult =
  | { success: true; id?: string }
  | { success: false; error: string; code?: string };

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes("unique constraint failed")
  );
}

function normalizeClassPayload(data: {
  name: string;
  academicYear: string;
  homeroomTeacherId?: string | null;
}) {
  return {
    name: data.name.trim(),
    academicYear: data.academicYear.trim(),
    homeroomTeacherId: data.homeroomTeacherId?.trim() || undefined,
  };
}

function normalizeSubjectPayload(data: { name: string; code: string }) {
  return {
    name: data.name.trim(),
    code: data.code.trim().toUpperCase(),
  };
}

function normalizeAcademicYearPayload(data: {
  nama: string;
  tanggalMulai: string | Date;
  tanggalSelesai: string | Date;
  isActive?: boolean;
}) {
  return {
    nama: data.nama.trim(),
    tanggalMulai: data.tanggalMulai,
    tanggalSelesai: data.tanggalSelesai,
    isActive: Boolean(data.isActive),
  };
}

function normalizeSemesterPayload(data: {
  tahunAjaranId: string;
  nama: string;
  tanggalMulai: string | Date;
  tanggalSelesai: string | Date;
  isActive?: boolean;
}) {
  return {
    tahunAjaranId: data.tahunAjaranId.trim(),
    nama: data.nama.trim(),
    tanggalMulai: data.tanggalMulai,
    tanggalSelesai: data.tanggalSelesai,
    isActive: Boolean(data.isActive),
  };
}

function normalizeTeachingAssignmentPayload(data: {
  guruId: string;
  mataPelajaranId: string;
  kelasId: string;
  semesterId: string;
}) {
  return {
    guruId: data.guruId.trim(),
    mataPelajaranId: data.mataPelajaranId.trim(),
    kelasId: data.kelasId.trim(),
    semesterId: data.semesterId.trim(),
  };
}

function normalizeJadwalPayload(data: {
  guruMapelId: string;
  hari: number;
  jamMulai: string;
  jamSelesai: string;
  ruangan?: string | null;
}) {
  return {
    guruMapelId: data.guruMapelId.trim(),
    hari: data.hari,
    jamMulai: data.jamMulai.trim(),
    jamSelesai: data.jamSelesai.trim(),
    ruangan: data.ruangan?.trim() || null,
  };
}

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  return hours * 60 + minutes;
}

function isTimeRangeOverlapping(
  leftStart: string,
  leftEnd: string,
  rightStart: string,
  rightEnd: string,
) {
  return (
    Math.max(toMinutes(leftStart), toMinutes(rightStart)) <
    Math.min(toMinutes(leftEnd), toMinutes(rightEnd))
  );
}

async function findActiveClassByIdentity(
  name: string,
  academicYear: string,
  excludeId?: string,
) {
  const db = await getDb();
  const conditions = [
    eq(classes.name, name),
    eq(classes.academicYear, academicYear),
    isNull(classes.deletedAt),
  ];

  if (excludeId) {
    conditions.push(ne(classes.id, excludeId));
  }

  return db
    .select({ id: classes.id })
    .from(classes)
    .where(and(...conditions))
    .limit(1);
}

async function ensureHomeroomTeacherExists(
  teacherId: string | undefined,
): Promise<AcademicServiceResult | null> {
  if (!teacherId) {
    return null;
  }

  const db = await getDb();
  const teacher = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.id, teacherId),
        eq(users.role, "teacher"),
        eq(users.isActive, true),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  if (teacher.length === 0) {
    return {
      success: false,
      error: "Wali kelas harus memilih guru aktif yang valid.",
      code: "INVALID_HOMEROOM_TEACHER",
    };
  }

  return null;
}

async function ensureAcademicYearExists(
  id: string,
): Promise<AcademicServiceResult | null> {
  const db = await getDb();
  const rows = await db
    .select({ id: tahunAjaran.id })
    .from(tahunAjaran)
    .where(and(eq(tahunAjaran.id, id), isNull(tahunAjaran.deletedAt)))
    .limit(1);

  if (rows.length === 0) {
    return {
      success: false,
      error: "Tahun ajaran tidak ditemukan.",
      code: "ACADEMIC_YEAR_NOT_FOUND",
    };
  }

  return null;
}

async function ensureSemesterExists(
  id: string,
): Promise<AcademicServiceResult | null> {
  const db = await getDb();
  const rows = await db
    .select({ id: semester.id })
    .from(semester)
    .where(and(eq(semester.id, id), isNull(semester.deletedAt)))
    .limit(1);

  if (rows.length === 0) {
    return {
      success: false,
      error: "Semester tidak ditemukan.",
      code: "SEMESTER_NOT_FOUND",
    };
  }

  return null;
}

async function ensureSubjectExists(
  id: string,
): Promise<AcademicServiceResult | null> {
  const db = await getDb();
  const rows = await db
    .select({ id: subjects.id })
    .from(subjects)
    .where(and(eq(subjects.id, id), isNull(subjects.deletedAt)))
    .limit(1);

  if (rows.length === 0) {
    return {
      success: false,
      error: "Mata pelajaran tidak ditemukan.",
      code: "SUBJECT_NOT_FOUND",
    };
  }

  return null;
}

async function ensureClassExists(
  id: string,
): Promise<AcademicServiceResult | null> {
  const db = await getDb();
  const rows = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.id, id), isNull(classes.deletedAt)))
    .limit(1);

  if (rows.length === 0) {
    return {
      success: false,
      error: "Kelas tidak ditemukan.",
      code: "CLASS_NOT_FOUND",
    };
  }

  return null;
}

async function ensureTeacherExists(
  id: string,
): Promise<AcademicServiceResult | null> {
  const db = await getDb();
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.id, id),
        eq(users.role, "teacher"),
        eq(users.isActive, true),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  if (rows.length === 0) {
    return {
      success: false,
      error: "Guru aktif yang valid wajib dipilih.",
      code: "INVALID_TEACHER",
    };
  }

  return null;
}

async function getTeachingAssignmentSnapshot(id: string) {
  const db = await getDb();
  const rows = await db
    .select({
      id: guruMapel.id,
      guruId: guruMapel.guruId,
      guruName: users.fullName,
      mataPelajaranId: guruMapel.mataPelajaranId,
      mataPelajaranName: subjects.name,
      kelasId: guruMapel.kelasId,
      kelasName: classes.name,
      semesterId: guruMapel.semesterId,
      semesterName: semester.nama,
    })
    .from(guruMapel)
    .innerJoin(users, eq(guruMapel.guruId, users.id))
    .innerJoin(subjects, eq(guruMapel.mataPelajaranId, subjects.id))
    .innerJoin(classes, eq(guruMapel.kelasId, classes.id))
    .innerJoin(semester, eq(guruMapel.semesterId, semester.id))
    .where(
      and(
        eq(guruMapel.id, id),
        isNull(guruMapel.deletedAt),
        isNull(users.deletedAt),
        isNull(subjects.deletedAt),
        isNull(classes.deletedAt),
        isNull(semester.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

async function ensureTeachingAssignmentExists(id: string): Promise<
  | { success: false; error: string; code?: string }
  | {
      success: true;
      assignment: NonNullable<
        Awaited<ReturnType<typeof getTeachingAssignmentSnapshot>>
      >;
    }
> {
  const assignment = await getTeachingAssignmentSnapshot(id);

  if (!assignment) {
    return {
      success: false,
      error: "Assignment guru-mapel tidak ditemukan.",
      code: "TEACHING_ASSIGNMENT_NOT_FOUND",
    };
  }

  return { success: true, assignment };
}

async function findJadwalConflicts(
  payload: {
    guruMapelId: string;
    hari: number;
    jamMulai: string;
    jamSelesai: string;
    ruangan?: string | null;
  },
  excludeId?: string,
): Promise<AcademicServiceResult | null> {
  const assignmentResult = await ensureTeachingAssignmentExists(
    payload.guruMapelId,
  );
  if (!assignmentResult.success) {
    return assignmentResult;
  }

  const db = await getDb();
  const rows = await db
    .select({
      id: jadwal.id,
      guruMapelId: jadwal.guruMapelId,
      hari: jadwal.hari,
      jamMulai: jadwal.jamMulai,
      jamSelesai: jadwal.jamSelesai,
      ruangan: jadwal.ruangan,
      guruId: guruMapel.guruId,
      guruName: users.fullName,
      kelasId: guruMapel.kelasId,
      kelasName: classes.name,
      mataPelajaranName: subjects.name,
    })
    .from(jadwal)
    .innerJoin(guruMapel, eq(jadwal.guruMapelId, guruMapel.id))
    .innerJoin(users, eq(guruMapel.guruId, users.id))
    .innerJoin(classes, eq(guruMapel.kelasId, classes.id))
    .innerJoin(subjects, eq(guruMapel.mataPelajaranId, subjects.id))
    .where(
      and(
        eq(jadwal.hari, payload.hari),
        isNull(jadwal.deletedAt),
        isNull(guruMapel.deletedAt),
        isNull(users.deletedAt),
        isNull(classes.deletedAt),
        isNull(subjects.deletedAt),
        ...(excludeId ? [ne(jadwal.id, excludeId)] : []),
      ),
    );

  const overlappingRows = rows.filter((row) =>
    isTimeRangeOverlapping(
      payload.jamMulai,
      payload.jamSelesai,
      row.jamMulai,
      row.jamSelesai,
    ),
  );

  const duplicate = overlappingRows.find(
    (row) =>
      row.guruMapelId === payload.guruMapelId &&
      row.jamMulai === payload.jamMulai &&
      row.jamSelesai === payload.jamSelesai,
  );

  if (duplicate) {
    return {
      success: false,
      error: "Slot jadwal yang sama untuk assignment ini sudah ada.",
      code: "SCHEDULE_EXISTS",
    };
  }

  const teacherConflict = overlappingRows.find(
    (row) => row.guruId === assignmentResult.assignment.guruId,
  );
  if (teacherConflict) {
    return {
      success: false,
      error: `Guru ${assignmentResult.assignment.guruName} sudah memiliki jadwal bentrok pada hari ini.`,
      code: "TEACHER_SCHEDULE_CONFLICT",
    };
  }

  const classConflict = overlappingRows.find(
    (row) => row.kelasId === assignmentResult.assignment.kelasId,
  );
  if (classConflict) {
    return {
      success: false,
      error: `Kelas ${assignmentResult.assignment.kelasName} sudah memiliki jadwal bentrok pada hari ini.`,
      code: "CLASS_SCHEDULE_CONFLICT",
    };
  }

  const normalizedRoom = payload.ruangan?.toLowerCase() ?? null;
  if (normalizedRoom) {
    const roomConflict = overlappingRows.find(
      (row) => row.ruangan?.toLowerCase() === normalizedRoom,
    );
    if (roomConflict) {
      return {
        success: false,
        error: `Ruangan ${payload.ruangan} sudah dipakai pada slot waktu yang bentrok.`,
        code: "ROOM_SCHEDULE_CONFLICT",
      };
    }
  }

  return null;
}

async function findAcademicYearByName(name: string, excludeId?: string) {
  const db = await getDb();
  const conditions = [
    eq(tahunAjaran.nama, name),
    isNull(tahunAjaran.deletedAt),
  ];
  if (excludeId) {
    conditions.push(ne(tahunAjaran.id, excludeId));
  }

  return db
    .select({ id: tahunAjaran.id })
    .from(tahunAjaran)
    .where(and(...conditions))
    .limit(1);
}

async function findSemesterByIdentity(
  tahunAjaranId: string,
  nama: string,
  excludeId?: string,
) {
  const db = await getDb();
  const conditions = [
    eq(semester.tahunAjaranId, tahunAjaranId),
    eq(semester.nama, nama),
    isNull(semester.deletedAt),
  ];
  if (excludeId) {
    conditions.push(ne(semester.id, excludeId));
  }

  return db
    .select({ id: semester.id })
    .from(semester)
    .where(and(...conditions))
    .limit(1);
}

async function findTeachingAssignmentByIdentity(
  payload: {
    guruId: string;
    mataPelajaranId: string;
    kelasId: string;
    semesterId: string;
  },
  excludeId?: string,
) {
  const db = await getDb();
  const conditions = [
    eq(guruMapel.guruId, payload.guruId),
    eq(guruMapel.mataPelajaranId, payload.mataPelajaranId),
    eq(guruMapel.kelasId, payload.kelasId),
    eq(guruMapel.semesterId, payload.semesterId),
    isNull(guruMapel.deletedAt),
  ];

  if (excludeId) {
    conditions.push(ne(guruMapel.id, excludeId));
  }

  return db
    .select({ id: guruMapel.id })
    .from(guruMapel)
    .where(and(...conditions))
    .limit(1);
}

async function setActiveAcademicYear(id: string) {
  const db = await getDb();
  const now = new Date();
  await db
    .update(tahunAjaran)
    .set({
      isActive: false,
      updatedAt: now,
      syncStatus: "pending",
    })
    .where(and(ne(tahunAjaran.id, id), isNull(tahunAjaran.deletedAt)));
}

async function setActiveSemester(id: string, academicYearId: string) {
  const db = await getDb();
  const now = new Date();

  await db
    .update(semester)
    .set({
      isActive: false,
      updatedAt: now,
      syncStatus: "pending",
    })
    .where(and(ne(semester.id, id), isNull(semester.deletedAt)));

  await db
    .update(tahunAjaran)
    .set({
      isActive: false,
      updatedAt: now,
      syncStatus: "pending",
    })
    .where(
      and(ne(tahunAjaran.id, academicYearId), isNull(tahunAjaran.deletedAt)),
    );

  await db
    .update(tahunAjaran)
    .set({
      isActive: true,
      updatedAt: now,
      syncStatus: "pending",
    })
    .where(eq(tahunAjaran.id, academicYearId));
}

export async function getClasses() {
  const db = await getDb();

  return db
    .select({
      id: classes.id,
      name: classes.name,
      academicYear: classes.academicYear,
      homeroomTeacherId: classes.homeroomTeacherId,
      homeroomTeacherName: users.fullName,
    })
    .from(classes)
    .leftJoin(
      users,
      and(
        eq(classes.homeroomTeacherId, users.id),
        eq(users.role, "teacher"),
        isNull(users.deletedAt),
      ),
    )
    .where(isNull(classes.deletedAt))
    .orderBy(desc(classes.createdAt));
}

export async function addClass(data: {
  name: string;
  academicYear: string;
  homeroomTeacherId?: string | null;
}): Promise<AcademicServiceResult> {
  const db = await getDb();
  const payload = normalizeClassPayload(data);
  const validation = classInsertSchema.safeParse(payload);

  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || "Data kelas tidak valid",
      code: "VALIDATION_ERROR",
    };
  }

  const homeroomValidation = await ensureHomeroomTeacherExists(
    validation.data.homeroomTeacherId,
  );
  if (homeroomValidation) {
    return homeroomValidation;
  }

  const existingClass = await findActiveClassByIdentity(
    validation.data.name,
    validation.data.academicYear,
  );

  if (existingClass.length > 0) {
    return {
      success: false,
      error:
        "Nama kelas sudah dipakai pada tahun ajaran yang sama. Gunakan kombinasi nama kelas dan tahun ajaran yang unik.",
      code: "CLASS_EXISTS",
    };
  }

  const id = crypto.randomUUID();

  await db.insert(classes).values({
    id,
    name: validation.data.name,
    academicYear: validation.data.academicYear,
    homeroomTeacherId: validation.data.homeroomTeacherId ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
    syncStatus: "pending",
  });

  return { success: true, id };
}

export async function updateClass(
  id: string,
  data: {
    name: string;
    academicYear: string;
    homeroomTeacherId?: string | null;
  },
): Promise<AcademicServiceResult> {
  const db = await getDb();
  const payload = normalizeClassPayload(data);
  const validation = classInsertSchema.safeParse(payload);

  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || "Data kelas tidak valid",
      code: "VALIDATION_ERROR",
    };
  }

  const existingClass = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.id, id), isNull(classes.deletedAt)))
    .limit(1);

  if (existingClass.length === 0) {
    return {
      success: false,
      error: "Data kelas tidak ditemukan",
      code: "NOT_FOUND",
    };
  }

  const homeroomValidation = await ensureHomeroomTeacherExists(
    validation.data.homeroomTeacherId,
  );
  if (homeroomValidation) {
    return homeroomValidation;
  }

  const duplicateClass = await findActiveClassByIdentity(
    validation.data.name,
    validation.data.academicYear,
    id,
  );

  if (duplicateClass.length > 0) {
    return {
      success: false,
      error:
        "Nama kelas sudah dipakai pada tahun ajaran yang sama. Gunakan kombinasi nama kelas dan tahun ajaran yang unik.",
      code: "CLASS_EXISTS",
    };
  }

  await db
    .update(classes)
    .set({
      name: validation.data.name,
      academicYear: validation.data.academicYear,
      homeroomTeacherId: validation.data.homeroomTeacherId ?? null,
      updatedAt: new Date(),
      syncStatus: "pending",
    })
    .where(eq(classes.id, id));

  return { success: true };
}

export async function deleteClass(id: string): Promise<AcademicServiceResult> {
  const db = await getDb();
  const existingClass = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.id, id), isNull(classes.deletedAt)))
    .limit(1);

  if (existingClass.length === 0) {
    return {
      success: false,
      error: "Data kelas tidak ditemukan",
      code: "NOT_FOUND",
    };
  }

  const [
    assignedStudents,
    attendanceUsage,
    scheduleUsage,
    teachingAssignments,
    reportUsage,
    announcementUsage,
  ] = await Promise.all([
    db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.kelasId, id),
          eq(users.role, "student"),
          eq(users.isActive, true),
          isNull(users.deletedAt),
        ),
      )
      .limit(1),
    db
      .select({ id: attendance.id })
      .from(attendance)
      .where(and(eq(attendance.classId, id), isNull(attendance.deletedAt)))
      .limit(1),
    findClassScheduleUsage(id),
    db
      .select({ id: guruMapel.id })
      .from(guruMapel)
      .where(and(eq(guruMapel.kelasId, id), isNull(guruMapel.deletedAt)))
      .limit(1),
    db
      .select({ id: raport.id })
      .from(raport)
      .where(and(eq(raport.kelasId, id), isNull(raport.deletedAt)))
      .limit(1),
    db
      .select({ id: pengumuman.id })
      .from(pengumuman)
      .where(
        and(eq(pengumuman.targetKelasId, id), isNull(pengumuman.deletedAt)),
      )
      .limit(1),
  ]);

  if (
    assignedStudents.length > 0 ||
    attendanceUsage.length > 0 ||
    hasAnyScheduleUsage(scheduleUsage) ||
    teachingAssignments.length > 0 ||
    reportUsage.length > 0 ||
    announcementUsage.length > 0
  ) {
    return {
      success: false,
      error:
        "Kelas masih dipakai modul lain. Lepaskan relasi siswa, absensi, jadwal, pengumuman, atau raport terlebih dahulu.",
      code: "CLASS_IN_USE",
    };
  }

  await db
    .update(classes)
    .set({
      deletedAt: new Date(),
      syncStatus: "pending",
      updatedAt: new Date(),
    })
    .where(eq(classes.id, id));

  return { success: true };
}

// --- SUBJECTS ---

export async function getSubjects() {
  const db = await getDb();
  return db
    .select()
    .from(subjects)
    .where(isNull(subjects.deletedAt))
    .orderBy(desc(subjects.createdAt));
}

export async function addSubject(data: {
  name: string;
  code: string;
}): Promise<AcademicServiceResult> {
  try {
    const db = await getDb();
    const payload = normalizeSubjectPayload(data);
    const validation = subjectInsertSchema.safeParse(payload);

    if (!validation.success) {
      return {
        success: false,
        error:
          validation.error.issues[0]?.message ||
          "Data mata pelajaran tidak valid",
        code: "VALIDATION_ERROR",
      };
    }

    const existingSubject = await db
      .select({ id: subjects.id, deletedAt: subjects.deletedAt })
      .from(subjects)
      .where(eq(subjects.code, validation.data.code))
      .limit(1);

    const matchedSubject = existingSubject[0];
    const now = new Date();

    if (matchedSubject && matchedSubject.deletedAt === null) {
      return {
        success: false,
        error: "Kode mata pelajaran sudah dipakai.",
        code: "SUBJECT_CODE_EXISTS",
      };
    }

    if (matchedSubject) {
      await db
        .update(subjects)
        .set({
          name: validation.data.name,
          code: validation.data.code,
          deletedAt: null,
          updatedAt: now,
          syncStatus: "pending",
        })
        .where(eq(subjects.id, matchedSubject.id));

      return { success: true, id: matchedSubject.id };
    }

    const id = crypto.randomUUID();

    await db.insert(subjects).values({
      id,
      name: validation.data.name,
      code: validation.data.code,
      createdAt: now,
      updatedAt: now,
      syncStatus: "pending",
    });

    return { success: true, id };
  } catch (error) {
    console.error("[SERVICE_ERROR] addSubject:", error);

    if (isUniqueConstraintError(error)) {
      return {
        success: false,
        error: "Kode mata pelajaran sudah dipakai.",
        code: "SUBJECT_CODE_EXISTS",
      };
    }

    return {
      success: false,
      error: "Gagal membuat mata pelajaran. Kesalahan sistem.",
      code: "INTERNAL_ERROR",
    };
  }
}

export async function updateSubject(
  id: string,
  data: { name: string; code: string },
): Promise<AcademicServiceResult> {
  const db = await getDb();
  const payload = normalizeSubjectPayload(data);
  const validation = subjectInsertSchema.safeParse(payload);

  if (!validation.success) {
    return {
      success: false,
      error:
        validation.error.issues[0]?.message ||
        "Data mata pelajaran tidak valid",
      code: "VALIDATION_ERROR",
    };
  }

  const existingSubject = await db
    .select({ id: subjects.id })
    .from(subjects)
    .where(and(eq(subjects.id, id), isNull(subjects.deletedAt)))
    .limit(1);

  if (existingSubject.length === 0) {
    return {
      success: false,
      error: "Data mata pelajaran tidak ditemukan",
      code: "NOT_FOUND",
    };
  }

  const duplicateCode = await db
    .select({ id: subjects.id })
    .from(subjects)
    .where(
      and(
        eq(subjects.code, validation.data.code),
        ne(subjects.id, id),
        isNull(subjects.deletedAt),
      ),
    )
    .limit(1);

  if (duplicateCode.length > 0) {
    return {
      success: false,
      error: "Kode mata pelajaran sudah dipakai.",
      code: "SUBJECT_CODE_EXISTS",
    };
  }

  await db
    .update(subjects)
    .set({
      name: validation.data.name,
      code: validation.data.code,
      updatedAt: new Date(),
      syncStatus: "pending",
    })
    .where(eq(subjects.id, id));

  return { success: true };
}

export async function deleteSubject(
  id: string,
): Promise<AcademicServiceResult> {
  const db = await getDb();
  const existingSubject = await db
    .select({ id: subjects.id })
    .from(subjects)
    .where(and(eq(subjects.id, id), isNull(subjects.deletedAt)))
    .limit(1);

  if (existingSubject.length === 0) {
    return {
      success: false,
      error: "Data mata pelajaran tidak ditemukan",
      code: "NOT_FOUND",
    };
  }

  const [scheduleUsage, teachingAssignments] = await Promise.all([
    findSubjectScheduleUsage(id),
    db
      .select({ id: guruMapel.id })
      .from(guruMapel)
      .where(
        and(eq(guruMapel.mataPelajaranId, id), isNull(guruMapel.deletedAt)),
      )
      .limit(1),
  ]);

  if (hasAnyScheduleUsage(scheduleUsage) || teachingAssignments.length > 0) {
    return {
      success: false,
      error:
        "Mata pelajaran masih dipakai jadwal atau assignment guru-mapel. Lepaskan relasinya terlebih dahulu.",
      code: "SUBJECT_IN_USE",
    };
  }

  await db
    .update(subjects)
    .set({
      deletedAt: new Date(),
      syncStatus: "pending",
      updatedAt: new Date(),
    })
    .where(eq(subjects.id, id));

  return { success: true };
}

// --- ACADEMIC YEARS ---

export async function getAcademicYears() {
  const db = await getDb();
  return db
    .select({
      id: tahunAjaran.id,
      nama: tahunAjaran.nama,
      tanggalMulai: tahunAjaran.tanggalMulai,
      tanggalSelesai: tahunAjaran.tanggalSelesai,
      isActive: tahunAjaran.isActive,
    })
    .from(tahunAjaran)
    .where(isNull(tahunAjaran.deletedAt))
    .orderBy(desc(tahunAjaran.createdAt));
}

export async function addAcademicYear(data: {
  nama: string;
  tanggalMulai: string | Date;
  tanggalSelesai: string | Date;
  isActive?: boolean;
}): Promise<AcademicServiceResult> {
  const db = await getDb();
  const payload = normalizeAcademicYearPayload(data);
  const validation = academicYearInsertSchema.safeParse(payload);

  if (!validation.success) {
    return {
      success: false,
      error:
        validation.error.issues[0]?.message || "Data tahun ajaran tidak valid",
      code: "VALIDATION_ERROR",
    };
  }

  const duplicate = await findAcademicYearByName(validation.data.nama);
  if (duplicate.length > 0) {
    return {
      success: false,
      error: "Nama tahun ajaran sudah dipakai.",
      code: "ACADEMIC_YEAR_EXISTS",
    };
  }

  const id = crypto.randomUUID();
  const now = new Date();

  if (validation.data.isActive) {
    await setActiveAcademicYear(id);
  }

  await db.insert(tahunAjaran).values({
    id,
    nama: validation.data.nama,
    tanggalMulai: validation.data.tanggalMulai,
    tanggalSelesai: validation.data.tanggalSelesai,
    isActive: validation.data.isActive ?? false,
    createdAt: now,
    updatedAt: now,
    syncStatus: "pending",
  });

  return { success: true, id };
}

export async function updateAcademicYear(
  id: string,
  data: {
    nama: string;
    tanggalMulai: string | Date;
    tanggalSelesai: string | Date;
    isActive?: boolean;
  },
): Promise<AcademicServiceResult> {
  const db = await getDb();
  const payload = normalizeAcademicYearPayload(data);
  const validation = academicYearInsertSchema.safeParse(payload);

  if (!validation.success) {
    return {
      success: false,
      error:
        validation.error.issues[0]?.message || "Data tahun ajaran tidak valid",
      code: "VALIDATION_ERROR",
    };
  }

  const existing = await db
    .select({
      id: tahunAjaran.id,
      nama: tahunAjaran.nama,
      isActive: tahunAjaran.isActive,
    })
    .from(tahunAjaran)
    .where(and(eq(tahunAjaran.id, id), isNull(tahunAjaran.deletedAt)))
    .limit(1);

  const current = existing[0];
  if (!current) {
    return {
      success: false,
      error: "Data tahun ajaran tidak ditemukan",
      code: "NOT_FOUND",
    };
  }

  if (current.isActive && validation.data.isActive === false) {
    return {
      success: false,
      error:
        "Tahun ajaran aktif tidak bisa dinonaktifkan langsung. Aktifkan tahun ajaran lain terlebih dahulu.",
      code: "ACTIVE_ACADEMIC_YEAR_REQUIRED",
    };
  }

  const duplicate = await findAcademicYearByName(validation.data.nama, id);
  if (duplicate.length > 0) {
    return {
      success: false,
      error: "Nama tahun ajaran sudah dipakai.",
      code: "ACADEMIC_YEAR_EXISTS",
    };
  }

  const now = new Date();

  if (validation.data.isActive) {
    await setActiveAcademicYear(id);
  }

  await db
    .update(tahunAjaran)
    .set({
      nama: validation.data.nama,
      tanggalMulai: validation.data.tanggalMulai,
      tanggalSelesai: validation.data.tanggalSelesai,
      isActive: validation.data.isActive ?? false,
      updatedAt: now,
      syncStatus: "pending",
    })
    .where(eq(tahunAjaran.id, id));

  if (current.nama !== validation.data.nama) {
    await Promise.all([
      db
        .update(classes)
        .set({
          academicYear: validation.data.nama,
          updatedAt: now,
          syncStatus: "pending",
        })
        .where(
          and(
            eq(classes.academicYear, current.nama),
            isNull(classes.deletedAt),
          ),
        ),
      db
        .update(nilai)
        .set({
          tahunAjaran: validation.data.nama,
          updatedAt: now,
          syncStatus: "pending",
        })
        .where(
          and(eq(nilai.tahunAjaran, current.nama), isNull(nilai.deletedAt)),
        ),
    ]);
  }

  return { success: true };
}

export async function deleteAcademicYear(
  id: string,
): Promise<AcademicServiceResult> {
  const db = await getDb();
  const existing = await db
    .select({
      id: tahunAjaran.id,
      nama: tahunAjaran.nama,
      isActive: tahunAjaran.isActive,
    })
    .from(tahunAjaran)
    .where(and(eq(tahunAjaran.id, id), isNull(tahunAjaran.deletedAt)))
    .limit(1);

  const current = existing[0];
  if (!current) {
    return {
      success: false,
      error: "Data tahun ajaran tidak ditemukan",
      code: "NOT_FOUND",
    };
  }

  if (current.isActive) {
    return {
      success: false,
      error:
        "Tahun ajaran aktif tidak bisa dihapus. Aktifkan tahun ajaran lain terlebih dahulu.",
      code: "ACTIVE_ACADEMIC_YEAR_REQUIRED",
    };
  }

  const [semesterUsage, raportUsage, classUsage, gradeUsage] =
    await Promise.all([
      db
        .select({ id: semester.id })
        .from(semester)
        .where(and(eq(semester.tahunAjaranId, id), isNull(semester.deletedAt)))
        .limit(1),
      db
        .select({ id: raport.id })
        .from(raport)
        .where(and(eq(raport.tahunAjaranId, id), isNull(raport.deletedAt)))
        .limit(1),
      db
        .select({ id: classes.id })
        .from(classes)
        .where(
          and(
            eq(classes.academicYear, current.nama),
            isNull(classes.deletedAt),
          ),
        )
        .limit(1),
      db
        .select({ id: nilai.id })
        .from(nilai)
        .where(
          and(eq(nilai.tahunAjaran, current.nama), isNull(nilai.deletedAt)),
        )
        .limit(1),
    ]);

  if (
    semesterUsage.length > 0 ||
    raportUsage.length > 0 ||
    classUsage.length > 0 ||
    gradeUsage.length > 0
  ) {
    return {
      success: false,
      error:
        "Tahun ajaran masih dipakai semester, kelas, nilai, atau raport. Lepaskan relasinya terlebih dahulu.",
      code: "ACADEMIC_YEAR_IN_USE",
    };
  }

  await db
    .update(tahunAjaran)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
      syncStatus: "pending",
    })
    .where(eq(tahunAjaran.id, id));

  return { success: true };
}

// --- SEMESTERS ---

export async function getSemesters() {
  const db = await getDb();
  return db
    .select({
      id: semester.id,
      tahunAjaranId: semester.tahunAjaranId,
      tahunAjaranNama: tahunAjaran.nama,
      nama: semester.nama,
      tanggalMulai: semester.tanggalMulai,
      tanggalSelesai: semester.tanggalSelesai,
      isActive: semester.isActive,
    })
    .from(semester)
    .innerJoin(tahunAjaran, eq(semester.tahunAjaranId, tahunAjaran.id))
    .where(and(isNull(semester.deletedAt), isNull(tahunAjaran.deletedAt)))
    .orderBy(desc(semester.createdAt));
}

export async function addSemester(data: {
  tahunAjaranId: string;
  nama: string;
  tanggalMulai: string | Date;
  tanggalSelesai: string | Date;
  isActive?: boolean;
}): Promise<AcademicServiceResult> {
  const db = await getDb();
  const payload = normalizeSemesterPayload(data);
  const validation = semesterInsertSchema.safeParse(payload);

  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || "Data semester tidak valid",
      code: "VALIDATION_ERROR",
    };
  }

  const yearValidation = await ensureAcademicYearExists(
    validation.data.tahunAjaranId,
  );
  if (yearValidation) {
    return yearValidation;
  }

  const duplicate = await findSemesterByIdentity(
    validation.data.tahunAjaranId,
    validation.data.nama,
  );
  if (duplicate.length > 0) {
    return {
      success: false,
      error: "Semester dengan nama yang sama sudah ada pada tahun ajaran ini.",
      code: "SEMESTER_EXISTS",
    };
  }

  const id = crypto.randomUUID();
  const now = new Date();

  if (validation.data.isActive) {
    await setActiveSemester(id, validation.data.tahunAjaranId);
  }

  await db.insert(semester).values({
    id,
    tahunAjaranId: validation.data.tahunAjaranId,
    nama: validation.data.nama,
    tanggalMulai: validation.data.tanggalMulai,
    tanggalSelesai: validation.data.tanggalSelesai,
    isActive: validation.data.isActive ?? false,
    createdAt: now,
    updatedAt: now,
    syncStatus: "pending",
  });

  return { success: true, id };
}

export async function updateSemester(
  id: string,
  data: {
    tahunAjaranId: string;
    nama: string;
    tanggalMulai: string | Date;
    tanggalSelesai: string | Date;
    isActive?: boolean;
  },
): Promise<AcademicServiceResult> {
  const db = await getDb();
  const payload = normalizeSemesterPayload(data);
  const validation = semesterInsertSchema.safeParse(payload);

  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || "Data semester tidak valid",
      code: "VALIDATION_ERROR",
    };
  }

  const existing = await db
    .select({ id: semester.id, isActive: semester.isActive })
    .from(semester)
    .where(and(eq(semester.id, id), isNull(semester.deletedAt)))
    .limit(1);

  if (existing.length === 0) {
    return {
      success: false,
      error: "Data semester tidak ditemukan",
      code: "NOT_FOUND",
    };
  }

  if (existing[0]?.isActive && validation.data.isActive === false) {
    return {
      success: false,
      error:
        "Semester aktif tidak bisa dinonaktifkan langsung. Aktifkan semester lain terlebih dahulu.",
      code: "ACTIVE_SEMESTER_REQUIRED",
    };
  }

  const yearValidation = await ensureAcademicYearExists(
    validation.data.tahunAjaranId,
  );
  if (yearValidation) {
    return yearValidation;
  }

  const duplicate = await findSemesterByIdentity(
    validation.data.tahunAjaranId,
    validation.data.nama,
    id,
  );
  if (duplicate.length > 0) {
    return {
      success: false,
      error: "Semester dengan nama yang sama sudah ada pada tahun ajaran ini.",
      code: "SEMESTER_EXISTS",
    };
  }

  if (validation.data.isActive) {
    await setActiveSemester(id, validation.data.tahunAjaranId);
  }

  await db
    .update(semester)
    .set({
      tahunAjaranId: validation.data.tahunAjaranId,
      nama: validation.data.nama,
      tanggalMulai: validation.data.tanggalMulai,
      tanggalSelesai: validation.data.tanggalSelesai,
      isActive: validation.data.isActive ?? false,
      updatedAt: new Date(),
      syncStatus: "pending",
    })
    .where(eq(semester.id, id));

  return { success: true };
}

export async function deleteSemester(
  id: string,
): Promise<AcademicServiceResult> {
  const db = await getDb();
  const existing = await db
    .select({ id: semester.id, isActive: semester.isActive })
    .from(semester)
    .where(and(eq(semester.id, id), isNull(semester.deletedAt)))
    .limit(1);

  if (existing.length === 0) {
    return {
      success: false,
      error: "Data semester tidak ditemukan",
      code: "NOT_FOUND",
    };
  }

  if (existing[0]?.isActive) {
    return {
      success: false,
      error:
        "Semester aktif tidak bisa dihapus. Aktifkan semester lain terlebih dahulu.",
      code: "ACTIVE_SEMESTER_REQUIRED",
    };
  }

  const [assignmentUsage, reportUsage] = await Promise.all([
    db
      .select({ id: guruMapel.id })
      .from(guruMapel)
      .where(and(eq(guruMapel.semesterId, id), isNull(guruMapel.deletedAt)))
      .limit(1),
    db
      .select({ id: raport.id })
      .from(raport)
      .where(and(eq(raport.semesterId, id), isNull(raport.deletedAt)))
      .limit(1),
  ]);

  if (assignmentUsage.length > 0 || reportUsage.length > 0) {
    return {
      success: false,
      error:
        "Semester masih dipakai assignment guru-mapel atau raport. Lepaskan relasinya terlebih dahulu.",
      code: "SEMESTER_IN_USE",
    };
  }

  await db
    .update(semester)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
      syncStatus: "pending",
    })
    .where(eq(semester.id, id));

  return { success: true };
}

// --- TEACHING ASSIGNMENTS / GURU MAPEL ---

export async function getTeachingAssignments() {
  const db = await getDb();
  return db
    .select({
      id: guruMapel.id,
      guruId: guruMapel.guruId,
      guruName: users.fullName,
      mataPelajaranId: guruMapel.mataPelajaranId,
      mataPelajaranName: subjects.name,
      mataPelajaranCode: subjects.code,
      kelasId: guruMapel.kelasId,
      kelasName: classes.name,
      semesterId: guruMapel.semesterId,
      semesterName: semester.nama,
      tahunAjaranNama: tahunAjaran.nama,
    })
    .from(guruMapel)
    .innerJoin(users, eq(guruMapel.guruId, users.id))
    .innerJoin(subjects, eq(guruMapel.mataPelajaranId, subjects.id))
    .innerJoin(classes, eq(guruMapel.kelasId, classes.id))
    .innerJoin(semester, eq(guruMapel.semesterId, semester.id))
    .leftJoin(tahunAjaran, eq(semester.tahunAjaranId, tahunAjaran.id))
    .where(
      and(
        isNull(guruMapel.deletedAt),
        isNull(users.deletedAt),
        isNull(subjects.deletedAt),
        isNull(classes.deletedAt),
        isNull(semester.deletedAt),
      ),
    )
    .orderBy(desc(guruMapel.createdAt));
}

export async function getTeachingAssignmentScheduleOptions() {
  const db = await getDb();
  return db
    .select({
      id: guruMapel.id,
      guruName: users.fullName,
      mataPelajaranName: subjects.name,
      kelasName: classes.name,
      semesterName: semester.nama,
      tahunAjaranNama: tahunAjaran.nama,
    })
    .from(guruMapel)
    .innerJoin(users, eq(guruMapel.guruId, users.id))
    .innerJoin(subjects, eq(guruMapel.mataPelajaranId, subjects.id))
    .innerJoin(classes, eq(guruMapel.kelasId, classes.id))
    .innerJoin(semester, eq(guruMapel.semesterId, semester.id))
    .leftJoin(tahunAjaran, eq(semester.tahunAjaranId, tahunAjaran.id))
    .where(
      and(
        isNull(guruMapel.deletedAt),
        isNull(users.deletedAt),
        isNull(subjects.deletedAt),
        isNull(classes.deletedAt),
        isNull(semester.deletedAt),
      ),
    )
    .orderBy(
      users.fullName,
      classes.name,
      semester.nama,
      desc(guruMapel.createdAt),
    );
}

export async function addTeachingAssignment(data: {
  guruId: string;
  mataPelajaranId: string;
  kelasId: string;
  semesterId: string;
}): Promise<AcademicServiceResult> {
  const db = await getDb();
  const payload = normalizeTeachingAssignmentPayload(data);
  const validation = teacherSubjectInsertSchema.safeParse(payload);

  if (!validation.success) {
    return {
      success: false,
      error:
        validation.error.issues[0]?.message || "Data assignment tidak valid",
      code: "VALIDATION_ERROR",
    };
  }

  const [
    teacherValidation,
    subjectValidation,
    classValidation,
    semesterValidation,
  ] = await Promise.all([
    ensureTeacherExists(validation.data.guruId),
    ensureSubjectExists(validation.data.mataPelajaranId),
    ensureClassExists(validation.data.kelasId),
    ensureSemesterExists(validation.data.semesterId),
  ]);

  const failedValidation =
    teacherValidation ||
    subjectValidation ||
    classValidation ||
    semesterValidation;
  if (failedValidation) {
    return failedValidation;
  }

  const duplicate = await findTeachingAssignmentByIdentity(validation.data);
  if (duplicate.length > 0) {
    return {
      success: false,
      error:
        "Assignment guru-mapel untuk kombinasi guru, mata pelajaran, kelas, dan semester ini sudah ada.",
      code: "TEACHING_ASSIGNMENT_EXISTS",
    };
  }

  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(guruMapel).values({
    id,
    guruId: validation.data.guruId,
    mataPelajaranId: validation.data.mataPelajaranId,
    kelasId: validation.data.kelasId,
    semesterId: validation.data.semesterId,
    createdAt: now,
    updatedAt: now,
    syncStatus: "pending",
  });

  return { success: true, id };
}

export async function updateTeachingAssignment(
  id: string,
  data: {
    guruId: string;
    mataPelajaranId: string;
    kelasId: string;
    semesterId: string;
  },
): Promise<AcademicServiceResult> {
  const db = await getDb();
  const payload = normalizeTeachingAssignmentPayload(data);
  const validation = teacherSubjectInsertSchema.safeParse(payload);

  if (!validation.success) {
    return {
      success: false,
      error:
        validation.error.issues[0]?.message || "Data assignment tidak valid",
      code: "VALIDATION_ERROR",
    };
  }

  const existing = await db
    .select({
      id: guruMapel.id,
      guruId: guruMapel.guruId,
      mataPelajaranId: guruMapel.mataPelajaranId,
      kelasId: guruMapel.kelasId,
      semesterId: guruMapel.semesterId,
    })
    .from(guruMapel)
    .where(and(eq(guruMapel.id, id), isNull(guruMapel.deletedAt)))
    .limit(1);

  if (existing.length === 0) {
    return {
      success: false,
      error: "Data assignment guru-mapel tidak ditemukan",
      code: "NOT_FOUND",
    };
  }

  const [
    teacherValidation,
    subjectValidation,
    classValidation,
    semesterValidation,
  ] = await Promise.all([
    ensureTeacherExists(validation.data.guruId),
    ensureSubjectExists(validation.data.mataPelajaranId),
    ensureClassExists(validation.data.kelasId),
    ensureSemesterExists(validation.data.semesterId),
  ]);

  const failedValidation =
    teacherValidation ||
    subjectValidation ||
    classValidation ||
    semesterValidation;
  if (failedValidation) {
    return failedValidation;
  }

  const duplicate = await findTeachingAssignmentByIdentity(validation.data, id);
  if (duplicate.length > 0) {
    return {
      success: false,
      error:
        "Assignment guru-mapel untuk kombinasi guru, mata pelajaran, kelas, dan semester ini sudah ada.",
      code: "TEACHING_ASSIGNMENT_EXISTS",
    };
  }

  const jadwalUsage = await db
    .select({ id: jadwal.id })
    .from(jadwal)
    .where(and(eq(jadwal.guruMapelId, id), isNull(jadwal.deletedAt)))
    .limit(1);

  const identityChanged =
    existing[0] &&
    (existing[0].guruId !== validation.data.guruId ||
      existing[0].mataPelajaranId !== validation.data.mataPelajaranId ||
      existing[0].kelasId !== validation.data.kelasId ||
      existing[0].semesterId !== validation.data.semesterId);

  if (jadwalUsage.length > 0 && identityChanged) {
    return {
      success: false,
      error:
        "Assignment guru-mapel yang sudah dipakai jadwal tidak boleh diubah ke kombinasi lain. Pindahkan atau hapus jadwalnya terlebih dahulu.",
      code: "TEACHING_ASSIGNMENT_IN_USE",
    };
  }

  await db
    .update(guruMapel)
    .set({
      guruId: validation.data.guruId,
      mataPelajaranId: validation.data.mataPelajaranId,
      kelasId: validation.data.kelasId,
      semesterId: validation.data.semesterId,
      updatedAt: new Date(),
      syncStatus: "pending",
    })
    .where(eq(guruMapel.id, id));

  return { success: true };
}

// --- JADWAL / SCHEDULES ---

export async function getSchedules(filters?: {
  hari?: number;
  search?: string;
}) {
  const db = await getDb();
  const conditions = [
    isNull(jadwal.deletedAt),
    isNull(guruMapel.deletedAt),
    isNull(users.deletedAt),
    isNull(subjects.deletedAt),
    isNull(classes.deletedAt),
    isNull(semester.deletedAt),
  ];

  if (typeof filters?.hari === "number") {
    conditions.push(eq(jadwal.hari, filters.hari));
  }

  const search = filters?.search?.trim().toLowerCase();
  if (search) {
    const keyword = `%${search}%`;
    const searchCondition = or(
      sql`lower(${users.fullName}) like ${keyword}`,
      sql`lower(${subjects.name}) like ${keyword}`,
      sql`lower(${subjects.code}) like ${keyword}`,
      sql`lower(${classes.name}) like ${keyword}`,
      sql`lower(${semester.nama}) like ${keyword}`,
      sql`lower(coalesce(${tahunAjaran.nama}, '')) like ${keyword}`,
      sql`lower(coalesce(${jadwal.ruangan}, '')) like ${keyword}`,
    );
    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }

  return db
    .select({
      id: jadwal.id,
      guruMapelId: jadwal.guruMapelId,
      hari: jadwal.hari,
      jamMulai: jadwal.jamMulai,
      jamSelesai: jadwal.jamSelesai,
      ruangan: jadwal.ruangan,
      guruName: users.fullName,
      mataPelajaranName: subjects.name,
      mataPelajaranCode: subjects.code,
      kelasName: classes.name,
      semesterName: semester.nama,
      tahunAjaranNama: tahunAjaran.nama,
    })
    .from(jadwal)
    .innerJoin(guruMapel, eq(jadwal.guruMapelId, guruMapel.id))
    .innerJoin(users, eq(guruMapel.guruId, users.id))
    .innerJoin(subjects, eq(guruMapel.mataPelajaranId, subjects.id))
    .innerJoin(classes, eq(guruMapel.kelasId, classes.id))
    .innerJoin(semester, eq(guruMapel.semesterId, semester.id))
    .leftJoin(tahunAjaran, eq(semester.tahunAjaranId, tahunAjaran.id))
    .where(and(...conditions))
    .orderBy(jadwal.hari, jadwal.jamMulai, desc(jadwal.createdAt));
}

export async function addSchedule(data: {
  guruMapelId: string;
  hari: number;
  jamMulai: string;
  jamSelesai: string;
  ruangan?: string | null;
}): Promise<AcademicServiceResult> {
  const db = await getDb();
  const payload = normalizeJadwalPayload(data);
  const validation = jadwalInsertSchema.safeParse(payload);

  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || "Data jadwal tidak valid",
      code: "VALIDATION_ERROR",
    };
  }

  const conflict = await findJadwalConflicts(validation.data);
  if (conflict) {
    return conflict;
  }

  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(jadwal).values({
    id,
    guruMapelId: validation.data.guruMapelId,
    hari: validation.data.hari,
    jamMulai: validation.data.jamMulai,
    jamSelesai: validation.data.jamSelesai,
    ruangan: validation.data.ruangan ?? null,
    createdAt: now,
    updatedAt: now,
    syncStatus: "pending",
  });

  return { success: true, id };
}

export async function updateSchedule(
  id: string,
  data: {
    guruMapelId: string;
    hari: number;
    jamMulai: string;
    jamSelesai: string;
    ruangan?: string | null;
  },
): Promise<AcademicServiceResult> {
  const db = await getDb();
  const payload = normalizeJadwalPayload(data);
  const validation = jadwalInsertSchema.safeParse(payload);

  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || "Data jadwal tidak valid",
      code: "VALIDATION_ERROR",
    };
  }

  const existing = await db
    .select({ id: jadwal.id })
    .from(jadwal)
    .where(and(eq(jadwal.id, id), isNull(jadwal.deletedAt)))
    .limit(1);

  if (existing.length === 0) {
    return {
      success: false,
      error: "Data jadwal tidak ditemukan",
      code: "NOT_FOUND",
    };
  }

  const conflict = await findJadwalConflicts(validation.data, id);
  if (conflict) {
    return conflict;
  }

  await db
    .update(jadwal)
    .set({
      guruMapelId: validation.data.guruMapelId,
      hari: validation.data.hari,
      jamMulai: validation.data.jamMulai,
      jamSelesai: validation.data.jamSelesai,
      ruangan: validation.data.ruangan ?? null,
      updatedAt: new Date(),
      syncStatus: "pending",
    })
    .where(eq(jadwal.id, id));

  return { success: true };
}

export async function deleteSchedule(
  id: string,
): Promise<AcademicServiceResult> {
  const db = await getDb();
  const existing = await db
    .select({ id: jadwal.id })
    .from(jadwal)
    .where(and(eq(jadwal.id, id), isNull(jadwal.deletedAt)))
    .limit(1);

  if (existing.length === 0) {
    return {
      success: false,
      error: "Data jadwal tidak ditemukan",
      code: "NOT_FOUND",
    };
  }

  await db
    .update(jadwal)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
      syncStatus: "pending",
    })
    .where(eq(jadwal.id, id));

  return { success: true };
}

export async function deleteTeachingAssignment(
  id: string,
): Promise<AcademicServiceResult> {
  const db = await getDb();
  const existing = await db
    .select({ id: guruMapel.id })
    .from(guruMapel)
    .where(and(eq(guruMapel.id, id), isNull(guruMapel.deletedAt)))
    .limit(1);

  if (existing.length === 0) {
    return {
      success: false,
      error: "Data assignment guru-mapel tidak ditemukan",
      code: "NOT_FOUND",
    };
  }

  const [gradeUsage, jadwalUsage] = await Promise.all([
    db
      .select({ id: nilai.id })
      .from(nilai)
      .where(and(eq(nilai.guruMapelId, id), isNull(nilai.deletedAt)))
      .limit(1),
    db
      .select({ id: jadwal.id })
      .from(jadwal)
      .where(and(eq(jadwal.guruMapelId, id), isNull(jadwal.deletedAt)))
      .limit(1),
  ]);

  if (gradeUsage.length > 0 || jadwalUsage.length > 0) {
    return {
      success: false,
      error:
        "Assignment guru-mapel masih dipakai jadwal atau nilai. Lepaskan relasinya terlebih dahulu.",
      code: "TEACHING_ASSIGNMENT_IN_USE",
    };
  }

  await db
    .update(guruMapel)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
      syncStatus: "pending",
    })
    .where(eq(guruMapel.id, id));

  return { success: true };
}
