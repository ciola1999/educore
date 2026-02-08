import { eq } from "drizzle-orm";
import { getDb } from "../db";
import {
	attendance,
	attendanceLogs,
	attendanceSettings,
	classes,
	holidays,
	students,
	subjects,
	users,
} from "../db/schema";
import { type SyncResult, supabase } from "./client";
export { supabase, type SyncResult };

/**
 * Push pending local data to Supabase (Upload)
 */
export async function pushToSupabase(): Promise<SyncResult> {
	try {
		const db = await getDb();
		let uploadedCount = 0;

		// Helper to sync a table
		const syncTable = async (
			tableName: string,
			drizzleTable: any,
			mapFn: (data: any) => any,
			onConflict: string = "id",
		) => {
			const pendingItems = await db
				.select()
				.from(drizzleTable)
				.where(eq(drizzleTable.syncStatus, "pending"));

			if (pendingItems.length > 0) {
				const { error } = await supabase
					.from(tableName)
					.upsert(pendingItems.map(mapFn), { onConflict });

				if (error) {
					console.error(`Error syncing table ${tableName}:`, error);
					throw error;
				}

				// Mark as synced
				for (const item of pendingItems) {
					await db
						.update(drizzleTable)
						.set({ syncStatus: "synced", updatedAt: new Date() })
						.where(eq(drizzleTable.id, item.id));
				}
				uploadedCount += pendingItems.length;
			}
		};

		// 1. Sync Students (Conflict on NIS to prevent 23505)
		await syncTable(
			"students",
			students,
			(s) => ({
				id: s.id,
				nis: s.nis,
				full_name: s.fullName,
				gender: s.gender,
				grade: s.grade,
				parent_name: s.parentName,
				parent_phone: s.parentPhone,
				updated_at: new Date().toISOString(),
			}),
			"nis",
		);

		// 2. Sync Users (Conflict on Email)
		await syncTable(
			"users",
			users,
			(u) => ({
				id: u.id,
				full_name: u.fullName,
				email: u.email,
				role: u.role,
				password_hash: u.passwordHash,
				updated_at: new Date().toISOString(),
			}),
			"email",
		);

		// 3. Sync Classes
		await syncTable("classes", classes, (c) => ({
			id: c.id,
			name: c.name,
			academic_year: c.academicYear,
			homeroom_teacher_id: c.homeroomTeacherId,
			updated_at: new Date().toISOString(),
		}));

		// 4. Sync Subjects (Conflict on Code)
		await syncTable(
			"subjects",
			subjects,
			(s) => ({
				id: s.id,
				name: s.name,
				code: s.code,
				updated_at: new Date().toISOString(),
			}),
			"code",
		);

		// 5. Sync Attendance (Manual)
		await syncTable("attendance", attendance, (a) => ({
			id: a.id,
			student_id: a.studentId,
			class_id: a.classId,
			date: a.date,
			status: a.status,
			notes: a.notes,
			recorded_by: a.recordedBy,
			created_at: a.createdAt,
			updated_at: new Date().toISOString(),
		}));

		// 6. Sync Attendance Settings
		await syncTable("attendance_settings", attendanceSettings, (s) => ({
			id: s.id,
			day_of_week: s.dayOfWeek,
			start_time: s.startTime,
			end_time: s.endTime,
			late_threshold: s.lateThreshold,
			entity_type: s.entityType,
			is_active: s.isActive,
			updated_at: new Date().toISOString(),
		}));

		// 7. Sync Holidays
		await syncTable("holidays", holidays, (h) => ({
			id: h.id,
			date: h.date,
			name: h.name,
			updated_at: new Date().toISOString(),
		}));

		// 8. Sync Attendance Logs
		await syncTable("attendance_logs", attendanceLogs, (l) => ({
			id: l.id,
			entity_id: l.entityId,
			entity_type: l.entityType,
			date: l.date,
			check_in_time: l.checkInTime,
			check_out_time: l.checkOutTime,
			status: l.status,
			late_duration: l.lateDuration,
			notes: l.notes,
			updated_at: new Date().toISOString(),
		}));

		return {
			status: "success",
			message: `Uploaded ${uploadedCount} records to cloud.`,
			uploaded: uploadedCount,
		};
	} catch (error) {
		console.error("Push error details:", JSON.stringify(error, null, 2));
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

		const pullTable = async (
			tableName: string,
			drizzleTable: any,
			mapFn: (remote: any) => any,
		) => {
			const { data: remoteData, error } = await supabase
				.from(tableName)
				.select("*");
			if (error) throw error;

			if (remoteData && remoteData.length > 0) {
				for (const remote of remoteData) {
					const existing = await db
						.select()
						.from(drizzleTable)
						.where(eq(drizzleTable.id, remote.id))
						.limit(1);

					if (existing.length === 0) {
						await db.insert(drizzleTable).values({
							...mapFn(remote),
							syncStatus: "synced",
						});
						downloadedCount++;
					}
				}
			}
		};

		// 1. Students
		await pullTable("students", students, (s) => ({
			id: s.id,
			nis: s.nis,
			fullName: s.full_name,
			gender: s.gender,
			grade: s.grade,
			parentName: s.parent_name,
			parentPhone: s.parent_phone,
		}));

		// 2. Users
		await pullTable("users", users, (u) => ({
			id: u.id,
			fullName: u.full_name,
			email: u.email,
			role: u.role,
			passwordHash: u.password_hash,
		}));

		// 3. Classes
		await pullTable("classes", classes, (c) => ({
			id: c.id,
			name: c.name,
			academicYear: c.academic_year,
			homeroomTeacherId: c.homeroom_teacher_id,
		}));

		// 4. Attendance Settings
		await pullTable("attendance_settings", attendanceSettings, (as) => ({
			id: as.id,
			dayOfWeek: as.day_of_week,
			startTime: as.start_time,
			endTime: as.end_time,
			lateThreshold: as.late_threshold,
			entityType: as.entity_type,
			isActive: as.is_active,
		}));

		// 5. Holidays
		await pullTable("holidays", holidays, (h) => ({
			id: h.id,
			date: h.date,
			name: h.name,
		}));

		// 6. Attendance Logs
		await pullTable("attendance_logs", attendanceLogs, (al) => ({
			id: al.id,
			entityId: al.entity_id,
			entityType: al.entity_type,
			date: al.date,
			check_in_time: al.check_in_time,
			check_out_time: al.check_out_time,
			status: al.status,
			lateDuration: al.late_duration,
			notes: al.notes,
		}));

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
