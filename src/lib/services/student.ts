import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db";
import { students } from "../db/schema";

// 🛡️ ZOD SCHEMAS (Single Source of Truth for Types)
export const studentSchema = z.object({
	id: z.string().uuid(),
	nis: z.string().min(3, "NIS minimal 3 karakter"),
	fullName: z.string().min(3, "Nama minimal 3 karakter"),
	gender: z.enum(["L", "P"]),
	grade: z.string().min(1, "Kelas wajib diisi"),
	parentName: z.string().nullable().optional(),
	parentPhone: z.string().nullable().optional(),
	createdAt: z.date().nullable().optional(),
	updatedAt: z.date().nullable().optional(),
	deletedAt: z.date().nullable().optional(),
	syncStatus: z.enum(["synced", "pending", "error"]).default("pending"),
});

export const insertStudentSchema = studentSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
	deletedAt: true,
	syncStatus: true,
});

export const studentStatsSchema = z.object({
	total: z.number().default(0),
	male: z.number().default(0),
	female: z.number().default(0),
});

// 🛠️ INFERRED TYPES
export type Student = z.infer<typeof studentSchema>;
export type StudentStats = z.infer<typeof studentStatsSchema>;
export type InsertStudent = z.infer<typeof insertStudentSchema>;

/**
 * Fetch all active students
 */
export async function getStudents(): Promise<Student[]> {
	const db = await getDb();
	const result = await db
		.select()
		.from(students)
		.where(isNull(students.deletedAt))
		.orderBy(desc(students.createdAt));

	// Validate output
	return z.array(studentSchema.partial()).parse(result) as Student[];
}

/**
 * Create a new student
 */
export async function createStudent(data: InsertStudent): Promise<Student> {
	const db = await getDb();

	// Validate input
	const validatedData = insertStudentSchema.parse(data);

	// 🛡️ PRE-CHECK: NIS uniqueness
	const existing = await db
		.select()
		.from(students)
		.where(and(eq(students.nis, validatedData.nis), isNull(students.deletedAt)))
		.limit(1);

	if (existing.length > 0) {
		const error = new Error("NIS_ALREADY_EXISTS");
		(error as any).code = "NIS_ALREADY_EXISTS";
		throw error;
	}

	const studentId = crypto.randomUUID();
	const newStudent = {
		...validatedData,
		id: studentId,
		createdAt: new Date(),
		updatedAt: new Date(),
		syncStatus: "pending" as const,
	};

	await db.insert(students).values(newStudent);

	return { ...newStudent, deletedAt: null } as Student;
}

/**
 * Fetch high-level student statistics
 */
export async function getStudentStats(): Promise<StudentStats> {
	const db = await getDb();

	const result = await db
		.select({
			total: sql<number>`count(*)`,
			male: sql<number>`count(case when gender = 'L' then 1 end)`,
			female: sql<number>`count(case when gender = 'P' then 1 end)`,
		})
		.from(students)
		.where(isNull(students.deletedAt));

	const stats = result[0] || { total: 0, male: 0, female: 0 };

	// Validate output
	return studentStatsSchema.parse(stats);
}
