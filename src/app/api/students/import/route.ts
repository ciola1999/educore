import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { requireRole } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";
import { getDb } from "@/lib/db";
import { classes, students, users } from "@/lib/db/schema";
import {
  isUuidLikeClassValue,
  sanitizeClassDisplayName,
} from "@/lib/utils/class-name";

const importOptionsSchema = z.object({
  updateExisting: z.boolean().default(true),
});

type ImportRowError = {
  row: number;
  message: string;
  nis?: string;
};

type ParsedStudentRow = {
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

type SheetRowsExtraction = {
  rows: Record<string, unknown>[];
  headerRowIndex: number;
};

const COLUMN_ALIASES = {
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

function getAcademicYearLabel(): string {
  const year = new Date().getFullYear();
  return `${year}/${year + 1}`;
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

function parseGender(value: unknown): "L" | "P" | null {
  const raw = asTrimmedString(value).toLowerCase();
  if (!raw) return null;

  const maleSet = new Set(["l", "male", "m", "laki-laki", "laki laki", "lk"]);
  const femaleSet = new Set(["p", "female", "f", "perempuan", "wanita", "pr"]);

  if (maleSet.has(raw)) return "L";
  if (femaleSet.has(raw)) return "P";
  return null;
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

function parseRows(
  rawRows: Record<string, unknown>[],
  headerRowIndex: number,
): {
  parsed: ParsedStudentRow[];
  errors: ImportRowError[];
} {
  const parsed: ParsedStudentRow[] = [];
  const errors: ImportRowError[] = [];
  const nisSet = new Set<string>();

  rawRows.forEach((rawRow, index) => {
    const rowNumber = headerRowIndex + index + 2;
    const nis = asTrimmedString(pickCell(rawRow, COLUMN_ALIASES.nis));
    const fullName = asTrimmedString(pickCell(rawRow, COLUMN_ALIASES.fullName));
    const grade = sanitizeClassDisplayName(
      asTrimmedString(pickCell(rawRow, COLUMN_ALIASES.grade)),
    );
    const gender = parseGender(pickCell(rawRow, COLUMN_ALIASES.gender));
    const nisnRaw = asTrimmedString(pickCell(rawRow, COLUMN_ALIASES.nisn));
    const tanggalLahir = parseDateValue(
      pickCell(rawRow, COLUMN_ALIASES.tanggalLahir),
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
        asTrimmedString(pickCell(rawRow, COLUMN_ALIASES.parentName)) || null,
      parentPhone:
        asTrimmedString(pickCell(rawRow, COLUMN_ALIASES.parentPhone)) || null,
      tempatLahir:
        asTrimmedString(pickCell(rawRow, COLUMN_ALIASES.tempatLahir)) || null,
      tanggalLahir,
      alamat: asTrimmedString(pickCell(rawRow, COLUMN_ALIASES.alamat)) || null,
    });
  });

  return { parsed, errors };
}

function extractRowsFromSheet(
  sheet: unknown,
  XLSX: typeof import("xlsx"),
): SheetRowsExtraction {
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
    return { rows: [], headerRowIndex: 0 };
  }

  const columnMatchers = {
    nis: new Set<string>(COLUMN_ALIASES.nis),
    fullName: new Set<string>(COLUMN_ALIASES.fullName),
    gender: new Set<string>(COLUMN_ALIASES.gender),
    grade: new Set<string>(COLUMN_ALIASES.grade),
  };

  let bestIndex = 0;
  let bestScore = -1;

  for (let i = 0; i < Math.min(matrix.length, 15); i++) {
    const row = matrix[i] || [];
    const normalizedCells = row.map((cell) =>
      normalizeHeader(asTrimmedString(cell)),
    );
    let score = 0;

    const hasNis = normalizedCells.some((cell) => columnMatchers.nis.has(cell));
    const hasName = normalizedCells.some((cell) =>
      columnMatchers.fullName.has(cell),
    );
    const hasGender = normalizedCells.some((cell) =>
      columnMatchers.gender.has(cell),
    );
    const hasGrade = normalizedCells.some((cell) =>
      columnMatchers.grade.has(cell),
    );

    if (hasNis) score += 2;
    if (hasName) score += 2;
    if (hasGender) score += 1;
    if (hasGrade) score += 1;

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
      for (let i = 0; i < header.length; i++) {
        record[header[i]] = cells?.[i] ?? "";
      }
      return record;
    })
    .filter((row) =>
      Object.values(row).some((value) => asTrimmedString(value) !== ""),
    );

  return { rows, headerRowIndex: bestIndex };
}

export async function POST(request: Request) {
  const session = await auth();
  const guard = requireRole(session, ["admin", "super_admin"]);
  if (guard) {
    return guard;
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("Payload form-data tidak valid", 400, "INVALID_PAYLOAD");
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return apiError("File Excel wajib diunggah", 400, "FILE_REQUIRED");
  }

  const options = importOptionsSchema.safeParse({
    updateExisting: formData.get("updateExisting") !== "false",
  });
  if (!options.success) {
    return apiError("Opsi import tidak valid", 400, "VALIDATION_ERROR");
  }

  const ext = file.name.toLowerCase().split(".").pop();
  if (!ext || !["xlsx", "xls", "csv", "xlsm"].includes(ext)) {
    return apiError(
      "Format file tidak didukung. Gunakan .xlsx, .xls, atau .csv",
      400,
      "UNSUPPORTED_FILE",
    );
  }

  const buffer = await file.arrayBuffer();
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return apiError("Sheet Excel tidak ditemukan", 400, "EMPTY_SHEET");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const { rows: rawRows, headerRowIndex } = extractRowsFromSheet(sheet, XLSX);

  if (rawRows.length === 0) {
    return apiError("File Excel kosong", 400, "EMPTY_FILE");
  }

  const { parsed, errors } = parseRows(rawRows, headerRowIndex);
  if (parsed.length === 0) {
    return apiError(
      "Tidak ada baris valid untuk diproses",
      400,
      "NO_VALID_ROWS",
      {
        headers: {
          "x-import-header-row": String(headerRowIndex + 1),
          "x-import-errors": JSON.stringify(errors.slice(0, 20)),
        },
      },
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
    if (classIdByName.has(gradeName)) {
      continue;
    }

    const classId = crypto.randomUUID();
    await db.insert(classes).values({
      id: classId,
      name: gradeName,
      academicYear: getAcademicYearLabel(),
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
      if (!options.data.updateExisting) {
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
            row.grade !== "UNASSIGNED" ? classIdByName.get(row.grade) : null,
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

  return apiOk({
    totalRows: rawRows.length,
    validRows: parsed.length,
    created,
    updated,
    skipped,
    errorCount: errors.length,
    errors: errors.slice(0, 20),
  });
}
