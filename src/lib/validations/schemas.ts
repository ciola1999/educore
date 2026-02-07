import { z } from 'zod';

// ================================
// ENUMS
// ================================
export const UserRoleEnum = z.enum(['admin', 'teacher', 'staff']);
export const GenderEnum = z.enum(['L', 'P']);
export const AttendanceStatusEnum = z.enum(['present', 'sick', 'permission', 'alpha']);
export const SyncStatusEnum = z.enum(['synced', 'pending', 'error']);

// ================================
// USER SCHEMA
// ================================
export const userInsertSchema = z.object({
  id: z.string().uuid().optional(), // Auto-generated if not provided
  fullName: z.string().min(2, 'Nama minimal 2 karakter'),
  email: z.string().email('Email tidak valid'),
  role: UserRoleEnum.default('teacher'),
  passwordHash: z.string().optional(),
  syncStatus: SyncStatusEnum.default('pending'),
});

export const userSelectSchema = userInsertSchema.extend({
  id: z.string(),
  createdAt: z.number().nullable(),
  updatedAt: z.number().nullable(),
});

export type UserInsert = z.infer<typeof userInsertSchema>;
export type UserSelect = z.infer<typeof userSelectSchema>;

// ================================
// STUDENT SCHEMA
// ================================
export const studentInsertSchema = z.object({
  id: z.string().uuid().optional(),
  nis: z.string().min(5, 'NIS minimal 5 karakter'),
  fullName: z.string().min(2, 'Nama minimal 2 karakter'),
  gender: GenderEnum,
  grade: z.string().min(1, 'Kelas wajib diisi'),
  parentName: z.string().optional(),
  parentPhone: z.string().regex(/^[0-9+\-\s]+$/, 'Nomor HP tidak valid').optional(),
});

export const studentSelectSchema = studentInsertSchema.extend({
  id: z.string(),
  createdAt: z.number().nullable(),
  updatedAt: z.number().nullable(),
});

export type StudentInsert = z.infer<typeof studentInsertSchema>;
export type StudentSelect = z.infer<typeof studentSelectSchema>;

// ================================
// CLASS SCHEMA
// ================================
export const classInsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Nama kelas wajib diisi'),
  academicYear: z.string().regex(/^\d{4}\/\d{4}$/, 'Format: 2025/2026'),
  homeroomTeacherId: z.string().uuid().optional(),
});

export const classSelectSchema = classInsertSchema.extend({
  id: z.string(),
  updatedAt: z.number().nullable(),
});

export type ClassInsert = z.infer<typeof classInsertSchema>;
export type ClassSelect = z.infer<typeof classSelectSchema>;

// ================================
// SUBJECT SCHEMA
// ================================
export const subjectInsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Nama mata pelajaran wajib diisi'),
  code: z.string().min(2, 'Kode minimal 2 karakter').toUpperCase(),
});

export const subjectSelectSchema = subjectInsertSchema.extend({
  id: z.string(),
  updatedAt: z.number().nullable(),
});

export type SubjectInsert = z.infer<typeof subjectInsertSchema>;
export type SubjectSelect = z.infer<typeof subjectSelectSchema>;

// ================================
// SCHEDULE SCHEMA
// ================================
export const scheduleInsertSchema = z.object({
  id: z.string().uuid().optional(),
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  teacherId: z.string().uuid(),
  dayOfWeek: z.number().min(0).max(6), // 0=Sunday, 6=Saturday
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
});

export const scheduleSelectSchema = scheduleInsertSchema.extend({
  id: z.string(),
  updatedAt: z.number().nullable(),
});

export type ScheduleInsert = z.infer<typeof scheduleInsertSchema>;
export type ScheduleSelect = z.infer<typeof scheduleSelectSchema>;

// ================================
// ATTENDANCE SCHEMA
// ================================
export const attendanceInsertSchema = z.object({
  id: z.string().uuid().optional(),
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  status: AttendanceStatusEnum,
  notes: z.string().max(500, 'Catatan maksimal 500 karakter').optional(),
  recordedBy: z.string().uuid(),
  syncStatus: SyncStatusEnum.default('pending'),
});

export const attendanceSelectSchema = attendanceInsertSchema.extend({
  id: z.string(),
  createdAt: z.number().nullable(),
});

export type AttendanceInsert = z.infer<typeof attendanceInsertSchema>;
export type AttendanceSelect = z.infer<typeof attendanceSelectSchema>;

// ================================
// BULK OPERATIONS
// ================================
export const bulkAttendanceSchema = z.object({
  classId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recordedBy: z.string().uuid(),
  records: z.array(z.object({
    studentId: z.string().uuid(),
    status: AttendanceStatusEnum,
    notes: z.string().optional(),
  })),
});

export type BulkAttendance = z.infer<typeof bulkAttendanceSchema>;
