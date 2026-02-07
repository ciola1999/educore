import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// --- TABLE: USERS (Guru & Admin) ---
export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // UUID v7 (generated di app)
  fullName: text('full_name').notNull(),
  email: text('email').notNull().unique(),
  role: text('role', { enum: ['admin', 'teacher', 'staff'] }).default('teacher').notNull(),
  passwordHash: text('password_hash'), // Akan diisi hash lokal
  
  // Metadata Sync
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  syncStatus: text('sync_status', { enum: ['synced', 'pending', 'error'] }).default('pending'),
});

// --- TABLE: STUDENTS (Murid) ---
export const students = sqliteTable('students', {
  id: text('id').primaryKey(),
  nis: text('nis').unique().notNull(), // Nomor Induk Siswa
  fullName: text('full_name').notNull(),
  gender: text('gender', { enum: ['L', 'P'] }).notNull(),
  grade: text('grade').notNull(), // Contoh: "X-RPL-1"
  
  // Data Wali
  parentName: text('parent_name'),
  parentPhone: text('parent_phone'),

  // Metadata Sync
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// Export type untuk dipakai di UI nanti (Type Inference)
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Student = typeof students.$inferSelect;
export type NewStudent = typeof students.$inferInsert;

// --- TABLE: CLASSES (Kelas) ---
export const classes = sqliteTable('classes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(), // e.g., "X-RPL-1"
  academicYear: text('academic_year').notNull(), // e.g., "2025/2026"
  homeroomTeacherId: text('homeroom_teacher_id').references(() => users.id),
  
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// --- TABLE: SUBJECTS (Mata Pelajaran) ---
export const subjects = sqliteTable('subjects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(), // e.g., "MTK-X"
  
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// --- TABLE: SCHEDULE (Jadwal) ---
export const schedule = sqliteTable('schedule', {
  id: text('id').primaryKey(),
  classId: text('class_id').notNull().references(() => classes.id),
  subjectId: text('subject_id').notNull().references(() => subjects.id),
  teacherId: text('teacher_id').notNull().references(() => users.id),
  dayOfWeek: integer('day_of_week').notNull(), // 0=Sunday, 1=Monday...
  startTime: text('start_time').notNull(), // "07:00"
  endTime: text('end_time').notNull(), // "08:30"
  
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// --- TABLE: ATTENDANCE (Absensi) ---
export const attendance = sqliteTable('attendance', {
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull().references(() => students.id),
  classId: text('class_id').notNull().references(() => classes.id), // Snapshot kelas saat absen
  date: text('date').notNull(), // "2026-02-07" (ISO Date)
  status: text('status', { enum: ['present', 'sick', 'permission', 'alpha'] }).notNull(),
  notes: text('notes'),
  recordedBy: text('recorded_by').notNull(), // User ID who recorded
  
  // Metadata
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  syncStatus: text('sync_status', { enum: ['synced', 'pending', 'error'] }).default('pending'),
});

export type Class = typeof classes.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type Schedule = typeof schedule.$inferSelect;
export type Attendance = typeof attendance.$inferSelect;