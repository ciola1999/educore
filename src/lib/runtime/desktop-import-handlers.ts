import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { AUTH_ROLES, type AuthRole } from "@/core/auth/roles";
import { hashPassword } from "@/lib/auth/hash";
import { getDb } from "@/lib/db";
import { classes, students, users } from "@/lib/db/schema";
import {
  isUuidLikeClassValue,
  sanitizeClassDisplayName,
} from "@/lib/utils/class-name";

type DesktopRouteErrorInit = {
  code: string;
  message: string;
  status: number;
};

class DesktopRouteError extends Error {
  code: string;
  status: number;

  constructor(init: DesktopRouteErrorInit) {
    super(init.message);
    this.code = init.code;
    this.status = init.status;
  }
}

type StudentImportRowError = {
  row: number;
  message: string;
  nis?: string;
};

type ParsedStudentImportRow = {
  row: number;
  nis: string;
  nisn: string | null;
  fullName: string;
  gender: "L" | "P";
  grade: string;
  parentName: string | null;
  parentPhone: string | null;
  tempatLahir: string | null;
  tanggalLahir: Date | null;
  alamat: string | null;
};

type TeacherImportRowError = {
  row: number;
  message: string;
  email?: string;
};

type ParsedTeacherImportRow = {
  row: number;
  fullName: string;
  email: string;
  role: AuthRole;
  password: string | null;
  nip: string | null;
  jenisKelamin: "L" | "P" | null;
  tempatLahir: string | null;
  tanggalLahir: Date | null;
  alamat: string | null;
  noTelepon: string | null;
  isActive: boolean;
};

const studentImportRequestSchema = z.object({
  fileName: z.string().trim().min(1, "Nama file import wajib diisi"),
  fileDataBase64: z
    .string()
    .trim()
    .min(1, "Isi file import wajib dikirim ke runtime desktop"),
  updateExisting: z.boolean().default(true),
});

const teacherImportRequestSchema = z.object({
  fileName: z.string().trim().min(1, "Nama file import user wajib diisi"),
  fileDataBase64: z
    .string()
    .trim()
    .min(1, "Isi file import user wajib dikirim ke runtime desktop"),
  updateExisting: z.boolean().default(true),
  defaultRole: z.enum(["teacher", "staff", "admin"]).default("teacher"),
  defaultPassword: z.string().min(8, "Password default minimal 8 karakter"),
  resetPasswordOnUpdate: z.boolean().default(false),
});

const STUDENT_COLUMN_ALIASES = {
  nis: ["nis", "nomor induk siswa", "nomor_induk_siswa"],
  nisn: ["nisn"],
  fullName: [
    "nama",
    "nama lengkap",
    "nama_lengkap",
    "full name",
    "full_name",
    "fullname",
  ],
  gender: ["jenis kelamin", "jenis_kelamin", "gender", "jk", "sex", "kelamin"],
  grade: ["kelas", "grade", "class", "rombel"],
  parentName: ["nama wali", "nama_wali", "wali", "parent name", "parent_name"],
  parentPhone: [
    "no hp wali",
    "no_hp_wali",
    "parent phone",
    "parent_phone",
    "telp wali",
    "telepon wali",
    "hp wali",
  ],
  tempatLahir: ["tempat lahir", "tempat_lahir", "birth place", "birth_place"],
  tanggalLahir: ["tanggal lahir", "tanggal_lahir", "birth date", "birth_date"],
  alamat: ["alamat", "address"],
} as const;

const TEACHER_COLUMN_ALIASES = {
  fullName: [
    "nama",
    "nama lengkap",
    "nama_lengkap",
    "full name",
    "full_name",
    "fullname",
  ],
  email: ["email", "email login", "email_login", "username"],
  role: ["role", "peran", "jabatan"],
  password: ["password", "kata sandi", "kata_sandi"],
  nip: ["nip", "nik pegawai", "nomor induk pegawai"],
  jenisKelamin: [
    "jenis kelamin",
    "jenis_kelamin",
    "gender",
    "jk",
    "sex",
    "kelamin",
  ],
  tempatLahir: ["tempat lahir", "tempat_lahir", "birth place", "birth_place"],
  tanggalLahir: ["tanggal lahir", "tanggal_lahir", "birth date", "birth_date"],
  alamat: ["alamat", "address"],
  noTelepon: ["no telepon", "no_telepon", "telepon", "phone", "no hp", "no_hp"],
  isActive: ["aktif", "is active", "is_active", "status aktif", "status_aktif"],
} as const;

