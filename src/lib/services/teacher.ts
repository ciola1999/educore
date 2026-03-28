import { and, asc, desc, eq, inArray, isNull, like, or } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/hash";
import { getDb } from "@/lib/db";
import { classes, guruMapel, users } from "@/lib/db/schema";
import {
  findTeacherScheduleUsage,
  hasAnyScheduleUsage,
} from "@/lib/services/schedule-usage";
import {
  type UserInsertInput,
  type UserUpdateInput,
  userInsertSchema,
  userUpdateSchema,
} from "@/lib/validations/schemas";

// --- TYPES ---

export type TeacherServiceResult =
  | { success: true; id: string }
  | { success: false; error: string; code?: string };

export type TeacherListItem = {
  id: string;
  fullName: string;
  email: string;
  role: "teacher" | "staff" | "admin" | "super_admin";
  nip: string | null;
  jenisKelamin: "L" | "P" | null;
  tempatLahir: string | null;
  tanggalLahir: Date | null;
  alamat: string | null;
  noTelepon: string | null;
  isActive: boolean;
  isHomeroomTeacher: boolean;
};

export type TeacherOption = {
  id: string;
  fullName: string;
};

export interface TeacherFilter {
  search?: string;
  role?: "teacher" | "staff" | "admin" | "super_admin";
  sortBy?: "fullName" | "email" | "createdAt";
  sortOrder?: "asc" | "desc";
}

export type TeacherUpdateResult =
  | { success: true }
  | { success: false; error: string; code?: string };

export type TeacherDeleteResult =
  | { success: true }
  | { success: false; error: string; code?: string };

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes("unique constraint failed")
  );
}

// --- CORE SERVICES ---

/**
 * Get teachers with filtering and sorting capabilities
 */
export async function getTeachers(filter: TeacherFilter = {}) {
  try {
    const db = await getDb();
    const { search, role, sortBy = "fullName", sortOrder = "asc" } = filter;

    const conditions = [
      isNull(users.deletedAt),
      role
        ? eq(users.role, role)
        : inArray(users.role, ["teacher", "staff", "admin", "super_admin"]),
    ];

    if (search) {
      const searchLower = `%${search}%`;
      const searchCondition = or(
        like(users.fullName, searchLower),
        like(users.email, searchLower),
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    const query = db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        nip: users.nip,
        jenisKelamin: users.jenisKelamin,
        tempatLahir: users.tempatLahir,
        tanggalLahir: users.tanggalLahir,
        alamat: users.alamat,
        noTelepon: users.noTelepon,
        isActive: users.isActive,
      })
      .from(users)
      .where(and(...conditions));

    // Apply Sorting
    const sortFn = sortOrder === "desc" ? desc : asc;

    if (sortBy === "fullName") {
      query.orderBy(sortFn(users.fullName));
    } else if (sortBy === "email") {
      query.orderBy(sortFn(users.email));
    } else if (sortBy === "createdAt") {
      query.orderBy(sortFn(users.createdAt));
    }

    const rows = await query;
    const teacherIds = rows.map((row) => row.id);
    if (teacherIds.length === 0) {
      return [];
    }

    const homeroomRows = await db
      .select({ homeroomTeacherId: classes.homeroomTeacherId })
      .from(classes)
      .where(
        and(
          isNull(classes.deletedAt),
          inArray(classes.homeroomTeacherId, teacherIds),
        ),
      );
    const homeroomSet = new Set(
      homeroomRows
        .map((row) => row.homeroomTeacherId)
        .filter((id): id is string => typeof id === "string"),
    );

    return rows.map((row) => ({
      ...row,
      role: row.role as "teacher" | "staff" | "admin" | "super_admin",
      jenisKelamin: (row.jenisKelamin ?? null) as "L" | "P" | null,
      isHomeroomTeacher: homeroomSet.has(row.id),
    })) satisfies TeacherListItem[];
  } catch (error) {
    console.error("[SERVICE_ERROR] getTeachers:", error);
    return [];
  }
}

/**
 * Add a new teacher to the database
 */
