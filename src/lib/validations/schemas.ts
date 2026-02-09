import { z } from "zod";

// ================================
// 1. ENUMS & SHARED
// ================================
export const UserRoleEnum = z.enum(["admin", "teacher", "staff"]);
export const GenderEnum = z.enum(["L", "P"]);

export const AttendanceStatusEnum = z.enum([
  "present",
  "sick",
  "permission",
  "alpha",
]);
// ✅ INI YANG SEBELUMNYA KURANG:
export type AttendanceStatus = z.infer<typeof AttendanceStatusEnum>;

export const SyncStatusEnum = z.enum(["synced", "pending", "error"]);

// ================================
// 2. AUTHENTICATION
// ================================
export const loginSchema = z.object({
  email: z.string().email({ message: "Email tidak valid" }),
  password: z.string().min(6, { message: "Password minimal 6 karakter" }),
});
export type LoginInput = z.infer<typeof loginSchema>;

// ================================
// 3. USER MANAGEMENT
// ================================
export const userInsertSchema = z.object({
  id: z.string().uuid().optional(),
  fullName: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.string().email("Email tidak valid"),
  role: UserRoleEnum.default("teacher"),
  password: z.string().min(6, "Password min 6 karakter").optional(),
  passwordHash: z.string().optional(),
  syncStatus: SyncStatusEnum.default("pending"),
});

export const userSelectSchema = userInsertSchema.extend({
  id: z.string(),
  createdAt: z.number().nullable(),
  updatedAt: z.number().nullable(),
});

export type UserInsert = z.infer<typeof userInsertSchema>;
export type UserInsertInput = z.input<typeof userInsertSchema>;
export type UserSelect = z.infer<typeof userSelectSchema>;

// ================================
// 4. STUDENT SCHEMA
// ================================
export const studentInsertSchema = z.object({
  id: z.string().uuid().optional(),
  nis: z.string().min(5, "NIS minimal 5 karakter"),
  fullName: z.string().min(2, "Nama minimal 2 karakter"),
  gender: GenderEnum,
  grade: z.string().min(1, "Kelas wajib diisi"),
  parentName: z.string().optional(),
  parentPhone: z
    .string()
    .regex(/^[0-9+\-\s]+$/, "Nomor HP tidak valid")
    .optional(),
});

export const studentSelectSchema = studentInsertSchema.extend({
  id: z.string(),
  createdAt: z.number().nullable(),
  updatedAt: z.number().nullable(),
});

export type StudentInsert = z.infer<typeof studentInsertSchema>;
export type StudentSelect = z.infer<typeof studentSelectSchema>;

// ================================
// 5. CLASS SCHEMA
// ================================
export const classInsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Nama kelas wajib diisi"),
  academicYear: z.string().regex(/^\d{4}\/\d{4}$/, "Format: 2025/2026"),
  homeroomTeacherId: z.string().uuid().optional(),
});

export const classSelectSchema = classInsertSchema.extend({
  id: z.string(),
  updatedAt: z.number().nullable(),
});

export type ClassInsert = z.infer<typeof classInsertSchema>;
export type ClassSelect = z.infer<typeof classSelectSchema>;

// ================================
// 6. SUBJECT SCHEMA
// ================================
export const subjectInsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Nama mata pelajaran wajib diisi"),
  code: z.string().min(2, "Kode minimal 2 karakter").toUpperCase(),
});

export const subjectSelectSchema = subjectInsertSchema.extend({
  id: z.string(),
  updatedAt: z.number().nullable(),
});

export type SubjectInsert = z.infer<typeof subjectInsertSchema>;
export type SubjectSelect = z.infer<typeof subjectSelectSchema>;

// ================================
// 7. SCHEDULE SCHEMA
// ================================
export const scheduleInsertSchema = z.object({
  id: z.string().uuid().optional(),
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  teacherId: z.string().uuid(),
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Format: HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Format: HH:MM"),
});

export const scheduleSelectSchema = scheduleInsertSchema.extend({
  id: z.string(),
  updatedAt: z.number().nullable(),
});

export type ScheduleInsert = z.infer<typeof scheduleInsertSchema>;
export type ScheduleSelect = z.infer<typeof scheduleSelectSchema>;

// ================================
// 8. ATTENDANCE SCANNER
// ================================
export const scanSchema = z.object({
  nis: z.string().min(3).max(50).trim(),
  timestamp: z.number().optional(),
});
export type ScanInput = z.infer<typeof scanSchema>;

// ================================
// 9. ATTENDANCE MANUAL/JURNAL
// ================================
export const attendanceInsertSchema = z.object({
  id: z.string().uuid().optional(),
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format: YYYY-MM-DD"),
  status: AttendanceStatusEnum,
  notes: z.string().max(500).optional(),
  recordedBy: z.string().uuid(),
  syncStatus: SyncStatusEnum.default("pending"),
});

export const attendanceSelectSchema = attendanceInsertSchema.extend({
  id: z.string(),
  createdAt: z.number().nullable(),
});

export type AttendanceInsert = z.infer<typeof attendanceInsertSchema>;
export type AttendanceInsertInput = z.input<typeof attendanceInsertSchema>;
export type AttendanceSelect = z.infer<typeof attendanceSelectSchema>;

// ================================
// 10. ATTENDANCE SETTINGS
// ================================
export const attendanceSettingsSchema = z.object({
  id: z.string().optional(),
  dayOfWeek: z.coerce.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  lateThreshold: z.string().regex(/^\d{2}:\d{2}$/),
  entityType: z.enum(["student", "employee"]),
  isActive: z.boolean().default(true),
});
export type AttendanceSettingsInput = z.infer<typeof attendanceSettingsSchema>;

// ================================
// 11. BULK OPERATIONS
// ================================
export const bulkAttendanceSchema = z.object({
  classId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recordedBy: z.string().uuid(),
  records: z.array(
    z.object({
      studentId: z.string().uuid(),
      status: AttendanceStatusEnum,
      notes: z.string().optional(),
    }),
  ),
});

export type BulkAttendance = z.infer<typeof bulkAttendanceSchema>;