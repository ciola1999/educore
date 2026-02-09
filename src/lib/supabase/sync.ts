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

// --- HELPER: SAFE DATE PARSER ---
// Mencegah error NaN dan otomatis konversi Seconds -> Milliseconds
const safeDate = (value: any): Date => {
	if (!value) return new Date(); // Fallback: Jika null, pakai waktu sekarang

	// Jika angka (Timestamp)
	if (typeof value === "number") {
		// Deteksi apakah ini Seconds (Unix) atau Milliseconds (JS)
		// Angka < 100 Miliar biasanya Seconds (cukup sampai tahun 5138)
		if (value < 100000000000) {
			return new Date(value * 1000);
		}
		return new Date(value);
	}

	// Jika string (ISO Date)
	const d = new Date(value);
	// Cek apakah valid
	if (isNaN(d.getTime())) {
		console.warn("⚠️ Invalid date detected, falling back to NOW:", value);
		return new Date();
	}
	return d;
};

/**
 * Push pending local data to Supabase (Upload)
 */
export async function pushToSupabase(): Promise<SyncResult> {
	try {
		const db = await getDb();
		let uploadedCount = 0;

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
				// Upsert ke Supabase
				const { error } = await supabase
					.from(tableName)
					.upsert(pendingItems.map(mapFn), { onConflict });

				if (error) {
					console.error(`Error syncing table ${tableName}:`, error);
					throw error;
				}

				// Mark as synced local
				for (const item of pendingItems) {
					await db
						.update(drizzleTable)
						.set({ syncStatus: "synced", updatedAt: new Date() })
						.where(eq(drizzleTable.id, item.id));
				}
				uploadedCount += pendingItems.length;
			}
		};

		// 1. Students
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

		// 2. Users
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

		// 3. Classes
		await syncTable("classes", classes, (c) => ({
			id: c.id,
			name: c.name,
			academic_year: c.academicYear,
			homeroom_teacher_id: c.homeroomTeacherId,
			updated_at: new Date().toISOString(),
		}));

		// 4. Subjects
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

		// 5. Attendance
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

		// 6. Settings
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

		// 7. Holidays
		await syncTable("holidays", holidays, (h) => ({
			id: h.id,
			date: h.date,
			name: h.name,
			updated_at: new Date().toISOString(),
		}));

		// 8. Logs
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
 * ✅ FIXED: Supports UPSERT & Safe Date Parsing
 */
export async function pullFromSupabase(): Promise<SyncResult> {
	try {
		const db = await getDb();
		let downloadedCount = 0;
		let updatedCount = 0;

		const pullTable = async (
			tableName: string,
			drizzleTable: any,
			mapFn: (remote: any) => any,
		) => {
			// Ambil data Cloud
			const { data: remoteData, error } = await supabase
				.from(tableName)
				.select("*");
			if (error) throw error;

			if (remoteData && remoteData.length > 0) {
				for (const remote of remoteData) {
					// Cek existing data di Local
					const existing = await db
						.select()
						.from(drizzleTable)
						.where(eq(drizzleTable.id, remote.id))
						.limit(1);

					// Map data + set syncStatus = 'synced'
					const mappedData = {
						...mapFn(remote),
						syncStatus: "synced",
					};

					if (existing.length === 0) {
						// INSERT (New)
						await db.insert(drizzleTable).values(mappedData);
						downloadedCount++;
					} else {
						// UPDATE (Existing) - LWW Strategy
						await db
							.update(drizzleTable)
							.set(mappedData)
							.where(eq(drizzleTable.id, remote.id));
						updatedCount++;
					}
				}
			}
		};

		// 1. Users
		await pullTable("users", users, (u) => ({
			id: u.id,
			fullName: u.full_name,
			email: u.email,
			role: u.role,
			passwordHash: u.password_hash,
			// 👇 Gunakan safeDate di sini
			updatedAt: safeDate(u.updated_at),
			createdAt: safeDate(u.created_at),
		}));

		// 2. Students
		await pullTable("students", students, (s) => ({
			id: s.id,
			nis: s.nis,
			fullName: s.full_name,
			gender: s.gender,
			grade: s.grade,
			parentName: s.parent_name,
			parentPhone: s.parent_phone,
			updatedAt: safeDate(s.updated_at),
			createdAt: safeDate(s.created_at),
		}));

		// 3. Classes
		await pullTable("classes", classes, (c) => ({
			id: c.id,
			name: c.name,
			academicYear: c.academic_year,
			homeroomTeacherId: c.homeroom_teacher_id,
			updatedAt: safeDate(c.updated_at),
			createdAt: safeDate(c.created_at),
		}));

		// 4. Subjects
		await pullTable("subjects", subjects, (s) => ({
			id: s.id,
			name: s.name,
			code: s.code,
			updatedAt: safeDate(s.updated_at),
			createdAt: safeDate(s.created_at),
		}));

		// 5. Attendance Settings
		await pullTable("attendance_settings", attendanceSettings, (as) => ({
			id: as.id,
			dayOfWeek: as.day_of_week,
			startTime: as.start_time,
			endTime: as.end_time,
			lateThreshold: as.late_threshold,
			entityType: as.entity_type,
			isActive: as.is_active,
			updatedAt: safeDate(as.updated_at),
			createdAt: safeDate(as.created_at),
		}));

		// 6. Holidays
		await pullTable("holidays", holidays, (h) => ({
			id: h.id,
			date: h.date,
			name: h.name,
			updatedAt: safeDate(h.updated_at),
			createdAt: safeDate(h.created_at),
		}));

		// 7. Attendance Logs
		await pullTable("attendance_logs", attendanceLogs, (al) => ({
			id: al.id,
			entityId: al.entity_id,
			entityType: al.entity_type,
			date: al.date,
			checkInTime: al.check_in_time,
			checkOutTime: al.check_out_time,
			status: al.status,
			lateDuration: al.late_duration,
			notes: al.notes,
			updatedAt: safeDate(al.updated_at),
			createdAt: safeDate(al.created_at),
		}));

		return {
			status: "success",
			message: `Downloaded ${downloadedCount} new, ${updatedCount} updated.`,
			downloaded: downloadedCount + updatedCount,
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
		message: `Sync complete! Uploaded ${pushResult.uploaded || 0}, Downloaded ${
			pullResult.downloaded || 0
		} records.`,
		uploaded: pushResult.uploaded,
		downloaded: pullResult.downloaded,
	};
}
