import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

// --- HELPERS: SYNC PROTOCOL (DRY Pattern) ---
const syncMetadata = {
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
    .notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  syncStatus: text("sync_status", { enum: ["synced", "pending", "error"] })
    .default("pending")
    .notNull(),
};

// --- TABLE: USERS (Guru & Admin) ---
export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
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
  id: text("id").primaryKey().$defaultFn(() => createId()),
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
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull(),
  academicYear: text("academic_year").notNull(),
  homeroomTeacherId: text("homeroom_teacher_id").references(() => users.id),
  ...syncMetadata,
});

// --- TABLE: SUBJECTS (Mata Pelajaran) ---
export const subjects = sqliteTable("subjects", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  ...syncMetadata,
});

// --- TABLE: SCHEDULE (Jadwal) ---
export const schedule = sqliteTable("schedule", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
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

// --- TABLE: ATTENDANCE (Jurnal Kelas / Absensi Manual Guru) ---
export const attendance = sqliteTable("attendance", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
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

// --- TABLE: ATTENDANCE_SETTINGS (Konfigurasi Jam) ---
export const attendanceSettings = sqliteTable("attendance_settings", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  dayOfWeek: integer("day_of_week").notNull(), // 0-6
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  lateThreshold: text("late_threshold").notNull(),
  entityType: text("entity_type", { enum: ["student", "employee"] }).notNull(),
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
  ...syncMetadata,
});

// --- TABLE: HOLIDAYS ---
export const holidays = sqliteTable("holidays", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  date: text("date").notNull(),
  name: text("name").notNull(),
  ...syncMetadata,
});

// --- TABLE: STUDENT DAILY ATTENDANCE (QR Log - Main Feature) ---
export const studentDailyAttendance = sqliteTable(
  "student_daily_attendance",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),

    // Snapshot Data (Data statis saat kejadian scan)
    snapshotStudentName: text("snapshot_student_name"),
    snapshotStudentNis: text("snapshot_student_nis"),

    date: text("date").notNull(), // YYYY-MM-DD
    
    checkInTime: integer("check_in_time", { mode: "timestamp" }),
    checkOutTime: integer("check_out_time", { mode: "timestamp" }),
    
    status: text("status", { enum: ["PRESENT", "LATE", "EXCUSED", "ABSENT"] })
      .default("PRESENT")
      .notNull(),
      
    lateDuration: integer("late_duration").default(0),

    ...syncMetadata,
  },
  (table) => ({
    // ⚡ PERFORMANCE INDEXES
    dateIdx: index("sda_date_idx").on(table.date),
    studentIdx: index("sda_student_idx").on(table.studentId),
    
    // 🛡️ DATA INTEGRITY: Max 1 check-in per siswa per hari
    uniqueDaily: uniqueIndex("unique_daily_student_attendance")
      .on(table.studentId, table.date),
  })
);

// --- RELATIONS (Defined at the bottom to avoid circular issues) ---

export const studentsRelations = relations(students, ({ many }) => ({
  dailyAttendances: many(studentDailyAttendance),
  manualAttendances: many(attendance), // Relasi ke jurnal kelas
}));

export const studentDailyAttendanceRelations = relations(studentDailyAttendance, ({ one }) => ({
  student: one(students, {
    fields: [studentDailyAttendance.studentId],
    references: [students.id],
  }),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
  student: one(students, {
    fields: [attendance.studentId],
    references: [students.id],
  }),
  class: one(classes, {
    fields: [attendance.classId],
    references: [classes.id],
  }),
}));



export const classesRelations = relations(classes, ({ one, many }) => ({
  homeroomTeacher: one(users, {
    fields: [classes.homeroomTeacherId],
    references: [users.id],
  }),
  schedules: many(schedule),
}));

export const scheduleRelations = relations(schedule, ({ one }) => ({
  class: one(classes, { fields: [schedule.classId], references: [classes.id] }),
  subject: one(subjects, { fields: [schedule.subjectId], references: [subjects.id] }),
  teacher: one(users, { fields: [schedule.teacherId], references: [users.id] }),
}));

// --- TYPE EXPORTS ---
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

export type StudentDailyAttendance = typeof studentDailyAttendance.$inferSelect;
export type NewStudentDailyAttendance = typeof studentDailyAttendance.$inferInsert;