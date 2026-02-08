import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import {
	attendanceLogs,
	attendanceSettings,
	holidays,
	students,
	users,
} from "../db/schema";

export type ScanResult = {
	success: boolean;
	message: string;
	data?: {
		id: string;
		nis?: string;
		fullName: string;
		time: string;
		status: "on-time" | "late" | "too-early" | "closed";
		lateMinutes?: number;
		type: "student" | "teacher" | "staff" | "admin";
		photo?: string;
	};
};

/**
 * Process a QR Scan (NIS for Students, UUID for Teachers/Staff)
 */
export async function processQRScan(qrData: string): Promise<ScanResult> {
	const db = await getDb();
	const now = new Date();
	const dateStr = now.toISOString().split("T")[0];
	const timeStr = now.toTimeString().split(" ")[0].slice(0, 5); // "HH:MM"
	const dayOfWeek = now.getDay();

	// 1. Check if today is a holiday
	const holiday = await db
		.select()
		.from(holidays)
		.where(eq(holidays.date, dateStr))
		.limit(1);

	if (holiday.length > 0) {
		return { success: false, message: `Hari ini libur: ${holiday[0].name}` };
	}

	// 2. Identify entity (Student or User)
	let entity: {
		id: string;
		fullName: string;
		type: "student" | "teacher" | "staff" | "admin";
		nis?: string;
	} | null = null;

	// Try student first (NIS)
	const student = await db
		.select()
		.from(students)
		.where(eq(students.nis, qrData))
		.limit(1);

	if (student.length > 0) {
		entity = {
			id: student[0].id,
			fullName: student[0].fullName,
			type: "student",
			nis: student[0].nis,
		};
	} else {
		// Try user (Teacher/Staff/Admin)
		const user = await db
			.select()
			.from(users)
			.where(eq(users.id, qrData))
			.limit(1);

		if (user.length > 0) {
			entity = {
				id: user[0].id,
				fullName: user[0].fullName,
				type: user[0].role as "teacher" | "staff" | "admin",
			};
		}
	}

	if (!entity) {
		return { success: false, message: "ID atau NIS tidak dikenali" };
	}

	// 3. Get Rules for this entity type and day
	const rules = await db
		.select()
		.from(attendanceSettings)
		.where(
			and(
				eq(attendanceSettings.dayOfWeek, dayOfWeek),
				eq(
					attendanceSettings.entityType,
					entity.type === "student" ? "student" : "employee",
				),
				eq(attendanceSettings.isActive, true),
			),
		)
		.limit(1);

	if (rules.length === 0) {
		return { success: false, message: "Tidak ada jadwal absen untuk hari ini" };
	}

	const { startTime, endTime, lateThreshold } = rules[0];

	// 4. Determine status
	let status: "on-time" | "late" | "too-early" | "closed" = "on-time";
	let lateMinutes = 0;

	if (timeStr < startTime) {
		return {
			success: false,
			message: "Belum jam absen masuk",
			data: { ...entity, time: timeStr, status: "too-early" },
		};
	}

	if (timeStr > endTime) {
		return {
			success: false,
			message: "Absen masuk sudah ditutup",
			data: { ...entity, time: timeStr, status: "closed" },
		};
	}

	if (timeStr > lateThreshold) {
		status = "late";
		// Calculate late minutes
		const [h1, m1] = startTime.split(":").map(Number);
		const [h2, m2] = timeStr.split(":").map(Number);
		lateMinutes = h2 * 60 + m2 - (h1 * 60 + m1);
	}

	// 5. Save/Update Log
	const existingLog = await db
		.select()
		.from(attendanceLogs)
		.where(
			and(
				eq(attendanceLogs.entityId, entity.id),
				eq(attendanceLogs.date, dateStr),
			),
		)
		.limit(1);

	if (existingLog.length > 0) {
		// Already checked in, check for checkout or ignore
		if (
			existingLog[0].checkInTime &&
			!existingLog[0].checkOutTime &&
			timeStr > "12:00"
		) {
			// Assume checkout if after 12:00
			await db
				.update(attendanceLogs)
				.set({ checkOutTime: timeStr, updatedAt: new Date() })
				.where(eq(attendanceLogs.id, existingLog[0].id));

			return {
				success: true,
				message: "Berhasil Absen Pulang",
				data: { ...entity, time: timeStr, status: "on-time" },
			};
		}
		return { success: false, message: "Anda sudah melakukan absen hari ini" };
	}

	await db.insert(attendanceLogs).values({
		id: crypto.randomUUID(),
		entityId: entity.id,
		entityType: entity.type,
		date: dateStr,
		checkInTime: timeStr,
		status,
		lateDuration: lateMinutes,
		syncStatus: "pending",
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	return {
		success: true,
		message:
			status === "late"
				? `Absen berhasil (Terlambat ${lateMinutes} menit)`
				: "Absen berhasil tepat waktu",
		data: { ...entity, time: timeStr, status, lateMinutes },
	};
}

/**
 * Settings Management
 */
export async function getAttendanceSettings() {
	const db = await getDb();
	return await db.select().from(attendanceSettings);
}

export async function upsertAttendanceSetting(data: any) {
	const db = await getDb();
	const { id, ...values } = data;

	// Check if ID is a real database ID (not a temp one)
	const isRealId = id && !id.startsWith?.("temp-");

	if (isRealId) {
		return await db
			.update(attendanceSettings)
			.set({
				...values,
				syncStatus: "pending",
				updatedAt: new Date(),
			})
			.where(eq(attendanceSettings.id, id));
	}

	// New record
	return await db.insert(attendanceSettings).values({
		...values,
		id: crypto.randomUUID(),
		syncStatus: "pending",
		createdAt: new Date(),
		updatedAt: new Date(),
	});
}

export async function deleteAttendanceSetting(id: string) {
	const db = await getDb();
	return await db
		.delete(attendanceSettings)
		.where(eq(attendanceSettings.id, id));
}

export async function getHolidays() {
	const db = await getDb();
	return await db.select().from(holidays);
}

export async function addHoliday(date: string, name: string) {
	const db = await getDb();
	return await db
		.insert(holidays)
		.values({ id: crypto.randomUUID(), date, name });
}
