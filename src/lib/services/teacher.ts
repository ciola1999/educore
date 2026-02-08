import {
	type UserInsertInput,
	userInsertSchema,
} from "@/lib/validations/schemas";
import { and, desc, eq, like, or } from "drizzle-orm";
import { hashPassword } from "../auth/hash";
import { getDb } from "../db";
import { users } from "../db/schema";

export type TeacherServiceResult =
	| { success: true; id: string }
	| { success: false; error: string; code?: string };

export interface TeacherFilter {
	search?: string;
	role?: "teacher" | "staff" | "admin";
	sortBy?: "fullName" | "email" | "createdAt";
	sortOrder?: "asc" | "desc";
}

/**
 * Get teachers with filtering and sorting
 */
export async function getTeachers(filter: TeacherFilter = {}) {
	try {
		const db = await getDb();
		const { search, role, sortBy = "fullName", sortOrder = "asc" } = filter;

		let conditions = or(eq(users.role, "teacher"), eq(users.role, "staff"));

		if (role) {
			conditions = eq(users.role, role);
		}

		if (search) {
			conditions = and(
				conditions,
				or(
					like(users.fullName, `%${search}%`),
					like(users.email, `%${search}%`),
				),
			);
		}

		const query = db.select().from(users).where(conditions);

		// Handle sorting
		if (sortBy === "fullName") {
			query.orderBy(
				sortOrder === "desc" ? desc(users.fullName) : users.fullName,
			);
		} else if (sortBy === "email") {
			query.orderBy(sortOrder === "desc" ? desc(users.email) : users.email);
		} else if (sortBy === "createdAt") {
			query.orderBy(
				sortOrder === "desc" ? desc(users.createdAt) : users.createdAt,
			);
		}

		return await query;
	} catch (error) {
		console.error("Failed to fetch teachers:", error);
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
		// 1. Validate data with Zod
		const validated = userInsertSchema.parse(data);

		const db = await getDb();

		// 2. Check for existing email (SQLite unique constraint will catch this, but we check explicitly for better error messages)
		const existingUser = await db
			.select()
			.from(users)
			.where(eq(users.email, validated.email))
			.limit(1);

		if (existingUser.length > 0) {
			return {
				success: false,
				error: "Email ini sudah terdaftar. Silakan gunakan email lain.",
				code: "EMAIL_EXISTS",
			};
		}

		// 3. Prepare data for insertion
		const id = validated.id || crypto.randomUUID();
		const passwordHash = validated.passwordHash
			? await hashPassword(validated.passwordHash)
			: null;

		await db.insert(users).values({
			...validated,
			id,
			passwordHash,
			role: validated.role || "teacher",
			syncStatus: "pending",
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		return { success: true, id };
	} catch (error: unknown) {
		console.error("Add teacher service error:", error);

		if (error instanceof Error && error.name === "ZodError") {
			return {
				success: false,
				error: "Data tidak valid. Periksa kembali input Anda.",
			};
		}

		if (
			error instanceof Error &&
			error.message?.includes("UNIQUE constraint failed")
		) {
			return {
				success: false,
				error: "Email ini sudah terdaftar. Silakan gunakan email lain.",
				code: "EMAIL_EXISTS",
			};
		}

		return {
			success: false,
			error: "Gagal menyimpan data guru. Silakan coba lagi.",
		};
	}
}

/**
 * Delete a teacher
 */
export async function deleteTeacher(id: string): Promise<boolean> {
	try {
		const db = await getDb();
		await db.delete(users).where(eq(users.id, id));
		return true;
	} catch (error) {
		console.error("Failed to delete teacher:", error);
		return false;
	}
}
