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
  const classByName = new Map(existingClasses.map((c) => [c.name, c.id]));

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
      console.warn(`[ProjectionSync] Collision detected: Multiple users sharing NIS ${nis}. User ${entry.user.id} skipped.`);
    }
  }

  let classCreated = 0;
  let studentUpserted = 0;

  // 2. Class creation optimization
  const classCandidates = new Set<string>();
  for (const student of existingStudents) {
    const grade = student.grade.trim();
    if (grade && grade !== "UNASSIGNED" && !classById.has(grade) && !classByName.has(grade)) {
      classCandidates.add(grade);
    }
  }
  for (const entry of studentUsers) {
    const cr = entry.user.kelasId?.trim();
    // If it's a UUID, we shouldn't add it as a candidate name
    // unless we really don't have a className from the join
    if (cr && !classById.has(cr) && !classByName.has(cr)) {
      const bestName = entry.className || cr;
      if (bestName && !classByName.has(bestName)) {
        classCandidates.add(bestName);
      }
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

  // 3. Student upsert optimization
  for (const entry of uniqueUsersByNis.values()) {
    const { user, className } = entry;
    const nis = user.nis?.trim() || "";
    if (!nis) continue;
    const classRef = user.kelasId?.trim();
    let grade = "UNASSIGNED";

    if (className) {
      grade = className;
    } else if (classRef) {
      grade = classById.get(classRef) ?? classByName.get(classRef) ?? classRef;
    } else if (studentMap.get(nis)?.grade) {
      grade = studentMap.get(nis)?.grade || "UNASSIGNED";
    }

    const gender = user.jenisKelamin === "P" ? "P" : "L";

    // 1. Try finding by NIS (Primary uniqueness for projection)
    let existing = studentMap.get(nis);

    // 2. Fallback check by ID to ensure consistency
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