export async function addTeacher(
  data: UserInsertInput,
): Promise<TeacherServiceResult> {
  try {
    const db = await getDb();

    // 1. Validate data with Zod (Fail Fast)
    const validation = userInsertSchema.safeParse(data);

    if (!validation.success) {
      // ✅ FIX: Menggunakan Template Literal & 'issues' (bukan errors) agar Type-Safe
      const errorMessage =
        validation.error.issues[0]?.message || "Input tidak valid";

      return {
        success: false,
        error: `Data tidak valid: ${errorMessage}`,
        code: "VALIDATION_ERROR",
      };
    }

    const validated = validation.data;
    const normalizedEmail = validated.email.trim().toLowerCase();

    const existingUser = await db
      .select({
        id: users.id,
        deletedAt: users.deletedAt,
        role: users.role,
      })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingUser[0]?.deletedAt === null) {
      return {
        success: false,
        error: "Email ini sudah terdaftar.",
        code: "EMAIL_EXISTS",
      };
    }

    if (
      existingUser[0]?.role === "student" ||
      existingUser[0]?.role === "parent"
    ) {
      return {
        success: false,
        error: `Email ini sudah dipakai data role ${existingUser[0].role}.`,
        code: "EMAIL_EXISTS",
      };
    }

    const passwordHash = await hashPassword(validated.password);
    const now = new Date();

    if (existingUser[0]) {
      const id = existingUser[0].id;
      await db
        .update(users)
        .set({
          fullName: validated.fullName,
          email: normalizedEmail,
          role: validated.role || "teacher",
          passwordHash,
          nip: validated.nip ?? null,
          jenisKelamin: validated.jenisKelamin ?? null,
          tempatLahir: validated.tempatLahir ?? null,
          tanggalLahir: validated.tanggalLahir ?? null,
          alamat: validated.alamat ?? null,
          noTelepon: validated.noTelepon ?? null,
          foto: validated.foto ?? null,
          isActive: validated.isActive ?? true,
          deletedAt: null,
          syncStatus: "pending",
          updatedAt: now,
        })
        .where(eq(users.id, id));

      return { success: true, id };
    }

    const id = validated.id || crypto.randomUUID();
    await db.insert(users).values({
      id,
      fullName: validated.fullName,
      email: normalizedEmail,
      role: validated.role || "teacher",
      passwordHash,
      nip: validated.nip ?? null,
      jenisKelamin: validated.jenisKelamin ?? null,
      tempatLahir: validated.tempatLahir ?? null,
      tanggalLahir: validated.tanggalLahir ?? null,
      alamat: validated.alamat ?? null,
      noTelepon: validated.noTelepon ?? null,
      foto: validated.foto ?? null,
      isActive: validated.isActive ?? true,
      syncStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, id };
  } catch (error: unknown) {
    console.error("[SERVICE_ERROR] addTeacher:", error);

    if (isUniqueConstraintError(error)) {
      return {
        success: false,
        error: "Email sudah digunakan oleh user lain.",
        code: "EMAIL_EXISTS",
      };
    }

    return {
      success: false,
      error: "Gagal menyimpan data guru. Kesalahan sistem.",
      code: "INTERNAL_ERROR",
    };
  }
}

