import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { requireRole } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";
import { getDb } from "@/lib/db";
import { classes, students, users } from "@/lib/db/schema";
import {
  isUuidLikeClassValue,
  sanitizeClassDisplayName,
} from "@/lib/utils/class-name";

const repairStudentClassesSchema = z.object({
  studentIds: z.array(z.string().uuid()).optional(),
  sourceToken: z.string().trim().optional(),
  className: z.string().trim().min(1, "Kelas tujuan wajib diisi"),
});

function getAcademicYearLabel(): string {
  const year = new Date().getFullYear();
  return `${year}/${year + 1}`;
}

export async function POST(request: Request) {
  const session = await auth();
  const guard = requireRole(session, ["admin", "super_admin"]);
  if (guard) {
    return guard;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Payload tidak valid", 400, "INVALID_PAYLOAD");
  }

  const validation = repairStudentClassesSchema.safeParse(body);
  if (!validation.success) {
    return apiError(
      validation.error.issues[0]?.message || "Data repair kelas tidak valid",
      400,
      "VALIDATION_ERROR",
    );
  }

  const targetClassName = sanitizeClassDisplayName(validation.data.className);
  if (
    targetClassName === "UNASSIGNED" ||
    isUuidLikeClassValue(targetClassName)
  ) {
    return apiError("Nama kelas tujuan tidak valid", 400, "INVALID_CLASS_NAME");
  }

  const db = await getDb();
  const requestedIds = validation.data.studentIds ?? [];
  const sourceToken = validation.data.sourceToken?.trim() || null;
  const targetStudents =
    requestedIds.length > 0
      ? await db
          .select({ id: students.id })
          .from(students)
          .where(
            and(inArray(students.id, requestedIds), isNull(students.deletedAt)),
          )
      : await db
          .select({ id: students.id })
          .from(students)
          .where(isNull(students.deletedAt));

  if (targetStudents.length === 0) {
    return apiError("Data siswa tidak ditemukan", 404, "STUDENT_NOT_FOUND");
  }

  const studentIds = targetStudents.map((student) => student.id);
  const targetRows = await db
    .select({
      id: students.id,
      grade: students.grade,
      kelasId: users.kelasId,
    })
    .from(students)
    .leftJoin(users, and(eq(users.id, students.id), isNull(users.deletedAt)))
    .where(inArray(students.id, studentIds));
  const legacyStudentIds = targetRows
    .filter(
      (student) =>
        isUuidLikeClassValue(student.grade) ||
        student.grade === "UNASSIGNED" ||
        isUuidLikeClassValue(student.kelasId),
    )
    .map((student) => student.id);

  const filteredLegacyStudentIds =
    sourceToken === null
      ? legacyStudentIds
      : (
          await db
            .select({
              id: students.id,
              grade: students.grade,
              kelasId: users.kelasId,
            })
            .from(students)
            .leftJoin(
              users,
              and(eq(users.id, students.id), isNull(users.deletedAt)),
            )
            .where(inArray(students.id, legacyStudentIds))
        )
          .filter((row) => {
            const token = isUuidLikeClassValue(row.kelasId)
              ? row.kelasId?.trim()
              : isUuidLikeClassValue(row.grade)
                ? row.grade.trim()
                : row.grade === "UNASSIGNED"
                  ? "UNASSIGNED"
                  : null;
            return token === sourceToken;
          })
          .map((row) => row.id);

  if (filteredLegacyStudentIds.length === 0) {
    return apiOk({
      updated: 0,
      className: targetClassName,
    });
  }

  const now = new Date();
  const classRows = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.name, targetClassName), isNull(classes.deletedAt)))
    .limit(1);

  let kelasId = classRows[0]?.id ?? null;
  if (!kelasId) {
    kelasId = crypto.randomUUID();
    await db.insert(classes).values({
      id: kelasId,
      name: targetClassName,
      academicYear: getAcademicYearLabel(),
      isActive: true,
      syncStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });
  }

  await db
    .update(students)
    .set({
      grade: targetClassName,
      syncStatus: "pending",
      updatedAt: now,
    })
    .where(inArray(students.id, filteredLegacyStudentIds));

  await db
    .update(users)
    .set({
      kelasId,
      syncStatus: "pending",
      updatedAt: now,
    })
    .where(
      and(
        inArray(users.id, filteredLegacyStudentIds),
        eq(users.role, "student"),
        isNull(users.deletedAt),
      ),
    );

  return apiOk({
    updated: filteredLegacyStudentIds.length,
    className: targetClassName,
  });
}
