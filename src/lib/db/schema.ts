import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// --- SHARED COLUMNS (Sync Protocol) ---
// Kita gunakan spread object agar tidak mengulang kode
const syncMetadata = {
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }), // Soft Delete (null = aktif)
  syncStatus: text('sync_status', { enum: ['synced', 'pending', 'error'] }).default('pending').notNull(),
};

// --- TABLE: USERS (Guru & Admin) ---
export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // UUID v7
  fullName: text('full_name').notNull(),
  email: text('email').notNull().unique(),
  role: text('role', { enum: ['admin', 'teacher', 'staff'] }).default('teacher').notNull(),
  passwordHash: text('password_hash'), 
  
  ...syncMetadata
});

// --- TABLE: STUDENTS (Murid) ---
export const students = sqliteTable('students', {
  id: text('id').primaryKey(),
  nis: text('nis').unique().notNull(),
  fullName: text('full_name').notNull(),
  gender: text('gender', { enum: ['L', 'P'] }).notNull(),
  grade: text('grade').notNull(),
  
  parentName: text('parent_name'),
  parentPhone: text('parent_phone'),

  ...syncMetadata
});

// --- TABLE: CLASSES (Kelas) ---
export const classes = sqliteTable('classes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  academicYear: text('academic_year').notNull(),
  homeroomTeacherId: text('homeroom_teacher_id').references(() => users.id),
  
  ...syncMetadata
});

// --- TABLE: SUBJECTS (Mata Pelajaran) ---
export const subjects = sqliteTable('subjects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  
  ...syncMetadata
});

// --- TABLE: SCHEDULE (Jadwal) ---
export const schedule = sqliteTable('schedule', {
  id: text('id').primaryKey(),
  classId: text('class_id').notNull().references(() => classes.id),
  subjectId: text('subject_id').notNull().references(() => subjects.id),
  teacherId: text('teacher_id').notNull().references(() => users.id),
  dayOfWeek: integer('day_of_week').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  
  ...syncMetadata
});

// --- TABLE: ATTENDANCE (Absensi) ---
export const attendance = sqliteTable('attendance', {
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull().references(() => students.id),
  classId: text('class_id').notNull().references(() => classes.id),
  date: text('date').notNull(),
  status: text('status', { enum: ['present', 'sick', 'permission', 'alpha'] }).notNull(),
  notes: text('notes'),
  recordedBy: text('recorded_by').notNull(),
  
  ...syncMetadata
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