export async function updateTeacher(
  id: string,
  data: UserUpdateInput,
): Promise<TeacherUpdateResult> {
  try {
    const db = await getDb();
    const validation = userUpdateSchema.safeParse(data);
    if (!validation.success) {
      const errorMessage =
        validation.error.issues[0]?.message || "Input tidak valid";
      return {
        success: false,
        error: `Data tidak valid: ${errorMessage}`,
        code: "VALIDATION_ERROR",
      };
    }

    const payload = validation.data;
    const existing = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);
    if (existing.length === 0) {
      return {
        success: false,
        error: "Data user tidak ditemukan",
        code: "NOT_FOUND",
      };
    }

    if (payload.email && payload.email !== existing[0]?.email) {
      const normalizedEmail = payload.email.trim().toLowerCase();
      const emailExists = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);
      if (emailExists.length > 0) {
        return {
          success: false,
          error: "Email ini sudah terdaftar.",
          code: "EMAIL_EXISTS",
        };
      }
    }

    if (payload.role && payload.role !== "teacher") {
      const [hasTeachingAssignments, scheduleUsage] = await Promise.all([
        db
          .select({ id: guruMapel.id })
          .from(guruMapel)
          .where(and(eq(guruMapel.guruId, id), isNull(guruMapel.deletedAt)))
          .limit(1),
        findTeacherScheduleUsage(id),
      ]);

      if (
        hasTeachingAssignments.length > 0 ||
        hasAnyScheduleUsage(scheduleUsage)
      ) {
        return {
          success: false,
          error:
            "Guru masih dipakai assignment atau jadwal. Lepaskan relasi tersebut terlebih dahulu sebelum mengubah role.",
          code: "TEACHER_IN_USE",
        };
      }
    }

    const passwordHash = payload.password
      ? await hashPassword(payload.password)
      : undefined;

    await db
      .update(users)
      .set({
        fullName: payload.fullName,
        email: payload.email?.trim().toLowerCase(),
        role: payload.role,
        passwordHash,
        nip: payload.nip ?? undefined,
        jenisKelamin: payload.jenisKelamin ?? undefined,
        tempatLahir: payload.tempatLahir ?? undefined,
        tanggalLahir: payload.tanggalLahir ?? undefined,
        alamat: payload.alamat ?? undefined,
        noTelepon: payload.noTelepon ?? undefined,
        foto: payload.foto ?? undefined,
        isActive: payload.isActive,
        syncStatus: "pending",
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));

    if (payload.role && payload.role !== "teacher") {
      await db
        .update(classes)
        .set({
          homeroomTeacherId: null,
          syncStatus: "pending",
          updatedAt: new Date(),
        })
        .where(
          and(eq(classes.homeroomTeacherId, id), isNull(classes.deletedAt)),
        );
    }

    return { success: true };
  } catch (error: unknown) {
    console.error("[SERVICE_ERROR] updateTeacher:", error);
    return {
      success: false,
      error: "Gagal memperbarui data guru. Kesalahan sistem.",
      code: "INTERNAL_ERROR",
    };
  }
}

/**
 * Delete a teacher by ID
 */
export async function deleteTeacher(id: string): Promise<TeacherDeleteResult> {
  try {
    const db = await getDb();
    const existingTeacher = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);

    if (existingTeacher.length === 0) {
      return {
        success: false,
        error: "Data guru tidak ditemukan",
        code: "NOT_FOUND",
      };
    }

    const [teachingAssignments, scheduleUsage] = await Promise.all([
      db
        .select({ id: guruMapel.id })
        .from(guruMapel)
        .where(and(eq(guruMapel.guruId, id), isNull(guruMapel.deletedAt)))
        .limit(1),
      findTeacherScheduleUsage(id),
    ]);

    if (teachingAssignments.length > 0 || hasAnyScheduleUsage(scheduleUsage)) {
      return {
        success: false,
        error:
          "Guru masih dipakai assignment atau jadwal. Lepaskan relasi tersebut terlebih dahulu sebelum menghapus guru.",
        code: "TEACHER_IN_USE",
      };
    }

    await db
      .update(classes)
      .set({
        homeroomTeacherId: null,
        syncStatus: "pending",
        updatedAt: new Date(),
      })
      .where(and(eq(classes.homeroomTeacherId, id), isNull(classes.deletedAt)));

    await db
      .update(users)
      .set({
        deletedAt: new Date(),
        isActive: false,
        syncStatus: "pending",
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));

    return { success: true };
  } catch (error) {
    console.error("[SERVICE_ERROR] deleteTeacher:", error);
    return {
      success: false,
      error: "Gagal menghapus guru. Kesalahan sistem.",
      code: "INTERNAL_ERROR",
    };
  }
}

export async function getTeacherOptions(): Promise<TeacherOption[]> {
  const db = await getDb();
  return db
    .select({
      id: users.id,
      fullName: users.fullName,
    })
    .from(users)
    .where(
      and(
        eq(users.role, "teacher"),
        eq(users.isActive, true),
        isNull(users.deletedAt),
      ),
    )
    .orderBy(asc(users.fullName));
}
