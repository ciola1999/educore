import { and, asc, count, desc, eq, isNull, like, or } from "drizzle-orm";
import { getDatabase } from "../db/connection";
import { students, users } from "../db/schema";

/**
 * Student Service (2026 Elite Pattern)
 * Optimized for local-first sync and performance
 */

export interface StudentFilter {
  page: number;
  limit: number;
  search?: string;
  sortBy?: "fullName" | "nis" | "grade" | "createdAt";
  sortDir?: "asc" | "desc";
}

export async function getStudents(
  filter: StudentFilter = { page: 1, limit: 10 },
) {
  try {
    const db = await getDatabase();
    const {
      page,
      limit,
      search,
      sortBy = "createdAt",
      sortDir = "desc",
    } = filter;
    const offset = (page - 1) * limit;

    let conditions = isNull(students.deletedAt);

    if (search) {
      const s = `%${search}%`;
      // biome-ignore lint/style/noNonNullAssertion: Drizzle and() with valid args always returns defined
      conditions = and(
        conditions,
        or(
          like(students.fullName, s),
          like(students.nis, s),
          like(students.grade, s),
        ),
      )!;
    }

    // Total count for pagination
    const totalResult = await db
      .select({ value: count() })
      .from(students)
      .where(conditions);
    const totalItems = totalResult[0]?.value || 0;

    // Data query
    const query = db.select().from(students).where(conditions);

    // sorting needs to be careful with typing
    const sortFn = sortDir === "asc" ? asc : desc;
    if (sortBy === "fullName") query.orderBy(sortFn(students.fullName));
    else if (sortBy === "nis") query.orderBy(sortFn(students.nis));
    else if (sortBy === "grade") query.orderBy(sortFn(students.grade));
    else query.orderBy(sortFn(students.createdAt));

    const data = await query.limit(limit).offset(offset);

    return {
      data,
      total: totalItems,
      page,
      totalPages: Math.ceil(totalItems / limit),
    };
  } catch (error) {
    console.error("❌ [StudentService] getStudents Error:", error);
    return { data: [], total: 0, page: 1, totalPages: 0 };
  }
}

/**
 * Soft delete student
 */
export async function deleteStudent(id: string) {
  try {
    const db = await getDatabase();
    const student = await db
      .select({ id: students.id, nis: students.nis })
      .from(students)
      .where(eq(students.id, id))
      .limit(1);

    await db
      .update(students)
      .set({
        deletedAt: new Date(),
        syncStatus: "pending",
        updatedAt: new Date(),
      })
      .where(eq(students.id, id));

    if (student.length > 0) {
      await db
        .update(users)
        .set({
          deletedAt: new Date(),
          isActive: false,
          syncStatus: "pending",
          updatedAt: new Date(),
        })
        .where(eq(users.id, student[0].id));
    }

    return true;
  } catch (error) {
    return false;
  }
}
