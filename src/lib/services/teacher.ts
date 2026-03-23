import { and, asc, desc, eq, inArray, isNull, like, or } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/hash";
import { getDb } from "@/lib/db";
import { classes, users } from "@/lib/db/schema";
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

export interface TeacherFilter {
  search?: string;
  role?: "teacher" | "staff" | "admin" | "super_admin";
  sortBy?: "fullName" | "email" | "createdAt";
  sortOrder?: "asc" | "desc";
}

type TeacherUpdateResult =
  | { success: true }
  | { success: false; error: string; code?: string };

// --- CORE SERVICES ---

/**
 * Get teachers with filtering and sorting capabilities
 */
export async function getTeachers(filter: TeacherFilter = {}) {
  try {
    const db = await getDb();
    const { search, role, sortBy = "fullName", sortOrder = "asc" } = filter;

    // Default: User management scope for phase 1
    let conditions = inArray(users.role, [
      "teacher",
      "staff",
      "admin",
      "super_admin",
    ]);

    // Override jika role spesifik diminta
    if (role) {
      conditions = eq(users.role, role);
    }

    // Apply Search
    if (search) {
      const searchLower = `%${search}%`;
      const mergedCondition = and(
        conditions,
        or(like(users.fullName, searchLower), like(users.email, searchLower)),
      );
      if (mergedCondition) {
        conditions = mergedCondition;
      }
    }

    // Build Query
    // Note: Drizzle Query Builder is mutable, but we construct cleanly here
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
      .where(conditions);

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

    // 2. Check for existing email manually
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, validated.email))
      .limit(1);

    if (existingUser.length > 0) {
      return {
        success: false,
        error: "Email ini sudah terdaftar.",
        code: "EMAIL_EXISTS",
      };
    }

    // 3. Prepare data
    const id = validated.id || crypto.randomUUID(); // ✅ Always Generate ID manually for SQLite Proxy
    const passwordHash = await hashPassword(validated.password);

    // 4. Insert
    await db.insert(users).values({
      id: id,
      fullName: validated.fullName,
      email: validated.email,
      role: validated.role || "teacher",
      passwordHash: passwordHash,
      nip: validated.nip ?? null,
      jenisKelamin: validated.jenisKelamin ?? null,
      tempatLahir: validated.tempatLahir ?? null,
      tanggalLahir: validated.tanggalLahir ?? null,
      alamat: validated.alamat ?? null,
      noTelepon: validated.noTelepon ?? null,
      foto: validated.foto ?? null,
      isActive: validated.isActive ?? true,
      syncStatus: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return { success: true, id };
  } catch (error: unknown) {
    console.error("[SERVICE_ERROR] addTeacher:", error);

    // Handle SQLite Unique Constraint Error
    const message = error instanceof Error ? error.message : "";
    if (message.includes("UNIQUE constraint failed")) {
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
      .where(eq(users.id, id))
      .limit(1);
    if (existing.length === 0) {
      return {
        success: false,
        error: "Data user tidak ditemukan",
        code: "NOT_FOUND",
      };
    }

    if (payload.email && payload.email !== existing[0]?.email) {
      const emailExists = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, payload.email))
        .limit(1);
      if (emailExists.length > 0) {
        return {
          success: false,
          error: "Email ini sudah terdaftar.",
          code: "EMAIL_EXISTS",
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
        email: payload.email,
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
export async function deleteTeacher(id: string): Promise<boolean> {
  try {
    const db = await getDb();
    await db
      .update(users)
      .set({
        deletedAt: new Date(),
        isActive: false,
        syncStatus: "pending",
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
    return true;
  } catch (error) {
    console.error("[SERVICE_ERROR] deleteTeacher:", error);
    return false;
  }
}
