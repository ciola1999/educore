import { z } from "zod";

// --- 1. AUTHENTICATION ---
export const loginSchema = z.object({
  email: z.string().email({ message: "Email tidak valid" }),
  password: z.string().min(6, { message: "Password minimal 6 karakter" }),
});

// --- 2. USER MANAGEMENT (Guru/Staff/Admin) ---
export const userInsertSchema = z.object({
  id: z.string().optional(), // Optional saat edit, atau auto-generate
  fullName: z.string().min(3, { message: "Nama lengkap minimal 3 karakter" }),
  email: z.string().email({ message: "Format email salah" }),
  
  // ✅ FIX: Hapus custom errorMap yang menyebabkan crash overloading
  // Menggunakan default value sudah cukup aman.
  role: z.enum(["admin", "teacher", "staff"]).default("teacher"),
  
  // Password opsional: 
  // - Wajib jika user baru (biasanya)
  // - Kosongkan jika tidak ingin mengganti password saat edit
  password: z.string().min(6, { message: "Password minimal 6 karakter" }).optional(),
  
  // Internal use (jika hashing dilakukan di luar service ini)
  passwordHash: z.string().optional(),
});

// --- 3. ATTENDANCE SCANNER ---
export const scanSchema = z.object({
  nis: z.string()
    .min(3, { message: "NIS tidak valid/terbaca" })
    .max(50)
    .trim(), // Auto remove whitespace
  timestamp: z.number().optional(),
});

// --- 4. ATTENDANCE SETTINGS ---
export const attendanceSettingsSchema = z.object({
  id: z.string().optional(),
  dayOfWeek: z.coerce.number().min(0).max(6), // 0=Minggu, 6=Sabtu
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Format jam salah (HH:MM)"),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Format jam salah"),
  lateThreshold: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Format jam salah"),
  entityType: z.enum(["student", "employee"]),
  isActive: z.boolean().default(true),
});

// --- EXPORT TYPES ---
export type LoginInput = z.infer<typeof loginSchema>;
export type UserInsertInput = z.infer<typeof userInsertSchema>;
export type ScanInput = z.infer<typeof scanSchema>;
export type AttendanceSettingsInput = z.infer<typeof attendanceSettingsSchema>;