import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  attendance,
  attendanceSettings,
  classes,
  studentDailyAttendance,
  students,
  users,
} from "@/lib/db/schema";
import {
  isUuidLikeClassValue,
  sanitizeClassDisplayName,
} from "@/lib/utils/class-name";

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
  const values = DEFAULT_ACTIVE_DAYS.map((dayOfWeek) => ({
    id: crypto.randomUUID(),
    dayOfWeek,
    startTime: "07:00",
    endTime: "15:00",
    lateThreshold: "07:15",
    entityType: "student" as const,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    syncStatus: "pending" as const,
    deletedAt: null,
  }));

  for (const val of values) {
    await db.insert(attendanceSettings).values(val);
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

  // 1. Load data in bulk
  const existingClasses = await db
    .select({ id: classes.id, name: classes.name })
    .from(classes)
    .where(isNull(classes.deletedAt));

  const classById = new Map(existingClasses.map((c) => [c.id, c.name]));
  const classByName = new Map(
    existingClasses
      .filter((c) => !isUuidLikeClassValue(c.name))
      .map((c) => [c.name, c.id]),
  );
  const invalidClassIds = new Set(
    existingClasses
      .filter((c) => isUuidLikeClassValue(c.name))
      .map((c) => c.id),
  );

  const studentUsers = await db
    .select({
      user: users,
      className: classes.name,
    })
    .from(users)
    .leftJoin(classes, eq(users.kelasId, classes.id))
    .where(
      and(
        eq(users.role, "student"),
        eq(users.isActive, true),
        isNull(users.deletedAt),
      ),
    );

  const studentUserIds = studentUsers.map((entry) => entry.user.id);
  const latestAttendanceRows =
    studentUserIds.length > 0
      ? await db
          .select({
            studentId: attendance.studentId,
            classId: attendance.classId,
            date: attendance.date,
            updatedAt: attendance.updatedAt,
            createdAt: attendance.createdAt,
          })
          .from(attendance)
          .where(
            and(
              inArray(attendance.studentId, studentUserIds),
              isNull(attendance.deletedAt),
            ),
          )
          .orderBy(
            desc(attendance.date),
            desc(attendance.updatedAt),
            desc(attendance.createdAt),
          )
      : [];
  const latestAttendanceClassByStudent = new Map<string, string>();
  for (const row of latestAttendanceRows) {
    const studentId = row.studentId?.trim();
    const classId = row.classId?.trim();
    if (!studentId || !classId) continue;
    if (!latestAttendanceClassByStudent.has(studentId)) {
      latestAttendanceClassByStudent.set(studentId, classId);
    }
  }

  const existingStudents = await db
    .select()
    .from(students)
    .where(isNull(students.deletedAt));

  const studentMap = new Map(existingStudents.map((s) => [s.nis, s]));
  const studentMapById = new Map(existingStudents.map((s) => [s.id, s]));

  // Deduplicate users by NIS to prevent UNIQUE constraint violations
  const uniqueUsersByNis = new Map<string, (typeof studentUsers)[0]>();
  for (const entry of studentUsers) {
    const nis = entry.user.nis?.trim();
    if (!nis) continue;

    if (!uniqueUsersByNis.has(nis)) {
      uniqueUsersByNis.set(nis, entry);
    } else {
      console.warn(
        `[ProjectionSync] Collision detected: Multiple users sharing NIS ${nis}. User ${entry.user.id} skipped.`,
      );
    }
  }

  let classCreated = 0;
  let studentUpserted = 0;

  const rebindProjectedStudentIdentity = async (
    currentStudentId: string,
    targetStudentId: string,
  ) => {
    if (currentStudentId === targetStudentId) {
      return;
    }

    await db
      .update(attendance)
      .set({
        studentId: targetStudentId,
        updatedAt: now,
        syncStatus: "pending",
      })
      .where(eq(attendance.studentId, currentStudentId));

    await db
      .update(studentDailyAttendance)
      .set({
        studentId: targetStudentId,
        updatedAt: now,
        syncStatus: "pending",
      })
      .where(eq(studentDailyAttendance.studentId, currentStudentId));

    await db
      .update(students)
      .set({
        id: targetStudentId,
        updatedAt: now,
        syncStatus: "pending",
      })
      .where(eq(students.id, currentStudentId));
  };

  // 2. Class creation optimization
  const classCandidates = new Set<string>();
  for (const student of existingStudents) {
    const grade = student.grade.trim();
    if (
      grade &&
      grade !== "UNASSIGNED" &&
      !isUuidLikeClassValue(grade) &&
      !classById.has(grade) &&
      !classByName.has(grade)
    ) {
      classCandidates.add(grade);
    }
  }
  for (const entry of studentUsers) {
    const cr = entry.user.kelasId?.trim();
    const bestName = sanitizeClassDisplayName(
      entry.className,
      cr ? classById.get(cr) : null,
      cr,
    );
    if (bestName !== "UNASSIGNED" && !classByName.has(bestName)) {
      classCandidates.add(bestName);
    }
  }

  for (const candidate of classCandidates) {
    const classId = crypto.randomUUID();
    await db.insert(classes).values({
      id: classId,
      name: candidate,
      academicYear,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      syncStatus: "pending",
    });
    classById.set(classId, candidate);
    classByName.set(candidate, classId);
    classCreated++;
  }

  // 2b. Repair standalone student grade references that still store class UUIDs.
  for (const student of existingStudents) {
    const rawGrade = student.grade?.trim();
    if (!rawGrade || !isUuidLikeClassValue(rawGrade)) {
      continue;
    }

    const resolvedGrade = sanitizeClassDisplayName(classById.get(rawGrade));
    if (resolvedGrade === "UNASSIGNED" || resolvedGrade === rawGrade) {
      continue;
    }

    await db
      .update(students)
      .set({
        grade: resolvedGrade,
        updatedAt: now,
        syncStatus: "pending",
      })
      .where(eq(students.id, student.id));

    const repairedRecord = {
      ...student,
      grade: resolvedGrade,
      updatedAt: now,
      syncStatus: "pending" as const,
    };
    studentMap.set(student.nis, repairedRecord);
    studentMapById.set(student.id, repairedRecord);
    studentUpserted++;
  }

  // 3. Student upsert optimization
  for (const entry of uniqueUsersByNis.values()) {
    const { user, className } = entry;
    const nis = user.nis?.trim() || "";
    if (!nis) continue;
    const existingByNis = studentMap.get(nis);
    const existingById = studentMapById.get(user.id);
    let existingCandidate = existingByNis || existingById;
    const classRef = user.kelasId?.trim();
    const attendanceClassId = latestAttendanceClassByStudent.get(user.id);
    const attendanceClassName = attendanceClassId
      ? classById.get(attendanceClassId)
      : undefined;
    let resolvedClassId: string | null = null;
    const existingRawGrade = existingCandidate?.grade?.trim();
    let grade = sanitizeClassDisplayName(
      existingCandidate?.grade,
      existingRawGrade ? classById.get(existingRawGrade) : null,
    );

    const resolvedUserClassName = sanitizeClassDisplayName(
      className,
      classRef ? classById.get(classRef) : null,
    );

    if (resolvedUserClassName !== "UNASSIGNED") {
      grade = sanitizeClassDisplayName(resolvedUserClassName);
      resolvedClassId =
        classByName.get(resolvedUserClassName) ||
        (classRef && !invalidClassIds.has(classRef) ? classRef : null);
    } else if (classRef && !isUuidLikeClassValue(classRef)) {
      grade = sanitizeClassDisplayName(
        classById.get(classRef),
        classRef,
        classByName.get(classRef),
      );
      resolvedClassId = classById.has(classRef)
        ? classRef
        : classByName.get(grade) || null;
    } else if (
      attendanceClassName &&
      !isUuidLikeClassValue(attendanceClassName)
    ) {
      grade = sanitizeClassDisplayName(attendanceClassName);
      resolvedClassId = attendanceClassId || null;
    } else if (grade !== "UNASSIGNED") {
      resolvedClassId = classByName.get(grade) || null;
    }

    if (resolvedClassId && classRef !== resolvedClassId) {
      await db
        .update(users)
        .set({
          kelasId: resolvedClassId,
          updatedAt: now,
          syncStatus: "pending",
        })
        .where(eq(users.id, user.id));
    }

    const gender = user.jenisKelamin === "P" ? "P" : "L";

    // 1. If a standalone student already exists by NIS but uses a stale ID,
    // rebind that projection row to the authoritative student user ID.
    if (existingByNis && existingByNis.id !== user.id && !existingById) {
      await rebindProjectedStudentIdentity(existingByNis.id, user.id);
      studentMapById.delete(existingByNis.id);
      existingCandidate = {
        ...existingByNis,
        id: user.id,
        updatedAt: now,
        syncStatus: "pending" as const,
      };
      studentMap.set(nis, existingCandidate);
      studentMapById.set(user.id, existingCandidate);
      studentUpserted++;
    }

    // 2. Try finding by NIS (Primary uniqueness for projection)
    let existing = studentMap.get(nis);

    // 3. Fallback check by ID to ensure consistency
    if (!existing) {
      existing = studentMapById.get(user.id);
    }

    const needsUpdate =
      !existing ||
      existing.fullName !== user.fullName ||
      existing.gender !== gender ||
      existing.grade !== grade ||
      existing.nisn !== user.nisn ||
      existing.alamat !== user.alamat ||
      existing.nis !== nis;

    if (needsUpdate) {
      if (!existing) {
        await db.insert(students).values({
          id: user.id,
          nis,
          fullName: user.fullName,
          gender,
          grade,
          nisn: user.nisn,
          tempatLahir: user.tempatLahir,
          tanggalLahir: user.tanggalLahir,
          alamat: user.alamat,
          createdAt: now,
          updatedAt: now,
          syncStatus: "pending",
        });
        // Update local maps
        const newRecord = {
          id: user.id,
          nis,
          fullName: user.fullName,
          gender,
          grade,
        } as (typeof existingStudents)[0];
        studentMap.set(nis, newRecord);
        studentMapById.set(user.id, newRecord);
      } else {
        await db
          .update(students)
          .set({
            nis,
            fullName: user.fullName,
            gender,
            grade,
            nisn: user.nisn,
            tempatLahir: user.tempatLahir,
            tanggalLahir: user.tanggalLahir,
            alamat: user.alamat,
            updatedAt: now,
            syncStatus: "pending",
          })
          .where(eq(students.id, existing.id));
      }
      studentUpserted++;
    }
  }

  const settingsSeeded = await ensureDefaultAttendanceSettings();

  return {
    classCreated,
    studentUpserted,
    settingsSeeded,
  };
}
