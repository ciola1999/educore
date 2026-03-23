import { z } from "zod";

export const classFormSchema = z.object({
  name: z.string().trim().min(2, "Nama kelas minimal 2 karakter."),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}\/\d{4}$/, "Format tahun ajaran harus YYYY/YYYY."),
  homeroomTeacherId: z.string().uuid("Pilih wali kelas yang valid."),
});

export const subjectFormSchema = z.object({
  name: z.string().trim().min(2, "Nama mata pelajaran minimal 2 karakter."),
  code: z.string().trim().min(2, "Kode mata pelajaran minimal 2 karakter."),
});

export type ClassFormValues = z.infer<typeof classFormSchema>;
export type SubjectFormValues = z.infer<typeof subjectFormSchema>;

export type TeacherOption = {
  id: string;
  fullName: string;
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
