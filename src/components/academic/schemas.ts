import { z } from "zod";

export const classFormSchema = z.object({
  name: z.string().trim().min(2, "Nama kelas minimal 2 karakter."),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}\/\d{4}$/, "Format tahun ajaran harus YYYY/YYYY."),
  homeroomTeacherId: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) =>
        value === undefined ||
        value === "" ||
        z.string().uuid().safeParse(value).success,
      "Pilih wali kelas yang valid.",
    ),
});

export const subjectFormSchema = z.object({
  name: z.string().trim().min(2, "Nama mata pelajaran minimal 2 karakter."),
  code: z.string().trim().min(2, "Kode mata pelajaran minimal 2 karakter."),
});

export const academicYearFormSchema = z
  .object({
    nama: z
      .string()
      .trim()
      .regex(/^\d{4}\/\d{4}$/, "Format tahun ajaran harus YYYY/YYYY."),
    tanggalMulai: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD."),
    tanggalSelesai: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD."),
    isActive: z.boolean(),
  })
  .refine(
    (value) => new Date(value.tanggalSelesai) >= new Date(value.tanggalMulai),
    {
      message: "Tanggal selesai harus setelah atau sama dengan tanggal mulai.",
      path: ["tanggalSelesai"],
    },
  );

export const semesterFormSchema = z
  .object({
    tahunAjaranId: z.string().uuid("Pilih tahun ajaran yang valid."),
    nama: z.string().trim().min(3, "Nama semester minimal 3 karakter."),
    tanggalMulai: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD."),
    tanggalSelesai: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD."),
    isActive: z.boolean(),
  })
  .refine(
    (value) => new Date(value.tanggalSelesai) >= new Date(value.tanggalMulai),
    {
      message: "Tanggal selesai harus setelah atau sama dengan tanggal mulai.",
      path: ["tanggalSelesai"],
    },
  );

export const teachingAssignmentFormSchema = z.object({
  guruId: z.string().uuid("Pilih guru yang valid."),
  mataPelajaranId: z.string().uuid("Pilih mata pelajaran yang valid."),
  kelasId: z.string().uuid("Pilih kelas yang valid."),
  semesterId: z.string().uuid("Pilih semester yang valid."),
});

export const jadwalFormSchema = z
  .object({
    guruMapelId: z.string().uuid("Pilih assignment guru-mapel yang valid."),
    hari: z.number().int().min(0).max(6),
    jamMulai: z
      .string()
      .trim()
      .regex(/^\d{2}:\d{2}$/, "Format jam harus HH:MM."),
    jamSelesai: z
      .string()
      .trim()
      .regex(/^\d{2}:\d{2}$/, "Format jam harus HH:MM."),
    ruangan: z.string().trim().max(100).optional(),
  })
  .refine((value) => value.jamSelesai > value.jamMulai, {
    message: "Jam selesai harus setelah jam mulai.",
    path: ["jamSelesai"],
  });

export type ClassFormValues = z.infer<typeof classFormSchema>;
export type SubjectFormValues = z.infer<typeof subjectFormSchema>;
export type AcademicYearFormValues = z.infer<typeof academicYearFormSchema>;
export type SemesterFormValues = z.infer<typeof semesterFormSchema>;
export type TeachingAssignmentFormValues = z.infer<
  typeof teachingAssignmentFormSchema
>;
export type JadwalFormValues = z.infer<typeof jadwalFormSchema>;

export type TeacherOption = {
  id: string;
  fullName: string;
};

export type NamedOption = {
  id: string;
  name: string;
};

export type AcademicYearOption = {
  id: string;
  nama: string;
};

export type SemesterOption = {
  id: string;
  nama: string;
  tahunAjaranId: string;
};

export type ClassItem = {
  id: string;
  name: string;
  academicYear: string;
  homeroomTeacherId: string | null;
  homeroomTeacherName: string | null;
};

export type SubjectItem = {
  id: string;
  name: string;
  code: string;
};

export type AcademicYearItem = {
  id: string;
  nama: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  isActive: boolean;
};

export type SemesterItem = {
  id: string;
  tahunAjaranId: string;
  tahunAjaranNama: string | null;
  nama: string;
  tanggalMulai: string | Date;
  tanggalSelesai: string | Date;
  isActive: boolean;
};

export type TeachingAssignmentItem = {
  id: string;
  guruId: string;
  guruName: string;
  mataPelajaranId: string;
  mataPelajaranName: string;
  mataPelajaranCode: string;
  kelasId: string;
  kelasName: string;
  semesterId: string;
  semesterName: string;
  tahunAjaranNama: string | null;
};

export type TeachingAssignmentScheduleOption = {
  id: string;
  guruName: string;
  mataPelajaranName: string;
  kelasName: string;
  semesterName: string;
  tahunAjaranNama: string | null;
};

export type JadwalItem = {
  id: string;
  guruMapelId: string;
  hari: number;
  jamMulai: string;
  jamSelesai: string;
  ruangan: string | null;
  guruName: string;
  mataPelajaranName: string;
  mataPelajaranCode: string;
  kelasName: string;
  semesterName: string;
  tahunAjaranNama: string | null;
};

export type LegacyScheduleAuditStatus =
  | "already_canonical"
  | "ready_to_backfill"
  | "ambiguous_assignment"
  | "missing_assignment";

export type LegacyScheduleAuditItem = {
  legacyScheduleId: string;
  classId: string;
  className: string | null;
  subjectId: string;
  subjectName: string | null;
  teacherId: string;
  teacherName: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  status: LegacyScheduleAuditStatus;
  matchingAssignments: Array<{
    id: string;
    guruName: string | null;
    mataPelajaranName: string | null;
    kelasName: string | null;
    semesterName: string | null;
    tahunAjaranNama: string | null;
  }>;
};

export type LegacyScheduleAuditReport = {
  legacyTableAvailable: boolean;
  totalLegacyRows: number;
  filteredRows: number;
  summary: Record<LegacyScheduleAuditStatus, number>;
  items: LegacyScheduleAuditItem[];
};

export type LegacyScheduleAuditSummary = {
  totalLegacyRows: number;
  actionableRows: number;
  summary: Record<LegacyScheduleAuditStatus, number>;
};

export type LegacyScheduleRepairResponse = {
  legacyScheduleId: string;
  canonicalJadwalId: string;
  guruMapelId: string;
  action: "created" | "reused";
};

export type BulkLegacyScheduleRepairResponse = {
  processed: number;
  created: number;
  reused: number;
  skipped: number;
  failures: Array<{
    legacyScheduleId: string;
    code: string;
    error: string;
  }>;
};

export type BulkArchiveCanonicalLegacyScheduleResponse = {
  processed: number;
  archived: number;
  skipped: number;
  failures: Array<{
    legacyScheduleId: string;
    code: string;
    error: string;
  }>;
};
