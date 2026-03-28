import { z } from "zod";
import { AUTH_ROLE_DEFAULT, AUTH_ROLES } from "@/core/auth/roles";

// ================================
// 1. ENUMS & SHARED
// ================================
export const UserRoleEnum = z.enum(AUTH_ROLES);
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
  role: UserRoleEnum.default(AUTH_ROLE_DEFAULT),
  password: z.string().min(8, "Password min 8 karakter"),
  nip: z.string().max(32).optional().nullable(),
  jenisKelamin: GenderEnum.optional().nullable(),
  tempatLahir: z.string().max(100).optional().nullable(),
  tanggalLahir: z.coerce.date().optional().nullable(),
  alamat: z.string().max(255).optional().nullable(),
  noTelepon: z.string().max(32).optional().nullable(),
  foto: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional().default(true),
  passwordHash: z.string().optional(),
  syncStatus: SyncStatusEnum.default("pending"),
});

export const userUpdateSchema = z.object({
  fullName: z.string().min(2, "Nama minimal 2 karakter").optional(),
  email: z.string().email("Email tidak valid").optional(),
  role: UserRoleEnum.optional(),
  password: z.string().min(8, "Password min 8 karakter").optional(),
  nip: z.string().max(32).optional().nullable(),
  jenisKelamin: GenderEnum.optional().nullable(),
  tempatLahir: z.string().max(100).optional().nullable(),
  tanggalLahir: z.coerce.date().optional().nullable(),
  alamat: z.string().max(255).optional().nullable(),
  noTelepon: z.string().max(32).optional().nullable(),
  foto: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const userSelectSchema = userInsertSchema.extend({
  id: z.string(),
  createdAt: z.number().nullable(),
  updatedAt: z.number().nullable(),
});

export type UserInsert = z.infer<typeof userInsertSchema>;
export type UserInsertInput = z.input<typeof userInsertSchema>;
export type UserUpdateInput = z.input<typeof userUpdateSchema>;
export type UserSelect = z.infer<typeof userSelectSchema>;

// ================================
// 4. STUDENT SCHEMA
// ================================
export const studentInsertSchema = z.object({
  id: z.string().uuid().optional(),
  nis: z.string().min(5, "NIS minimal 5 karakter"),
  nisn: z
    .string()
    .regex(/^[0-9]{10}$/, "NISN harus 10 digit angka")
    .optional()
    .or(z.literal("")),
  email: z.string().email("Email tidak valid").optional().or(z.literal("")),
  fullName: z.string().min(2, "Nama minimal 2 karakter"),
  gender: GenderEnum,
  grade: z.string().min(1, "Kelas wajib diisi"),
  tempatLahir: z.string().max(100).optional(),
  tanggalLahir: z.coerce.date().optional(),
  alamat: z.string().max(255).optional(),
  parentName: z.string().optional(),
  parentPhone: z
    .string()
    .regex(/^[0-9+\-\s]+$/, "Nomor HP tidak valid")
    .optional(),
});

export const studentUpdateSchema = z.object({
  nis: z.string().min(5, "NIS minimal 5 karakter").optional(),
  nisn: z
    .string()
    .regex(/^[0-9]{10}$/, "NISN harus 10 digit angka")
    .optional()
    .or(z.literal("")),
  email: z.string().email("Email tidak valid").optional().or(z.literal("")),
  fullName: z.string().min(2, "Nama minimal 2 karakter").optional(),
  gender: GenderEnum.optional(),
  grade: z.string().min(1, "Kelas wajib diisi").optional(),
  tempatLahir: z.string().max(100).optional().or(z.literal("")),
  tanggalLahir: z.coerce.date().optional(),
  alamat: z.string().max(255).optional().or(z.literal("")),
  parentName: z.string().optional().or(z.literal("")),
  parentPhone: z
    .string()
    .regex(/^[0-9+\-\s]+$/, "Nomor HP tidak valid")
    .optional()
    .or(z.literal("")),
});

export const studentSelectSchema = studentInsertSchema.extend({
  id: z.string(),
  createdAt: z.number().nullable(),
  updatedAt: z.number().nullable(),
});

export type StudentInsert = z.infer<typeof studentInsertSchema>;
export type StudentUpdateInput = z.input<typeof studentUpdateSchema>;
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
// 7. ACADEMIC YEAR / SEMESTER / TEACHING ASSIGNMENT
// ================================
export const academicYearInsertSchema = z
  .object({
    id: z.string().uuid().optional(),
    nama: z.string().regex(/^\d{4}\/\d{4}$/, "Format: 2025/2026"),
    tanggalMulai: z.coerce.date(),
    tanggalSelesai: z.coerce.date(),
    isActive: z.boolean().optional().default(false),
  })
  .refine((value) => value.tanggalSelesai >= value.tanggalMulai, {
    message: "Tanggal selesai harus setelah atau sama dengan tanggal mulai",
    path: ["tanggalSelesai"],
  });

export const semesterInsertSchema = z
  .object({
    id: z.string().uuid().optional(),
    tahunAjaranId: z.string().uuid(),
    nama: z.string().min(3, "Nama semester minimal 3 karakter"),
    tanggalMulai: z.coerce.date(),
    tanggalSelesai: z.coerce.date(),
    isActive: z.boolean().optional().default(false),
  })
  .refine((value) => value.tanggalSelesai >= value.tanggalMulai, {
    message: "Tanggal selesai harus setelah atau sama dengan tanggal mulai",
    path: ["tanggalSelesai"],
  });

export const teacherSubjectInsertSchema = z.object({
  id: z.string().uuid().optional(),
  guruId: z.string().uuid(),
  mataPelajaranId: z.string().uuid(),
  kelasId: z.string().uuid(),
  semesterId: z.string().uuid(),
});

export type AcademicYearInsert = z.infer<typeof academicYearInsertSchema>;
export type SemesterInsert = z.infer<typeof semesterInsertSchema>;
export type TeacherSubjectInsert = z.infer<typeof teacherSubjectInsertSchema>;

// ================================
// 8. SCHEDULE SCHEMA
// ================================
// Canonical Phase 2.2 schedule model follows `jadwal` and references
// `guruMapel` so class/subject/teacher/semester truth stays derived from
// stable master data 2.1 instead of duplicated flat fields.
export const jadwalInsertSchema = z
  .object({
    id: z.string().uuid().optional(),
    guruMapelId: z.string().uuid(),
    hari: z.number().int().min(0).max(6),
    jamMulai: z.string().regex(/^\d{2}:\d{2}$/, "Format: HH:MM"),
    jamSelesai: z.string().regex(/^\d{2}:\d{2}$/, "Format: HH:MM"),
    ruangan: z.string().trim().max(100).optional().nullable(),
  })
  .refine((value) => value.jamSelesai > value.jamMulai, {
    message: "Jam selesai harus setelah jam mulai",
    path: ["jamSelesai"],
  });

export const jadwalSelectSchema = jadwalInsertSchema.safeExtend({
  id: z.string(),
  updatedAt: z.number().nullable(),
});

export type JadwalInsert = z.infer<typeof jadwalInsertSchema>;
export type JadwalSelect = z.infer<typeof jadwalSelectSchema>;

// Legacy flat schedule schema kept only for compatibility audit paths and
// old data access. Do not use this as new source of truth for Phase 2.2.
export const scheduleInsertSchema = z
  .object({
    id: z.string().uuid().optional(),
    classId: z.string().uuid(),
    subjectId: z.string().uuid(),
    teacherId: z.string().uuid(),
    dayOfWeek: z.number().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Format: HH:MM"),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Format: HH:MM"),
  })
  .superRefine((_value, context) => {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "Legacy schedule flat sudah deprecated. Gunakan jadwal canonical berbasis guruMapelId.",
    });
  });

