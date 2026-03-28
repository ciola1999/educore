import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { requireRole } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import { hashPassword } from "@/lib/auth/hash";
import { auth } from "@/lib/auth/web/auth";
import { getDb } from "@/lib/db";
import { classes, students, users } from "@/lib/db/schema";
import {
  isUuidLikeClassValue,
  sanitizeClassDisplayName,
} from "@/lib/utils/class-name";

const createStudentAccountSchema = z.object({
  email: z.string().email("Email akun siswa tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
});

function getAcademicYearLabel(): string {
  const year = new Date().getFullYear();
  return `${year}/${year + 1}`;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const guard = requireRole(session, ["admin", "super_admin"]);
  if (guard) {
    return guard;
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Payload tidak valid", 400, "INVALID_PAYLOAD");
  }

  const validation = createStudentAccountSchema.safeParse(body);
  if (!validation.success) {
    return apiError(
      validation.error.issues[0]?.message || "Data akun siswa tidak valid",
      400,
      "VALIDATION_ERROR",
    );
  }

  const db = await getDb();
  const studentRows = await db
    .select({
      id: students.id,
      nis: students.nis,
      nisn: students.nisn,
      fullName: students.fullName,
      gender: students.gender,
      grade: students.grade,
      tempatLahir: students.tempatLahir,
      tanggalLahir: students.tanggalLahir,
      alamat: students.alamat,
    })
    .from(students)
    .where(and(eq(students.id, id), isNull(students.deletedAt)))
    .limit(1);

  if (studentRows.length === 0) {
    return apiError("Data siswa tidak ditemukan", 404, "STUDENT_NOT_FOUND");
  }

  const student = studentRows[0];
  const normalizedEmail = validation.data.email.trim().toLowerCase();

  const existingUserByEmail = await db
    .select({ id: users.id, deletedAt: users.deletedAt })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (
    existingUserByEmail[0] &&
    (existingUserByEmail[0].deletedAt === null ||
      existingUserByEmail[0].id !== id)
  ) {
    return apiError("Email akun siswa sudah terdaftar", 409, "EMAIL_EXISTS");
  }

  const passwordHash = await hashPassword(validation.data.password);
  const existingById = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  const rawGrade = student.grade?.trim() || "";
  let gradeName = sanitizeClassDisplayName(rawGrade);
  if (isUuidLikeClassValue(rawGrade)) {
    const classById = await db
      .select({ name: classes.name })
      .from(classes)
      .where(and(eq(classes.id, rawGrade), isNull(classes.deletedAt)))
      .limit(1);
    gradeName = sanitizeClassDisplayName(classById[0]?.name, rawGrade);
  }
  let kelasId: string | null = null;
  if (
    gradeName &&
    gradeName !== "UNASSIGNED" &&
    !isUuidLikeClassValue(gradeName)
  ) {
    const classRows = await db
      .select({ id: classes.id })
      .from(classes)
      .where(and(eq(classes.name, gradeName), isNull(classes.deletedAt)))
      .limit(1);

    if (classRows.length > 0) {
      kelasId = classRows[0]?.id ?? null;
    } else {
      kelasId = crypto.randomUUID();
      await db.insert(classes).values({
        id: kelasId,
        name: gradeName,
        academicYear: getAcademicYearLabel(),
        isActive: true,
        syncStatus: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  if (
    existingById.length > 0 &&
    existingById[0]?.role &&
    existingById[0].role !== "student"
  ) {
    return apiError(
      "ID siswa sudah dipakai akun non-student",
      409,
      "ID_ROLE_CONFLICT",
    );
  }

  const now = new Date();
  if (existingById.length > 0) {
    await db
      .update(users)
      .set({
        fullName: student.fullName,
        email: normalizedEmail,
        role: "student",
        passwordHash,
        nis: student.nis,
        nisn: student.nisn,
        tempatLahir: student.tempatLahir,
        tanggalLahir: student.tanggalLahir,
        jenisKelamin: student.gender,
        alamat: student.alamat,
        kelasId,
        isActive: true,
        deletedAt: null,
        syncStatus: "pending",
        updatedAt: now,
      })
      .where(eq(users.id, id));
  } else {
    await db.insert(users).values({
      id,
      fullName: student.fullName,
      email: normalizedEmail,
      role: "student",
      passwordHash,
      nis: student.nis,
      nisn: student.nisn,
      tempatLahir: student.tempatLahir,
      tanggalLahir: student.tanggalLahir,
      jenisKelamin: student.gender,
      alamat: student.alamat,
      kelasId,
      isActive: true,
      syncStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });
  }

  return apiOk({ accountCreated: true });
}
