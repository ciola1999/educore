import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { classes, subjects, users } from "../db/schema";

// --- CLASSES ---

export async function getClasses() {
	const db = await getDb();
	// Join with Homeroom Teacher
	return db
		.select({
			id: classes.id,
			name: classes.name,
			academicYear: classes.academicYear,
			homeroomTeacherId: classes.homeroomTeacherId,
			homeroomTeacherName: users.fullName,
		})
		.from(classes)
		.leftJoin(users, eq(classes.homeroomTeacherId, users.id));
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
		})
		.where(eq(classes.id, id));
	return { success: true };
}

export async function deleteClass(id: string) {
	const db = await getDb();
	await db.delete(classes).where(eq(classes.id, id));
	return { success: true };
}

// --- SUBJECTS ---

export async function getSubjects() {
	const db = await getDb();
	return db.select().from(subjects);
}

export async function addSubject(data: { name: string; code: string }) {
	const db = await getDb();
	await db.insert(subjects).values({
		id: crypto.randomUUID(),
		name: data.name,
		code: data.code,
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
		})
		.where(eq(subjects.id, id));
	return { success: true };
}

export async function deleteSubject(id: string) {
	const db = await getDb();
	await db.delete(subjects).where(eq(subjects.id, id));
	return { success: true };
}