function fail(message: string, status: number, code: string): never {
  throw new DesktopRouteError({ message, status, code });
}

function normalizeHeader(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_]/gu, "")
    .replace(/\s+/g, " ");
}

function pickCell(
  row: Record<string, unknown>,
  aliases: readonly string[],
): unknown {
  const entries = Object.entries(row);
  for (const [key, value] of entries) {
    const normalized = normalizeHeader(key);
    if (
      aliases.some(
        (alias) => normalized === alias || normalized.startsWith(`${alias} `),
      )
    ) {
      return value;
    }
  }
  return undefined;
}

function asTrimmedString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function normalizeExcelDigitString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (Number.isInteger(value)) {
      return String(value);
    }

    return String(value).replace(/\.0+$/, "").trim();
  }

  const raw = asTrimmedString(value);
  if (!raw) {
    return "";
  }

  const compact = raw.replace(/\s+/g, "");
  if (/^\d+\.0+$/.test(compact)) {
    return compact.replace(/\.0+$/, "");
  }

  if (/^\d+(\.\d+)?e[+-]?\d+$/i.test(compact)) {
    const numeric = Number(compact);
    if (Number.isFinite(numeric) && Number.isInteger(numeric)) {
      return String(numeric);
    }
  }

  return compact;
}

function parseGender(value: unknown): "L" | "P" | null {
  const raw = asTrimmedString(value).toLowerCase();
  if (!raw) return null;

  const maleSet = new Set(["l", "male", "m", "laki-laki", "laki laki", "lk"]);
  const femaleSet = new Set(["p", "female", "f", "perempuan", "wanita", "pr"]);

  if (maleSet.has(raw)) return "L";
  if (femaleSet.has(raw)) return "P";
  return null;
}

function parseRole(value: unknown, fallback: AuthRole): AuthRole | null {
  const raw = asTrimmedString(value).toLowerCase();
  if (!raw) return fallback;

  const roleMap: Record<string, AuthRole> = {
    teacher: "teacher",
    guru: "teacher",
    staff: "staff",
    staf: "staff",
    admin: "admin",
    super_admin: "super_admin",
    "super admin": "super_admin",
  };

  const mapped = roleMap[raw];
  if (!mapped || !AUTH_ROLES.includes(mapped)) {
    return null;
  }

  return mapped;
}

