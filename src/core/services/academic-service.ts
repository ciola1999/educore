import { and, desc, eq, isNull } from "drizzle-orm";
import { getDatabase } from "../db/connection";
import { classes, subjects, users } from "../db/schema";
import {
  type ClassInsertInput,
  classInsertSchema,
} from "../validation/schemas";

/**
 * Academic Service (2026 Elite Pattern)
 * Managing Classes, Subjects, and Schedules
 */

// --- CLASSES ---

export async function getClasses() {
  try {
    const db = await getDatabase();
    return await db
      .select({
        id: classes.id,
        name: classes.name,
        academicYear: classes.academicYear,
        homeroomTeacherId: classes.homeroomTeacherId,
        homeroomTeacherName: users.fullName,
      })
      .from(classes)
      .leftJoin(users, eq(classes.homeroomTeacherId, users.id))
      .where(isNull(classes.deletedAt))
      .orderBy(desc(classes.createdAt));
  } catch (error) {
    console.error("❌ [AcademicService] getClasses Error:", error);
    return [];
  }
}

export async function addClass(data: ClassInsertInput) {
  try {
    const db = await getDatabase();
    const validated = classInsertSchema.parse(data);

    const id = validated.id || crypto.randomUUID();
    await db.insert(classes).values({
      ...validated,
      id,
      syncStatus: "pending",
      isActive: true,
    });

    return { success: true, id };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Gagal menambah kelas";
    return { success: false, error: msg };
  }
}

export async function updateClass(id: string, data: Partial<ClassInsertInput>) {
  try {
    const db = await getDatabase();
    await db
      .update(classes)
      .set({
        ...data,
        updatedAt: new Date(),
        syncStatus: "pending",
      })
      .where(and(eq(classes.id, id), isNull(classes.deletedAt)));
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Gagal update kelas";
    return { success: false, error: msg };
  }
}

export async function deleteClass(id: string) {
  try {
    const db = await getDatabase();
    await db
      .update(classes)
      .set({
        deletedAt: new Date(),
        syncStatus: "pending",
      })
      .where(eq(classes.id, id));
    return { success: true };
  } catch (error) {
    console.error("❌ [AcademicService] deleteClass Error:", error);
    return { success: false, error: "Failed to delete" };
  }
}

// --- SUBJECTS ---

export async function getSubjects() {
  try {
    const db = await getDatabase();
    return await db
      .select()
      .from(subjects)
      .where(isNull(subjects.deletedAt))
      .orderBy(desc(subjects.createdAt));
  } catch (error) {
    console.error("❌ [AcademicService] getSubjects Error:", error);
    return [];
  }
}
