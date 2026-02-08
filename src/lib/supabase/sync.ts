import { eq } from "drizzle-orm";
import { getDb } from "../db";
import {
	type Attendance,
	attendance,
	type Class,
	classes,
	type Student,
	students,
	type Subject,
	subjects,
	type User,
	users,
} from "../db/schema";

import { supabase, type SyncResult } from "./client";
export { supabase, type SyncResult };

/**
 * Push pending local data to Supabase (Upload)
 * Uses Last-Write-Wins (LWW) strategy
 */
export async function pushToSupabase(): Promise<SyncResult> {
	try {
		const db = await getDb();
		let uploadedCount = 0;

		// 1. Sync Students
		const pendingStudents = await db.select().from(students);
		if (pendingStudents.length > 0) {
			const { error } = await supabase.from("students").upsert(
				pendingStudents.map((s: Student) => ({
					id: s.id,
					nis: s.nis,
					full_name: s.fullName,
					gender: s.gender,
					grade: s.grade,
					parent_name: s.parentName,
					parent_phone: s.parentPhone,
					updated_at: new Date().toISOString(),
				})),
				{ onConflict: "id" },
			);
			if (error) throw error;
			uploadedCount += pendingStudents.length;
		}

		// 2. Sync Users (Teachers)
		const pendingUsers = await db.select().from(users);
		if (pendingUsers.length > 0) {
			const { error } = await supabase.from("users").upsert(
				pendingUsers.map((u: User) => ({
					id: u.id,
					full_name: u.fullName,
					email: u.email,
					role: u.role,
					password_hash: u.passwordHash,
					updated_at: new Date().toISOString(),
				})),
				{ onConflict: "id" },
			);
			if (error) throw error;
			uploadedCount += pendingUsers.length;
		}

		// 3. Sync Classes
		const pendingClasses = await db.select().from(classes);
		if (pendingClasses.length > 0) {
			const { error } = await supabase.from("classes").upsert(
				pendingClasses.map((c: Class) => ({
					id: c.id,
					name: c.name,
					academic_year: c.academicYear,
					homeroom_teacher_id: c.homeroomTeacherId,
					updated_at: new Date().toISOString(),
				})),
				{ onConflict: "id" },
			);
			if (error) throw error;
			uploadedCount += pendingClasses.length;
		}

		// 4. Sync Subjects
		const pendingSubjects = await db.select().from(subjects);
		if (pendingSubjects.length > 0) {
			const { error } = await supabase.from("subjects").upsert(
				pendingSubjects.map((s: Subject) => ({
					id: s.id,
					name: s.name,
					code: s.code,
					updated_at: new Date().toISOString(),
				})),
				{ onConflict: "id" },
			);
			if (error) throw error;
			uploadedCount += pendingSubjects.length;
		}

		// 5. Sync Attendance
		const pendingAttendance = await db
			.select()
			.from(attendance)
			.where(eq(attendance.syncStatus, "pending"));
		if (pendingAttendance.length > 0) {
			const { error } = await supabase.from("attendance").upsert(
				pendingAttendance.map((a: Attendance) => ({
					id: a.id,
					student_id: a.studentId,
					class_id: a.classId,
					date: a.date,
					status: a.status,
					notes: a.notes,
					recorded_by: a.recordedBy,
					created_at: a.createdAt,
					updated_at: new Date().toISOString(),
				})),
				{ onConflict: "id" },
			);
			if (error) throw error;

			// Mark as synced
			for (const a of pendingAttendance) {
				await db
					.update(attendance)
					.set({ syncStatus: "synced" })
					.where(eq(attendance.id, a.id));
			}
			uploadedCount += pendingAttendance.length;
		}

		return {
			status: "success",
			message: `Uploaded ${uploadedCount} records to cloud.`,
			uploaded: uploadedCount,
		};
	} catch (error) {
		console.error("Push error:", error);
		return {
			status: "error",
			message: error instanceof Error ? error.message : "Failed to push data",
		};
	}
}

/**
 * Pull data from Supabase to local SQLite (Download)
 */
export async function pullFromSupabase(): Promise<SyncResult> {
	try {
		const db = await getDb();
		let downloadedCount = 0;

		// 1. Pull Students
		const { data: remoteStudents, error: studentsError } = await supabase
			.from("students")
			.select("*");
		if (studentsError) throw studentsError;
		if (remoteStudents && remoteStudents.length > 0) {
			for (const s of remoteStudents) {
				const existing = await db
					.select()
					.from(students)
					.where(eq(students.id, s.id))
					.limit(1);
				if (existing.length === 0) {
					await db.insert(students).values({
						id: s.id,
						nis: s.nis,
						fullName: s.full_name,
						gender: s.gender,
						grade: s.grade,
						parentName: s.parent_name,
						parentPhone: s.parent_phone,
					});
					downloadedCount++;
				}
			}
		}

		// 2. Pull Users
		const { data: remoteUsers, error: usersError } = await supabase
			.from("users")
			.select("*");
		if (usersError) throw usersError;
		if (remoteUsers && remoteUsers.length > 0) {
			for (const u of remoteUsers) {
				const existing = await db
					.select()
					.from(users)
					.where(eq(users.id, u.id))
					.limit(1);
				if (existing.length === 0) {
					await db.insert(users).values({
						id: u.id,
						fullName: u.full_name,
						email: u.email,
						role: u.role,
						passwordHash: u.password_hash,
						syncStatus: "synced",
					});
					downloadedCount++;
				}
			}
		}

		// 3. Pull Classes
		const { data: remoteClasses, error: classesError } = await supabase
			.from("classes")
			.select("*");
		if (classesError) throw classesError;
		if (remoteClasses && remoteClasses.length > 0) {
			for (const c of remoteClasses) {
				const existing = await db
					.select()
					.from(classes)
					.where(eq(classes.id, c.id))
					.limit(1);
				if (existing.length === 0) {
					await db.insert(classes).values({
						id: c.id,
						name: c.name,
						academicYear: c.academic_year,
						homeroomTeacherId: c.homeroom_teacher_id,
					});
					downloadedCount++;
				}
			}
		}

		return {
			status: "success",
			message: `Downloaded ${downloadedCount} new records from cloud.`,
			downloaded: downloadedCount,
		};
	} catch (error) {
		console.error("Pull error:", error);
		return {
			status: "error",
			message: error instanceof Error ? error.message : "Failed to pull data",
		};
	}
}

/**
 * Full sync: Push then Pull
 */
export async function fullSync(): Promise<SyncResult> {
	const pushResult = await pushToSupabase();
	if (pushResult.status === "error") return pushResult;

	const pullResult = await pullFromSupabase();
	if (pullResult.status === "error") return pullResult;

	return {
		status: "success",
		message: `Sync complete! Uploaded ${pushResult.uploaded || 0}, Downloaded ${pullResult.downloaded || 0} records.`,
		uploaded: pushResult.uploaded,
		downloaded: pullResult.downloaded,
	};
}
