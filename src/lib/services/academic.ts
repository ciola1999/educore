import { desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { classes, subjects, users } from "../db/schema";

// --- CLASSES ---

export async function getClasses() {
	const db = await getDb();

	return (
		db
			.select({
				id: classes.id,
				name: classes.name,
				academicYear: classes.academicYear,
				homeroomTeacherId: classes.homeroomTeacherId,
				homeroomTeacherName: users.fullName,
			})
			.from(classes)
			.leftJoin(users, eq(classes.homeroomTeacherId, users.id))
			// FIX: Gunakan camelCase (deletedAt)
			.where(isNull(classes.deletedAt))
			// FIX: Gunakan camelCase (createdAt)
			.orderBy(desc(classes.createdAt))
	);
}

export async function addClass(data: {
	name: string;
	academicYear: string;
	homeroomTeacherId?: string;
}) {
	const db = await getDb();

	await db.insert(classes).values({
		id: crypto.randomUUID(),
		name: data.name,
		academicYear: data.academicYear,
		homeroomTeacherId: data.homeroomTeacherId || null,

		// FIX: Gunakan camelCase & new Date()
		createdAt: new Date(),
		updatedAt: new Date(),
		// Cek schema Anda: jika di schema tertulis 'syncStatus', pakai itu.
		// Jika masih merah, ganti jadi 'sync_status'
		syncStatus: "pending",
	});

	return { success: true };
}

export async function updateClass(
	id: string,
	data: { name: string; academicYear: string; homeroomTeacherId?: string },
) {
	const db = await getDb();

	await db
		.update(classes)
		.set({
			name: data.name,
			academicYear: data.academicYear,
			homeroomTeacherId: data.homeroomTeacherId || null,

			// FIX: Update timestamp
			updatedAt: new Date(),
			syncStatus: "pending",
		})
		.where(eq(classes.id, id));

	return { success: true };
}

export async function deleteClass(id: string) {
	const db = await getDb();

	// FIX: Soft Delete dengan deletedAt (camelCase)
	await db
		.update(classes)
		.set({
			deletedAt: new Date(),
			syncStatus: "pending",
		})
		.where(eq(classes.id, id));

	return { success: true };
}

// --- SUBJECTS ---

export async function getSubjects() {
	const db = await getDb();
	return db
		.select()
		.from(subjects)
		.where(isNull(subjects.deletedAt)) // FIX: camelCase
		.orderBy(desc(subjects.createdAt)); // FIX: camelCase
}

export async function addSubject(data: { name: string; code: string }) {
	const db = await getDb();

	await db.insert(subjects).values({
		id: crypto.randomUUID(),
		name: data.name,
		code: data.code,

		// FIX: camelCase & Date object
		createdAt: new Date(),
		updatedAt: new Date(),
		syncStatus: "pending",
	});

	return { success: true };
}

export async function updateSubject(
	id: string,
	data: { name: string; code: string },
) {
	const db = await getDb();

	await db
		.update(subjects)
		.set({
			name: data.name,
			code: data.code,
			updatedAt: new Date(),
			syncStatus: "pending",
		})
		.where(eq(subjects.id, id));

	return { success: true };
}

export async function deleteSubject(id: string) {
	const db = await getDb();

	// FIX: Soft Delete subjects
	await db
		.update(subjects)
		.set({
			deletedAt: new Date(),
			syncStatus: "pending",
		})
		.where(eq(subjects.id, id));

	return { success: true };
}
