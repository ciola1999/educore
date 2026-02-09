import { hashPassword } from "@/lib/auth/hash";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
	type UserInsertInput,
	userInsertSchema,
} from "@/lib/validations/schemas";
import { and, asc, desc, eq, like, or } from "drizzle-orm";

// --- TYPES ---

export type TeacherServiceResult =
  | { success: true; id: string }
  | { success: false; error: string; code?: string };

export interface TeacherFilter {
  search?: string;
  role?: "teacher" | "staff" | "admin";
  sortBy?: "fullName" | "email" | "createdAt";
  sortOrder?: "asc" | "desc";
}

// --- CORE SERVICES ---

/**
 * Get teachers with filtering and sorting capabilities
 */
export async function getTeachers(filter: TeacherFilter = {}) {
  try {
    const db = await getDb();
    const { search, role, sortBy = "fullName", sortOrder = "asc" } = filter;

    // Default: Ambil Teacher & Staff
    let conditions = or(eq(users.role, "teacher"), eq(users.role, "staff"));

    // Override jika role spesifik diminta
    if (role) {
      conditions = eq(users.role, role);
    }

    // Apply Search
    if (search) {
      const searchLower = `%${search}%`;
      conditions = and(
        conditions,
        or(like(users.fullName, searchLower), like(users.email, searchLower)),
      );
    }

    // Build Query
    // Note: Drizzle Query Builder is mutable, but we construct cleanly here
    const query = db.select().from(users).where(conditions!);

    // Apply Sorting
    const sortFn = sortOrder === "desc" ? desc : asc;

    if (sortBy === "fullName") {
      query.orderBy(sortFn(users.fullName));
    } else if (sortBy === "email") {
      query.orderBy(sortFn(users.email));
    } else if (sortBy === "createdAt") {
      query.orderBy(sortFn(users.createdAt));
    }

    return await query;
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
      const errorMessage = validation.error.issues[0]?.message || "Input tidak valid";
      
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
    const passwordHash = validated.password ? await hashPassword(validated.password) : null;

    // 4. Insert
    await db.insert(users).values({
      id: id,
      fullName: validated.fullName,
      email: validated.email,
      role: validated.role || "teacher",
      passwordHash: passwordHash,
      syncStatus: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return { success: true, id };

  } catch (error: any) {
    console.error("[SERVICE_ERROR] addTeacher:", error);

    // Handle SQLite Unique Constraint Error
    if (error?.message?.includes("UNIQUE constraint failed")) {
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

/**
 * Delete a teacher by ID
 */
export async function deleteTeacher(id: string): Promise<boolean> {
  try {
    const db = await getDb();
    await db.delete(users).where(eq(users.id, id));
    return true;
  } catch (error) {
    console.error("[SERVICE_ERROR] deleteTeacher:", error);
    return false;
  }
}