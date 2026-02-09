// Project\educore\src\lib\db\schema.ts

import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// --- SHARED COLUMNS (Sync Protocol) ---
// Kita gunakan spread object agar tidak mengulang kode
// --- SHARED COLUMNS (Sync Protocol) ---
const syncMetadata = {
	// Simpan sebagai Integer (ms). Hapus default SQL 'strftime' agar konsisten dengan JS Date.now()
	createdAt: integer("created_at", { mode: "timestamp" })
		.$defaultFn(() => new Date())
		.notNull(),

	updatedAt: integer("updated_at", { mode: "timestamp" })
		.$defaultFn(() => new Date())
		.$onUpdateFn(() => new Date()) // Auto-update saat edit data
		.notNull(),

	deletedAt: integer("deleted_at", { mode: "timestamp" }),

	syncStatus: text("sync_status", { enum: ["synced", "pending", "error"] })
		.default("pending")
		.notNull(),
};

// --- TABLE: USERS (Guru & Admin) ---
export const users = sqliteTable("users", {
	id: text("id").primaryKey(), // UUID v7
	fullName: text("full_name").notNull(),
	email: text("email").notNull().unique(),
	role: text("role", { enum: ["admin", "teacher", "staff"] })
		.default("teacher")
		.notNull(),
	passwordHash: text("password_hash"),

	...syncMetadata,
});

// --- TABLE: STUDENTS (Murid) ---
export const students = sqliteTable("students", {
	id: text("id").primaryKey(),
	nis: text("nis").unique().notNull(),
	fullName: text("full_name").notNull(),
	gender: text("gender", { enum: ["L", "P"] }).notNull(),
	grade: text("grade").notNull(),

	parentName: text("parent_name"),
	parentPhone: text("parent_phone"),

	...syncMetadata,
});

// --- TABLE: CLASSES (Kelas) ---
export const classes = sqliteTable("classes", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	academicYear: text("academic_year").notNull(),
	homeroomTeacherId: text("homeroom_teacher_id").references(() => users.id),

	...syncMetadata,
});

// --- TABLE: SUBJECTS (Mata Pelajaran) ---
export const subjects = sqliteTable("subjects", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	code: text("code").notNull().unique(),

	...syncMetadata,
});

// --- TABLE: SCHEDULE (Jadwal) ---
export const schedule = sqliteTable("schedule", {
	id: text("id").primaryKey(),
	classId: text("class_id")
		.notNull()
		.references(() => classes.id),
	subjectId: text("subject_id")
		.notNull()
		.references(() => subjects.id),
	teacherId: text("teacher_id")
		.notNull()
		.references(() => users.id),
	dayOfWeek: integer("day_of_week").notNull(),
	startTime: text("start_time").notNull(),
	endTime: text("end_time").notNull(),

	...syncMetadata,
});

// --- TABLE: ATTENDANCE (Absensi Manual Murid) ---
export const attendance = sqliteTable("attendance", {
	id: text("id").primaryKey(),
	studentId: text("student_id")
		.notNull()
		.references(() => students.id),
	classId: text("class_id")
		.notNull()
		.references(() => classes.id),
	date: text("date").notNull(),
	status: text("status", {
		enum: ["present", "sick", "permission", "alpha"],
	}).notNull(),
	notes: text("notes"),
	recordedBy: text("recorded_by").notNull(),

	...syncMetadata,
});

// --- TABLE: ATTENDANCE_SETTINGS (Konfigurasi Jam & Hari) ---
export const attendanceSettings = sqliteTable("attendance_settings", {
	id: text("id").primaryKey(),
	dayOfWeek: integer("day_of_week").notNull(), // 0-6 (Minggu-Sabtu)
	startTime: text("start_time").notNull(), // e.g., "07:00"
	endTime: text("end_time").notNull(), // e.g., "15:00"
	lateThreshold: text("late_threshold").notNull(), // e.g., "07:15"
	entityType: text("entity_type", { enum: ["student", "employee"] }).notNull(),
	isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),

	...syncMetadata,
});

// --- TABLE: HOLIDAYS (Daftar Hari Libur Nasional/Khusus) ---
export const holidays = sqliteTable("holidays", {
	id: text("id").primaryKey(),
	date: text("date").notNull(), // YYYY-MM-DD
	name: text("name").notNull(),

	...syncMetadata,
});

// --- TABLE: ATTENDANCE_LOGS (Log Absensi QR & Real-time) ---
export const attendanceLogs = sqliteTable("attendance_logs", {
	id: text("id").primaryKey(),
	entityId: text("entity_id").notNull(), // Bisa ID Siswa atau ID User (Guru/Staff)
	entityType: text("entity_type", {
		enum: ["student", "teacher", "staff"],
	}).notNull(),
	date: text("date").notNull(), // YYYY-MM-DD
	checkInTime: text("check_in_time"),
	checkOutTime: text("check_out_time"),
	status: text("status", { enum: ["on-time", "late", "absent", "holiday"] }),
	lateDuration: integer("late_duration"), // dalam menit
	notes: text("notes"),

	...syncMetadata,
});

// Export Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Student = typeof students.$inferSelect;
export type NewStudent = typeof students.$inferInsert;
export type Class = typeof classes.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type Schedule = typeof schedule.$inferSelect;
export type Attendance = typeof attendance.$inferSelect;
export type AttendanceSettings = typeof attendanceSettings.$inferSelect;
export type Holiday = typeof holidays.$inferSelect;
export type AttendanceLog = typeof attendanceLogs.$inferSelect;
