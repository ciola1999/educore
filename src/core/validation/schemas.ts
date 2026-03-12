import { z } from "zod";

/**
 * EduCore Validation Schemas (2026 Elite Pattern)
 * Strict, Typed, and Shared across Web/Desktop
 */

export const UserRoleEnum = z.enum(["admin", "teacher", "staff", "student"]);
export const GenderEnum = z.enum(["L", "P"]);
export const AttendanceStatusEnum = z.enum([
  "present",
  "sick",
  "permission",
  "alpha",
  "late",
]);
export const SyncStatusEnum = z.enum(["synced", "pending", "error"]);

// --- AUTH ---
export const loginSchema = z.object({
  email: z.string().email({ message: "Email tidak valid" }),
  password: z.string().min(6, { message: "Password minimal 6 karakter" }),
});

// --- USER ---
export const userInsertSchema = z.object({
  id: z.string().uuid().optional(),
  fullName: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.string().email("Email tidak valid"),
  role: UserRoleEnum.default("teacher"),
  password: z.string().min(6, "Password min 6 karakter").optional(),
  nip: z.string().optional(),
  nis: z.string().optional(),
  isActive: z.boolean().default(true),
});

export type UserInsertInput = z.infer<typeof userInsertSchema>;

// --- ACADEMIC ---
export const classInsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Nama kelas wajib diisi"),
  academicYear: z.string().regex(/^\d{4}\/\d{4}$/, "Format: 2025/2026"),
  homeroomTeacherId: z.string().uuid().optional(),
});

export type ClassInsertInput = z.infer<typeof classInsertSchema>;

// --- ATTENDANCE ---
export const attendanceSettingsSchema = z.object({
  id: z.string().uuid().optional(),
  dayOfWeek: z.coerce.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  lateThreshold: z.string().regex(/^\d{2}:\d{2}$/),
  entityType: z.enum(["student", "employee"]),
  isActive: z.boolean().default(true),
});

export type AttendanceSettingsInput = z.infer<typeof attendanceSettingsSchema>;
