import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { attendanceSettings, classes, students, users } from "@/lib/db/schema";

const DEFAULT_ACTIVE_DAYS = [1, 2, 3, 4, 5] as const;

function getAcademicYearLabel(): string {
  const year = new Date().getFullYear();
  return `${year}/${year + 1}`;
}

export async function ensureDefaultAttendanceSettings(): Promise<number> {
  const db = await getDb();

  const existing = await db
    .select({ id: attendanceSettings.id })
    .from(attendanceSettings)
    .where(
      and(
        eq(attendanceSettings.entityType, "student"),
        isNull(attendanceSettings.deletedAt),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    return 0;
  }

  const now = new Date();
  for (const dayOfWeek of DEFAULT_ACTIVE_DAYS) {
    await db.insert(attendanceSettings).values({
      id: crypto.randomUUID(),
      dayOfWeek,
      startTime: "07:00",
      endTime: "15:00",
      lateThreshold: "07:15",
      entityType: "student",
      isActive: true,
      createdAt: now,
      updatedAt: now,
      syncStatus: "pending",
      deletedAt: null,
    });
  }

  return DEFAULT_ACTIVE_DAYS.length;
}

export async function syncUsersToStudentsProjection(): Promise<{
  classCreated: number;
  studentUpserted: number;
  settingsSeeded: number;
}> {
  const db = await getDb();
  const now = new Date();
  const academicYear = getAcademicYearLabel();

  const classById = new Map<string, string>();
  const classByName = new Map<string, string>();
  const existingClasses = await db
    .select({ id: classes.id, name: classes.name })
    .from(classes)
    .where(isNull(classes.deletedAt));

  for (const classItem of existingClasses) {
    classById.set(classItem.id, classItem.name);
    classByName.set(classItem.name, classItem.id);
  }

  const allStudents = await db
    .select({ grade: students.grade })
    .from(students)
    .where(isNull(students.deletedAt));

  // Normalize legacy grade values that accidentally store classes.id
  for (const row of allStudents) {
    const gradeValue = row.grade.trim();
    const mappedName = classById.get(gradeValue);

    if (!mappedName || mappedName === gradeValue) {
      continue;
    }

    await db
      .update(students)
      .set({
        grade: mappedName,
        updatedAt: now,
        syncStatus: "pending",
      })
      .where(eq(students.grade, gradeValue));
  }

  const studentUsers = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      nis: users.nis,
      nisn: users.nisn,
      tempatLahir: users.tempatLahir,
      tanggalLahir: users.tanggalLahir,
      jenisKelamin: users.jenisKelamin,
      alamat: users.alamat,
      kelasId: users.kelasId,
    })
    .from(users)
    .where(
      and(
        eq(users.role, "student"),
        eq(users.isActive, true),
        isNull(users.deletedAt),
      ),
    );

  let classCreated = 0;
  const classCandidates = new Set<string>();

  for (const student of allStudents) {
    const grade = student.grade.trim();
    if (!grade) continue;

    if (classById.has(grade)) {
      classCandidates.add(classById.get(grade) as string);
      continue;
    }

    classCandidates.add(grade);
  }

  for (const user of studentUsers) {
    const classRef = user.kelasId?.trim();
    if (classRef) classCandidates.add(classRef);
  }

  for (const candidate of classCandidates) {
    if (!candidate) continue;

    if (classByName.has(candidate) || classById.has(candidate)) {
      continue;
    }

    const classId = crypto.randomUUID();
    await db.insert(classes).values({
      id: classId,
      name: candidate,
      academicYear: academicYear,
      homeroomTeacherId: null,
      level: null,
      room: null,
      capacity: null,
      isActive: true,
      version: 1,
      hlc: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: "pending",
    });

    classById.set(classId, candidate);
    classByName.set(candidate, classId);
    classCreated += 1;
  }

  let studentUpserted = 0;

  for (const user of studentUsers) {
    const nis = user.nis?.trim();
    if (!nis) continue;

    const classRef = user.kelasId?.trim();
    const grade = classRef
      ? (classById.get(classRef) ?? classByName.get(classRef) ?? classRef)
      : "UNASSIGNED";

    const gender = user.jenisKelamin === "P" ? "P" : "L";

    const existingStudent = await db
      .select({ id: students.id })
      .from(students)
      .where(eq(students.nis, nis))
      .limit(1);

    if (existingStudent.length === 0) {
      await db.insert(students).values({
        id: user.id,
        nis,
        fullName: user.fullName,
        gender,
        grade,
        parentName: null,
        parentPhone: null,
        nisn: user.nisn,
        tempatLahir: user.tempatLahir,
        tanggalLahir: user.tanggalLahir,
        alamat: user.alamat,
        version: 1,
        hlc: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: "pending",
      });
      studentUpserted += 1;
      continue;
    }

    await db
      .update(students)
      .set({
        fullName: user.fullName,
        gender,
        grade,
        nisn: user.nisn,
        tempatLahir: user.tempatLahir,
        tanggalLahir: user.tanggalLahir,
        alamat: user.alamat,
        deletedAt: null,
        updatedAt: now,
        syncStatus: "pending",
      })
      .where(eq(students.nis, nis));

    studentUpserted += 1;
  }

  const settingsSeeded = await ensureDefaultAttendanceSettings();

  return {
    classCreated,
    studentUpserted,
    settingsSeeded,
  };
}
