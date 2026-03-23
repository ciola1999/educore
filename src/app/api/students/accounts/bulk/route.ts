import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { requireRole } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import { hashPassword } from "@/lib/auth/hash";
import { auth } from "@/lib/auth/web/auth";
import { getDb } from "@/lib/db";
import { classes, students, users } from "@/lib/db/schema";
import {
  isUuidLikeClassValue,
  sanitizeClassDisplayName,
} from "@/lib/utils/class-name";

const bulkCreateStudentAccountsSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1, "Pilih minimal 1 siswa"),
  emailDomain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^(?=.{1,253}$)(?!-)[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,63}$/,
      "Domain email tidak valid",
    ),
  password: z.string().min(8, "Password default minimal 8 karakter"),
});

function normalizeEmailLocalPart(nis: string) {
  return nis.trim().toLowerCase().replace(/\s+/g, "");
}

function getAcademicYearLabel(): string {
  const year = new Date().getFullYear();
  return `${year}/${year + 1}`;
}

export async function POST(request: Request) {
  const session = await auth();
  const guard = requireRole(session, ["admin", "super_admin"]);
  if (guard) {
    return guard;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Payload tidak valid", 400, "INVALID_PAYLOAD");
  }

  const validation = bulkCreateStudentAccountsSchema.safeParse(body);
  if (!validation.success) {
    return apiError(
      validation.error.issues[0]?.message || "Data bulk akun siswa tidak valid",
      400,
      "VALIDATION_ERROR",
    );
  }

  const { studentIds, emailDomain, password } = validation.data;
  const db = await getDb();
  const studentRows = await db
    .select({
      id: students.id,
      nis: students.nis,
      nisn: students.nisn,
      fullName: students.fullName,
      gender: students.gender,
      grade: students.grade,
      tempatLahir: students.tempatLahir,
      tanggalLahir: students.tanggalLahir,
      alamat: students.alamat,
    })
    .from(students)
    .where(and(inArray(students.id, studentIds), isNull(students.deletedAt)));

  if (studentRows.length === 0) {
    return apiError("Data siswa tidak ditemukan", 404, "STUDENT_NOT_FOUND");
  }

  const existingAccounts = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        inArray(
          users.id,
          studentRows.map((student) => student.id),
        ),
        eq(users.role, "student"),
        eq(users.isActive, true),
        isNull(users.deletedAt),
      ),
    );
  const existingAccountSet = new Set(existingAccounts.map((item) => item.id));

  const candidates = studentRows.filter(
    (student) => !existingAccountSet.has(student.id),
  );

  if (candidates.length === 0) {
    return apiOk({
      created: 0,
      skipped: studentRows.length,
      message: "Semua siswa terpilih sudah memiliki akun.",
    });
  }

  const candidateEmails = candidates.map(
    (student) => `${normalizeEmailLocalPart(student.nis)}@${emailDomain}`,
  );
  const existingEmailRows = await db
    .select({ email: users.email })
    .from(users)
    .where(and(inArray(users.email, candidateEmails), isNull(users.deletedAt)));
  const existingEmailSet = new Set(existingEmailRows.map((item) => item.email));
  const rawGradeIds = Array.from(
    new Set(
      candidates
        .map((student) => student.grade?.trim())
        .filter((grade): grade is string => Boolean(grade))
        .filter((grade) => isUuidLikeClassValue(grade)),
    ),
  );
  const rawGradeClassRows =
    rawGradeIds.length > 0
      ? await db
          .select({ id: classes.id, name: classes.name })
          .from(classes)
          .where(
            and(inArray(classes.id, rawGradeIds), isNull(classes.deletedAt)),
          )
      : [];
  const classNameById = new Map(
    rawGradeClassRows.map((classRow) => [classRow.id, classRow.name]),
  );
  const classNames = Array.from(
    new Set(
      candidates
        .map((student) =>
          sanitizeClassDisplayName(
            student.grade,
            student.grade ? classNameById.get(student.grade.trim()) : null,
          ),
        )
        .filter((grade) => grade !== "UNASSIGNED"),
    ),
  );
  const classRows =
    classNames.length > 0
      ? await db
          .select({ id: classes.id, name: classes.name })
          .from(classes)
          .where(
            and(inArray(classes.name, classNames), isNull(classes.deletedAt)),
          )
      : [];
  const classIdByName = new Map(
    classRows.map((classRow) => [classRow.name.trim(), classRow.id]),
  );
  const missingClassNames = classNames.filter(
    (className) => !classIdByName.has(className),
  );
  const now = new Date();

  if (missingClassNames.length > 0) {
    const academicYear = getAcademicYearLabel();
    for (const className of missingClassNames) {
      const id = crypto.randomUUID();
      await db.insert(classes).values({
        id,
        name: className,
        academicYear,
        isActive: true,
        syncStatus: "pending",
        createdAt: now,
        updatedAt: now,
      });
      classIdByName.set(className, id);
    }
  }
  let created = 0;
  let skipped = studentRows.length - candidates.length;

  for (const student of candidates) {
    const email = `${normalizeEmailLocalPart(student.nis)}@${emailDomain}`;
    if (existingEmailSet.has(email)) {
      skipped += 1;
      continue;
    }

    const passwordHash = await hashPassword(password);
    await db.insert(users).values({
      id: student.id,
      fullName: student.fullName,
      email,
      role: "student",
      passwordHash,
      nis: student.nis,
      nisn: student.nisn,
      tempatLahir: student.tempatLahir,
      tanggalLahir: student.tanggalLahir,
      jenisKelamin: student.gender,
      alamat: student.alamat,
      kelasId: (() => {
        const grade = sanitizeClassDisplayName(
          student.grade,
          student.grade ? classNameById.get(student.grade.trim()) : null,
        );
        if (!grade || grade === "UNASSIGNED") {
          return null;
        }
        return classIdByName.get(grade) ?? null;
      })(),
      isActive: true,
      syncStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });
    created += 1;
  }

  return apiOk({
    created,
    skipped,
    message: `Berhasil membuat ${created} akun siswa, ${skipped} data dilewati.`,
  });
}
