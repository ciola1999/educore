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
import { studentUpdateSchema } from "@/lib/validations/schemas";

const studentUpdateRequestSchema = studentUpdateSchema.extend({
  account: z
    .object({
      email: z.string().email("Email akun tidak valid").optional(),
      password: z.string().min(8, "Password minimal 8 karakter").optional(),
      confirmPassword: z
        .string()
        .min(8, "Konfirmasi password minimal 8 karakter")
        .optional(),
    })
    .optional(),
});

type StudentUpdatePayload = ReturnType<typeof studentUpdateRequestSchema.parse>;

function normalizeStudentPayload(payload: StudentUpdatePayload) {
  const normalizedGrade = sanitizeClassDisplayName(payload.grade);
  return {
    nis: payload.nis?.trim(),
    nisn: payload.nisn?.trim() || null,
    fullName: payload.fullName?.trim(),
    gender: payload.gender,
    grade: normalizedGrade,
    parentName: payload.parentName?.trim() || null,
    parentPhone: payload.parentPhone?.trim() || null,
    tempatLahir: payload.tempatLahir?.trim() || null,
    tanggalLahir: payload.tanggalLahir ?? null,
    alamat: payload.alamat?.trim() || null,
  };
}

function getAcademicYearLabel(): string {
  const year = new Date().getFullYear();
  return `${year}/${year + 1}`;
}

export async function PATCH(
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

  const validation = studentUpdateRequestSchema.safeParse(body);
  if (!validation.success) {
    return apiError(
      validation.error.issues[0]?.message || "Data siswa tidak valid",
      400,
      "VALIDATION_ERROR",
    );
  }

  const db = await getDb();

  const existingStudent = await db
    .select({ id: students.id, nis: students.nis })
    .from(students)
    .where(and(eq(students.id, id), isNull(students.deletedAt)))
    .limit(1);

  if (existingStudent.length === 0) {
    return apiError("Data siswa tidak ditemukan", 404, "NOT_FOUND");
  }

  const payload = normalizeStudentPayload(validation.data);
  const normalizedNis = payload.nis || existingStudent[0]?.nis;

  if (!normalizedNis) {
    return apiError("NIS wajib diisi", 400, "VALIDATION_ERROR");
  }

  const duplicateNis = await db
    .select({ id: students.id })
    .from(students)
    .where(eq(students.nis, normalizedNis))
    .limit(1);

  if (duplicateNis.length > 0 && duplicateNis[0]?.id !== id) {
    return apiError("NIS sudah terdaftar", 409, "NIS_EXISTS");
  }

  const now = new Date();
  await db
    .update(students)
    .set({
      nis: normalizedNis,
      nisn: payload.nisn ?? undefined,
      fullName: payload.fullName ?? undefined,
      gender: payload.gender ?? undefined,
      grade: payload.grade ?? undefined,
      parentName: payload.parentName ?? undefined,
      parentPhone: payload.parentPhone ?? undefined,
      tempatLahir: payload.tempatLahir ?? undefined,
      tanggalLahir: payload.tanggalLahir ?? undefined,
      alamat: payload.alamat ?? undefined,
      syncStatus: "pending",
      updatedAt: now,
    })
    .where(eq(students.id, id));

  let kelasId: string | null | undefined;
  if (payload.grade && payload.grade !== "UNASSIGNED") {
    const existingClass = await db
      .select({ id: classes.id })
      .from(classes)
      .where(and(eq(classes.name, payload.grade), isNull(classes.deletedAt)))
      .limit(1);

    if (existingClass.length > 0) {
      kelasId = existingClass[0]?.id ?? null;
    } else if (!isUuidLikeClassValue(payload.grade)) {
      kelasId = crypto.randomUUID();
      await db.insert(classes).values({
        id: kelasId,
        name: payload.grade,
        academicYear: getAcademicYearLabel(),
        isActive: true,
        syncStatus: "pending",
        createdAt: now,
        updatedAt: now,
      });
    } else {
      kelasId = null;
    }
  } else {
    kelasId = null;
  }

  await db
    .update(users)
    .set({
      fullName: payload.fullName ?? undefined,
      nis: normalizedNis,
      nisn: payload.nisn ?? undefined,
      tempatLahir: payload.tempatLahir ?? undefined,
      tanggalLahir: payload.tanggalLahir ?? undefined,
      jenisKelamin: payload.gender ?? undefined,
      alamat: payload.alamat ?? undefined,
      kelasId,
      syncStatus: "pending",
      updatedAt: now,
    })
    .where(
      and(eq(users.id, id), eq(users.role, "student"), isNull(users.deletedAt)),
    );

  if (validation.data.account) {
    const account = validation.data.account;
    const normalizedEmail = account.email?.trim().toLowerCase();
    const hasPasswordInput = Boolean(
      account.password || account.confirmPassword,
    );

    if (hasPasswordInput && account.password !== account.confirmPassword) {
      return apiError(
        "Konfirmasi password akun siswa tidak cocok",
        400,
        "VALIDATION_ERROR",
      );
    }

    if (normalizedEmail) {
      const duplicateEmail = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      if (duplicateEmail.length > 0 && duplicateEmail[0]?.id !== id) {
        return apiError(
          "Email akun siswa sudah terdaftar",
          409,
          "EMAIL_EXISTS",
        );
      }
    }

    await db
      .update(users)
      .set({
        email: normalizedEmail || undefined,
        passwordHash: account.password
          ? await hashPassword(account.password)
          : undefined,
        syncStatus: "pending",
        updatedAt: now,
      })
      .where(
        and(
          eq(users.id, id),
          eq(users.role, "student"),
          isNull(users.deletedAt),
        ),
      );
  }

  return apiOk({ updated: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const guard = requireRole(session, ["admin", "super_admin"]);
  if (guard) {
    return guard;
  }

  const { id } = await context.params;
  const db = await getDb();

  const existingStudent = await db
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.id, id), isNull(students.deletedAt)))
    .limit(1);

  if (existingStudent.length === 0) {
    return apiError("Data siswa tidak ditemukan", 404, "NOT_FOUND");
  }

  await db
    .update(students)
    .set({
      deletedAt: new Date(),
      syncStatus: "pending",
      updatedAt: new Date(),
    })
    .where(eq(students.id, id));

  await db
    .update(users)
    .set({
      deletedAt: new Date(),
      isActive: false,
      syncStatus: "pending",
      updatedAt: new Date(),
    })
    .where(
      and(eq(users.id, id), eq(users.role, "student"), isNull(users.deletedAt)),
    );

  return apiOk({ deleted: true });
}
