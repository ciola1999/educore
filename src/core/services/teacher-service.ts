import { and, asc, desc, eq, isNull, like, or } from "drizzle-orm";
import { getDatabase } from "../db/connection";
import { users } from "../db/schema";
import { type UserInsertInput, userInsertSchema } from "../validation/schemas";

/**
 * Teacher & Staff Service (2026 Elite Pattern)
 * Uses soft deletes and explicit database abstraction
 */

export interface TeacherFilter {
  search?: string;
  role?: "teacher" | "staff" | "admin";
  sortBy?: "fullName" | "email" | "createdAt";
  sortOrder?: "asc" | "desc";
}

/**
 * Get teachers/staff with filtering
 */
export async function getTeachers(filter: TeacherFilter = {}) {
  try {
    const db = await getDatabase();
    const { search, role, sortBy = "fullName", sortOrder = "asc" } = filter;

    // Core condition: Not deleted
    let conditions = isNull(users.deletedAt);

    // Role filter
    if (role) {
      const roleCondition = eq(users.role, role);
      conditions = and(conditions, roleCondition)!;
    } else {
      const defaultRoles = or(
        eq(users.role, "teacher"),
        eq(users.role, "staff"),
      );
      conditions = and(conditions, defaultRoles)!;
    }

    // Search filter
    if (search) {
      const s = `%${search}%`;
      const searchCondition = or(like(users.fullName, s), like(users.email, s));
      conditions = and(conditions, searchCondition)!;
    }

    const query = db.select().from(users).where(conditions);

    const sortFn = sortOrder === "desc" ? desc : asc;
    if (sortBy === "email") query.orderBy(sortFn(users.email));
    else if (sortBy === "createdAt") query.orderBy(sortFn(users.createdAt));
    else query.orderBy(sortFn(users.fullName));

    return await query;
  } catch (error) {
    console.error("❌ [TeacherService] getTeachers Error:", error);
    return [];
  }
}

/**
 * Logic-rich Add Teacher
 */
export async function addTeacher(data: UserInsertInput) {
  try {
    const db = await getDatabase();

    // 1. Validation
    const validated = userInsertSchema.parse(data);

    // 2. Check existence (not deleted)
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, validated.email), isNull(users.deletedAt)))
      .limit(1);

    if (existing.length > 0) {
      return { success: false, error: "Email already registered" };
    }

    // 3. Insert with 2026 Metadata
    const id = validated.id || crypto.randomUUID();
    await db.insert(users).values({
      ...validated,
      id,
      syncStatus: "pending",
    });

    return { success: true, id };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Kesalahan sistem";
    return { success: false, error: msg };
  }
}

/**
 * Soft Delete Implementation
 */
export async function deleteTeacher(id: string) {
  try {
    const db = await getDatabase();
    await db
      .update(users)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
        syncStatus: "pending",
      })
      .where(eq(users.id, id));
    return true;
  } catch (error) {
    console.error("❌ [TeacherService] deleteTeacher Error:", error);
    return false;
  }
}
