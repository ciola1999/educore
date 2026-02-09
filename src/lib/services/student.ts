// Project\educore\src\lib\services\student.ts

import { asc, count, desc, eq, like, or } from "drizzle-orm";
import { getDb } from "../db";
import { type NewStudent, type Student, students } from "../db/schema";

export type { NewStudent, Student };

export type StudentFilter = {
	page: number;
	limit: number;
	search?: string;
	sortBy?: keyof Student;
	sortDir?: "asc" | "desc";
};

export type StudentResponse = {
	data: Student[];
	total: number;
	page: number;
	totalPages: number;
};

/**
 * Get Students with SQL-based Pagination, Search & Sort
 * ✅ Performance Optimized (60 FPS Safe)
 */
export async function getStudents(
	filter: StudentFilter = { page: 1, limit: 10 },
): Promise<StudentResponse> {
	try {
		const db = await getDb();
		const {
			page,
			limit,
			search,
			sortBy = "createdAt",
			sortDir = "desc",
		} = filter;
		const offset = (page - 1) * limit;

		// 1. Construct Search Condition (Dynamic WHERE)
		const searchCondition = search
			? or(
					like(students.fullName, `%${search}%`),
					like(students.nis, `%${search}%`),
					like(students.grade, `%${search}%`),
				)
			: undefined;

		// 2. Count Total Records (untuk Pagination UI)
		// Query terpisah agar efisien
		const totalResult = await db
			.select({ value: count() })
			.from(students)
			.where(searchCondition);

		const totalItems = totalResult[0]?.value || 0;

		// 3. Get Data (Paginated)
		const data = await db
			.select()
			.from(students)
			.where(searchCondition)
			.orderBy(
				sortDir === "asc"
					? asc(students[sortBy] || students.createdAt)
					: desc(students[sortBy] || students.createdAt),
			)
			.limit(limit)
			.offset(offset);

		return {
			data,
			total: totalItems,
			page,
			totalPages: Math.ceil(totalItems / limit),
		};
	} catch (error) {
		console.error("Error fetching students:", error);
		throw error;
	}
}

// --- CRUD OPERATIONS (Standard) ---

export async function createStudent(data: NewStudent) {
	const db = await getDb();
	// Generate ID jika belum ada (biasanya UUID v7 diurus di frontend atau default)
	const id = data.id || crypto.randomUUID();

	await db.insert(students).values({
		...data,
		id,
		syncStatus: "pending", // Wajib pending agar ke-upload saat online
		updatedAt: new Date(),
	});
	return id;
}

export async function updateStudent(id: string, data: Partial<NewStudent>) {
	const db = await getDb();
	await db
		.update(students)
		.set({ ...data, syncStatus: "pending", updatedAt: new Date() })
		.where(eq(students.id, id));
}

export async function deleteStudent(id: string) {
	const db = await getDb();
	// Soft Delete (Praktik terbaik untuk aplikasi Sync)
	await db
		.update(students)
		.set({
			deletedAt: new Date(),
			syncStatus: "pending",
			updatedAt: new Date(),
		})
		.where(eq(students.id, id));
}

// Helper untuk Dashboard Stats
export async function getStudentStats() {
	const db = await getDb();

	// 1. Query Total
	const totalRes = await db.select({ value: count() }).from(students);

	// 2. Query Laki-laki
	const maleRes = await db
		.select({ value: count() })
		.from(students)
		.where(eq(students.gender, "L"));

	// 3. Query Perempuan
	const femaleRes = await db
		.select({ value: count() })
		.from(students)
		.where(eq(students.gender, "P"));

	return {
		total: totalRes[0]?.value || 0,
		male: maleRes[0]?.value || 0,
		female: femaleRes[0]?.value || 0,
	};
}