export const scheduleSelectSchema = scheduleInsertSchema.safeExtend({
  id: z.string(),
  updatedAt: z.number().nullable(),
});

/** @deprecated Prefer `JadwalInsert` based on `guruMapelId`. */
export type ScheduleInsert = z.infer<typeof scheduleInsertSchema>;
/** @deprecated Prefer `JadwalSelect` based on `guruMapelId`. */
export type ScheduleSelect = z.infer<typeof scheduleSelectSchema>;

// ================================
// 9. ATTENDANCE SCANNER
// ================================
export const scanSchema = z.object({
  nis: z.string().min(3).max(50).trim(),
  timestamp: z.number().optional(),
});
export type ScanInput = z.infer<typeof scanSchema>;

// ================================
// 10. ATTENDANCE MANUAL/JURNAL
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
// 11. ATTENDANCE SETTINGS
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

export const qrScanSchema = z.object({
  qrData: z.string().trim().min(3).max(512),
});
export type QrScanInput = z.infer<typeof qrScanSchema>;

export const holidayInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().min(2).max(120),
});

export const attendanceHistoryFilterSchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  studentId: z.string().optional(),
  status: z.string().optional(),
  source: z.enum(["all", "qr", "manual"]).optional().default("all"),
  sortBy: z.enum(["earliest", "latest"]).optional().default("latest"),
  limit: z.number().int().min(1).max(500).optional().default(100),
  searchQuery: z.string().optional(),
});
export type AttendanceHistoryFilter = z.infer<
  typeof attendanceHistoryFilterSchema
>;

// ================================
// 12. BULK OPERATIONS
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
export type BulkAttendanceInput = z.infer<typeof bulkAttendanceSchema>;