function parseDateValue(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const raw = asTrimmedString(value);
  if (!raw) return null;

  const isoParsed = new Date(raw);
  if (!Number.isNaN(isoParsed.getTime())) {
    return isoParsed;
  }

  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function parseBoolean(value: unknown, fallback = true): boolean {
  const raw = asTrimmedString(value).toLowerCase();
  if (!raw) return fallback;
  if (["1", "true", "yes", "ya", "aktif", "active"].includes(raw)) return true;
  if (["0", "false", "no", "tidak", "nonaktif", "inactive"].includes(raw)) {
    return false;
  }
  return fallback;
}

function decodeBase64ToArrayBuffer(base64: string) {
  const binary = atob(base64.trim());
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return bytes.buffer;
}

function getStudentAcademicYearLabel(): string {
  const year = new Date().getFullYear();
  return `${year}/${year + 1}`;
}

function extractStudentRowsFromSheet(
  sheet: unknown,
  XLSX: typeof import("xlsx"),
) {
  const matrix = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(
    sheet as never,
    {
      header: 1,
      defval: "",
      raw: true,
      blankrows: false,
    },
  );

  if (matrix.length === 0) {
    return { rows: [] as Record<string, unknown>[], headerRowIndex: 0 };
  }

  const columnMatchers = {
    nis: new Set<string>(STUDENT_COLUMN_ALIASES.nis),
    fullName: new Set<string>(STUDENT_COLUMN_ALIASES.fullName),
    gender: new Set<string>(STUDENT_COLUMN_ALIASES.gender),
    grade: new Set<string>(STUDENT_COLUMN_ALIASES.grade),
  };

  let bestIndex = 0;
  let bestScore = -1;

  for (let i = 0; i < Math.min(matrix.length, 15); i += 1) {
    const row = matrix[i] || [];
    const normalizedCells = row.map((cell) =>
      normalizeHeader(asTrimmedString(cell)),
    );
    let score = 0;

    if (normalizedCells.some((cell) => columnMatchers.nis.has(cell)))
      score += 2;
    if (normalizedCells.some((cell) => columnMatchers.fullName.has(cell))) {
      score += 2;
    }
    if (normalizedCells.some((cell) => columnMatchers.gender.has(cell))) {
      score += 1;
    }
    if (normalizedCells.some((cell) => columnMatchers.grade.has(cell))) {
      score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  const header = (matrix[bestIndex] || []).map((cell, idx) => {
    const value = asTrimmedString(cell);
    return value || `column_${idx + 1}`;
  });

  const rows = matrix
    .slice(bestIndex + 1)
    .map((cells) => {
      const record: Record<string, unknown> = {};
      for (let i = 0; i < header.length; i += 1) {
        record[header[i]] = cells?.[i] ?? "";
      }
      return record;
    })
    .filter((row) =>
      Object.values(row).some((value) => asTrimmedString(value)),
    );

  return { rows, headerRowIndex: bestIndex };
}

function parseStudentRows(
  rawRows: Record<string, unknown>[],
  headerRowIndex: number,
): {
  parsed: ParsedStudentImportRow[];
  errors: StudentImportRowError[];
} {
  const parsed: ParsedStudentImportRow[] = [];
  const errors: StudentImportRowError[] = [];
  const nisSet = new Set<string>();

  rawRows.forEach((rawRow, index) => {
    const rowNumber = headerRowIndex + index + 2;
    const nis = normalizeExcelDigitString(
      pickCell(rawRow, STUDENT_COLUMN_ALIASES.nis),
    );
    const fullName = asTrimmedString(
      pickCell(rawRow, STUDENT_COLUMN_ALIASES.fullName),
    );
    const grade = sanitizeClassDisplayName(
      asTrimmedString(pickCell(rawRow, STUDENT_COLUMN_ALIASES.grade)),
    );
    const gender = parseGender(pickCell(rawRow, STUDENT_COLUMN_ALIASES.gender));
    const nisnRaw = normalizeExcelDigitString(
      pickCell(rawRow, STUDENT_COLUMN_ALIASES.nisn),
    );
    const tanggalLahir = parseDateValue(
      pickCell(rawRow, STUDENT_COLUMN_ALIASES.tanggalLahir),
    );

    if (!nis || nis.length < 5) {
      errors.push({
        row: rowNumber,
        message: "NIS wajib diisi dan minimal 5 karakter",
      });
      return;
    }
    if (nisSet.has(nis)) {
      errors.push({
        row: rowNumber,
        message: "NIS duplikat dalam file import",
        nis,
      });
      return;
    }
    nisSet.add(nis);

    if (!fullName || fullName.length < 2) {
      errors.push({
        row: rowNumber,
        message: "Nama lengkap wajib diisi minimal 2 karakter",
        nis,
      });
      return;
    }

    if (!grade) {
      errors.push({
        row: rowNumber,
        message: "Kelas wajib diisi",
        nis,
      });
      return;
    }

    if (!gender) {
      errors.push({
        row: rowNumber,
        message:
          "Jenis kelamin tidak valid (gunakan L/P atau Laki-laki/Perempuan)",
        nis,
      });
      return;
    }

    if (nisnRaw && !/^\d{10}$/.test(nisnRaw)) {
      errors.push({
        row: rowNumber,
        message: "NISN harus 10 digit angka jika diisi",
        nis,
      });
      return;
    }

    parsed.push({
      row: rowNumber,
      nis,
      nisn: nisnRaw || null,
      fullName,
      gender,
      grade,
      parentName:
        asTrimmedString(pickCell(rawRow, STUDENT_COLUMN_ALIASES.parentName)) ||
        null,
      parentPhone:
        asTrimmedString(pickCell(rawRow, STUDENT_COLUMN_ALIASES.parentPhone)) ||
        null,
      tempatLahir:
        asTrimmedString(pickCell(rawRow, STUDENT_COLUMN_ALIASES.tempatLahir)) ||
        null,
      tanggalLahir,
      alamat:
        asTrimmedString(pickCell(rawRow, STUDENT_COLUMN_ALIASES.alamat)) ||
        null,
    });
  });

  return { parsed, errors };
}

function parseTeacherRows(
  rawRows: Record<string, unknown>[],
  defaults: { role: AuthRole; password: string },
): {
  parsed: ParsedTeacherImportRow[];
  errors: TeacherImportRowError[];
} {
  const parsed: ParsedTeacherImportRow[] = [];
  const errors: TeacherImportRowError[] = [];
  const emailSet = new Set<string>();

  rawRows.forEach((rawRow, index) => {
    const row = index + 2;
    const fullName = asTrimmedString(
      pickCell(rawRow, TEACHER_COLUMN_ALIASES.fullName),
    );
    const email = asTrimmedString(
      pickCell(rawRow, TEACHER_COLUMN_ALIASES.email),
    )
      .toLowerCase()
      .trim();
    const role = parseRole(
      pickCell(rawRow, TEACHER_COLUMN_ALIASES.role),
      defaults.role,
    );
    const passwordCell = asTrimmedString(
      pickCell(rawRow, TEACHER_COLUMN_ALIASES.password),
    );
    const password = passwordCell || null;
    const effectivePassword = password || defaults.password;

    if (!fullName || fullName.length < 2) {
      errors.push({
        row,
        message: "Nama lengkap wajib diisi minimal 2 karakter",
        email: email || undefined,
      });
      return;
    }
    if (!email || !z.string().email().safeParse(email).success) {
      errors.push({
        row,
        message: "Email wajib valid",
        email: email || undefined,
      });
      return;
    }
    if (emailSet.has(email)) {
      errors.push({ row, message: "Email duplikat dalam file import", email });
      return;
    }
    emailSet.add(email);

    if (!role) {
      errors.push({ row, message: "Role tidak valid", email });
      return;
    }

    if (effectivePassword.length < 8) {
      errors.push({
        row,
        message:
          "Password minimal 8 karakter (kolom password/default password)",
        email,
      });
      return;
    }

    parsed.push({
      row,
      fullName,
      email,
      role,
      password,
      nip:
        asTrimmedString(pickCell(rawRow, TEACHER_COLUMN_ALIASES.nip)) || null,
      jenisKelamin: parseGender(
        pickCell(rawRow, TEACHER_COLUMN_ALIASES.jenisKelamin),
      ),
      tempatLahir:
        asTrimmedString(pickCell(rawRow, TEACHER_COLUMN_ALIASES.tempatLahir)) ||
        null,
      tanggalLahir: parseDateValue(
        pickCell(rawRow, TEACHER_COLUMN_ALIASES.tanggalLahir),
      ),
      alamat:
        asTrimmedString(pickCell(rawRow, TEACHER_COLUMN_ALIASES.alamat)) ||
        null,
      noTelepon:
        asTrimmedString(pickCell(rawRow, TEACHER_COLUMN_ALIASES.noTelepon)) ||
        null,
      isActive: parseBoolean(
        pickCell(rawRow, TEACHER_COLUMN_ALIASES.isActive),
        true,
      ),
    });
  });

  return { parsed, errors };
}

export async function handleDesktopStudentImportRequest(body: unknown) {
  const validation = studentImportRequestSchema.safeParse(body);
  if (!validation.success) {
    fail(
      validation.error.issues[0]?.message || "Payload import siswa tidak valid",
      400,
      "VALIDATION_ERROR",
    );
  }

  const { fileName, fileDataBase64, updateExisting } = validation.data;
  const ext = fileName.toLowerCase().split(".").pop();
  if (!ext || !["xlsx", "xls", "csv", "xlsm"].includes(ext)) {
    fail(
      "Format file tidak didukung. Gunakan .xlsx, .xls, atau .csv",
      400,
      "UNSUPPORTED_FILE",
    );
  }

  const XLSX = await import("xlsx");
  const workbook = XLSX.read(decodeBase64ToArrayBuffer(fileDataBase64), {
    type: "array",
    cellDates: true,
  });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    fail("Sheet Excel tidak ditemukan", 400, "EMPTY_SHEET");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const { rows: rawRows, headerRowIndex } = extractStudentRowsFromSheet(
    sheet,
    XLSX,
  );
  if (rawRows.length === 0) {
    fail("File Excel kosong", 400, "EMPTY_FILE");
  }

  const { parsed, errors } = parseStudentRows(rawRows, headerRowIndex);
  if (parsed.length === 0) {
    const firstError = errors[0];
    fail(
      `Tidak ada baris valid untuk diproses (header terdeteksi di baris ${headerRowIndex + 1})${firstError ? `; contoh error: baris ${firstError.row} - ${firstError.message}` : ""}`,
      400,
      "NO_VALID_ROWS",
    );
  }

  const db = await getDb();
  const now = new Date();
  const nisList = parsed.map((row) => row.nis);
  const gradeNames = Array.from(
    new Set(
      parsed
        .map((row) => row.grade)
        .filter((grade) => grade !== "UNASSIGNED")
        .filter((grade) => !isUuidLikeClassValue(grade)),
    ),
  );

  const existingStudents = await db
    .select({
      id: students.id,
      nis: students.nis,
      deletedAt: students.deletedAt,
    })
    .from(students)
    .where(inArray(students.nis, nisList));
  const existingStudentByNis = new Map(
    existingStudents.map((row) => [row.nis, row]),
  );
  const classRows =
    gradeNames.length > 0
      ? await db
          .select({ id: classes.id, name: classes.name })
          .from(classes)
          .where(
            and(inArray(classes.name, gradeNames), isNull(classes.deletedAt)),
          )
      : [];
  const classIdByName = new Map(
    classRows.map((classRow) => [classRow.name.trim(), classRow.id]),
  );

  for (const gradeName of gradeNames) {
    if (classIdByName.has(gradeName)) continue;

    const classId = crypto.randomUUID();
    await db.insert(classes).values({
      id: classId,
      name: gradeName,
      academicYear: getStudentAcademicYearLabel(),
      isActive: true,
      syncStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });
    classIdByName.set(gradeName, classId);
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of parsed) {
    const existing = existingStudentByNis.get(row.nis);

    if (existing) {
      if (!updateExisting) {
        skipped += 1;
        continue;
      }

      await db
        .update(students)
        .set({
          nis: row.nis,
          nisn: row.nisn,
          fullName: row.fullName,
          gender: row.gender,
          grade: row.grade,
          parentName: row.parentName,
          parentPhone: row.parentPhone,
          tempatLahir: row.tempatLahir,
          tanggalLahir: row.tanggalLahir,
          alamat: row.alamat,
          deletedAt: null,
          syncStatus: "pending",
          updatedAt: now,
        })
        .where(eq(students.id, existing.id));

      await db
        .update(users)
        .set({
          fullName: row.fullName,
          nis: row.nis,
          nisn: row.nisn,
          jenisKelamin: row.gender,
          tempatLahir: row.tempatLahir,
          tanggalLahir: row.tanggalLahir,
          alamat: row.alamat,
          kelasId:
            row.grade !== "UNASSIGNED"
              ? (classIdByName.get(row.grade) ?? null)
              : null,
          syncStatus: "pending",
          updatedAt: now,
        })
        .where(
          and(
            eq(users.id, existing.id),
            eq(users.role, "student"),
            isNull(users.deletedAt),
          ),
        );

      updated += 1;
      continue;
    }

    await db.insert(students).values({
      id: crypto.randomUUID(),
      nis: row.nis,
      nisn: row.nisn,
      fullName: row.fullName,
      gender: row.gender,
      grade: row.grade,
      parentName: row.parentName,
      parentPhone: row.parentPhone,
      tempatLahir: row.tempatLahir,
      tanggalLahir: row.tanggalLahir,
      alamat: row.alamat,
      syncStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });
    created += 1;
  }

  return {
    totalRows: rawRows.length,
    validRows: parsed.length,
    created,
    updated,
    skipped,
    errorCount: errors.length,
    errors: errors.slice(0, 20),
  };
}

export async function handleDesktopTeacherImportRequest(body: unknown) {
  const validation = teacherImportRequestSchema.safeParse(body);
  if (!validation.success) {
    fail(
      validation.error.issues[0]?.message || "Payload import user tidak valid",
      400,
      "VALIDATION_ERROR",
    );
  }

  const {
    fileName,
    fileDataBase64,
    updateExisting,
    defaultRole,
    defaultPassword,
    resetPasswordOnUpdate,
  } = validation.data;
  const ext = fileName.toLowerCase().split(".").pop();
  if (!ext || !["xlsx", "xls", "csv"].includes(ext)) {
    fail(
      "Format file tidak didukung. Gunakan .xlsx, .xls, atau .csv",
      400,
      "UNSUPPORTED_FILE",
    );
  }

  const XLSX = await import("xlsx");
  const workbook = XLSX.read(decodeBase64ToArrayBuffer(fileDataBase64), {
    type: "array",
    cellDates: true,
  });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    fail("Sheet Excel tidak ditemukan", 400, "EMPTY_SHEET");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: true,
  });
  if (rawRows.length === 0) {
    fail("File Excel kosong", 400, "EMPTY_FILE");
  }

  const { parsed, errors } = parseTeacherRows(rawRows, {
    role: defaultRole,
    password: defaultPassword,
  });
  if (parsed.length === 0) {
    fail("Tidak ada baris valid untuk diproses", 400, "NO_VALID_ROWS");
  }

  const db = await getDb();
  const now = new Date();
  const emails = parsed.map((row) => row.email);
  const existingUsers = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(inArray(users.email, emails));
  const existingByEmail = new Map(existingUsers.map((row) => [row.email, row]));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of parsed) {
    const existing = existingByEmail.get(row.email);

    if (existing) {
      const existingRole = existing.role as AuthRole;
      if (existingRole === "student" || existingRole === "parent") {
        errors.push({
          row: row.row,
          message: `Email sudah dipakai akun role ${existingRole}, dilewati`,
          email: row.email,
        });
        skipped += 1;
        continue;
      }

      if (!updateExisting) {
        skipped += 1;
        continue;
      }

      await db
        .update(users)
        .set({
          fullName: row.fullName,
          role: row.role,
          passwordHash:
            resetPasswordOnUpdate || row.password !== null
              ? await hashPassword(row.password || defaultPassword)
              : undefined,
          nip: row.nip,
          jenisKelamin: row.jenisKelamin,
          tempatLahir: row.tempatLahir,
          tanggalLahir: row.tanggalLahir,
          alamat: row.alamat,
          noTelepon: row.noTelepon,
          isActive: row.isActive,
          deletedAt: null,
          syncStatus: "pending",
          updatedAt: now,
        })
        .where(eq(users.id, existing.id));
      updated += 1;
      continue;
    }

    await db.insert(users).values({
      id: crypto.randomUUID(),
      fullName: row.fullName,
      email: row.email,
      role: row.role,
      passwordHash: await hashPassword(row.password || defaultPassword),
      nip: row.nip,
      jenisKelamin: row.jenisKelamin,
      tempatLahir: row.tempatLahir,
      tanggalLahir: row.tanggalLahir,
      alamat: row.alamat,
      noTelepon: row.noTelepon,
      isActive: row.isActive,
      syncStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });
    created += 1;
  }

  return {
    totalRows: rawRows.length,
    validRows: parsed.length,
    created,
    updated,
    skipped,
    errorCount: errors.length,
    errors: errors.slice(0, 20),
  };
}

export function toDesktopRouteErrorResponse(error: unknown) {
  if (error instanceof DesktopRouteError) {
    return {
      status: error.status,
      code: error.code,
      message: error.message,
    };
  }

  return {
    status: 500,
    code: "DESKTOP_IMPORT_FAILED",
    message:
      error instanceof Error ? error.message : "Desktop import gagal diproses",
  };
}
