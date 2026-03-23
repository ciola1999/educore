import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { AUTH_ROLES, type AuthRole } from "@/core/auth/roles";
import { requireRole } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import { hashPassword } from "@/lib/auth/hash";
import { auth } from "@/lib/auth/web/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

const importOptionsSchema = z.object({
  updateExisting: z.boolean().default(true),
  defaultRole: z.enum(["teacher", "staff", "admin"]).default("teacher"),
  defaultPassword: z.string().min(8, "Password default minimal 8 karakter"),
  resetPasswordOnUpdate: z.boolean().default(false),
});

type ImportRowError = {
  row: number;
  message: string;
  email?: string;
};

type ParsedUserRow = {
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

const COLUMN_ALIASES = {
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
  if (value === null || value === undefined) return "";
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
  if (!mapped) return null;
  if (!AUTH_ROLES.includes(mapped)) return null;
  return mapped;
}

function parseDateValue(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const raw = asTrimmedString(value);
  if (!raw) return null;

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    const byDmy = new Date(Date.UTC(year, month - 1, day));
    if (!Number.isNaN(byDmy.getTime())) return byDmy;
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

function parseRows(
  rawRows: Record<string, unknown>[],
  defaults: { role: AuthRole; password: string },
): { parsed: ParsedUserRow[]; errors: ImportRowError[] } {
  const parsed: ParsedUserRow[] = [];
  const errors: ImportRowError[] = [];
  const emailSet = new Set<string>();

  rawRows.forEach((rawRow, index) => {
    const row = index + 2;
    const fullName = asTrimmedString(pickCell(rawRow, COLUMN_ALIASES.fullName));
    const email = asTrimmedString(pickCell(rawRow, COLUMN_ALIASES.email))
      .toLowerCase()
      .trim();
    const role = parseRole(
      pickCell(rawRow, COLUMN_ALIASES.role),
      defaults.role,
    );
    const passwordCell = asTrimmedString(
      pickCell(rawRow, COLUMN_ALIASES.password),
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
      nip: asTrimmedString(pickCell(rawRow, COLUMN_ALIASES.nip)) || null,
      jenisKelamin: parseGender(pickCell(rawRow, COLUMN_ALIASES.jenisKelamin)),
      tempatLahir:
        asTrimmedString(pickCell(rawRow, COLUMN_ALIASES.tempatLahir)) || null,
      tanggalLahir: parseDateValue(
        pickCell(rawRow, COLUMN_ALIASES.tanggalLahir),
      ),
      alamat: asTrimmedString(pickCell(rawRow, COLUMN_ALIASES.alamat)) || null,
      noTelepon:
        asTrimmedString(pickCell(rawRow, COLUMN_ALIASES.noTelepon)) || null,
      isActive: parseBoolean(pickCell(rawRow, COLUMN_ALIASES.isActive), true),
    });
  });

  return { parsed, errors };
}

export async function POST(request: Request) {
  const session = await auth();
  const guard = requireRole(session, ["admin", "super_admin"]);
  if (guard) return guard;

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

  const optionParse = importOptionsSchema.safeParse({
    updateExisting: formData.get("updateExisting") !== "false",
    defaultRole: formData.get("defaultRole") || "teacher",
    defaultPassword: formData.get("defaultPassword") || "",
    resetPasswordOnUpdate: formData.get("resetPasswordOnUpdate") === "true",
  });
  if (!optionParse.success) {
    return apiError(
      optionParse.error.issues[0]?.message || "Opsi import tidak valid",
      400,
      "VALIDATION_ERROR",
    );
  }

  const ext = file.name.toLowerCase().split(".").pop();
  if (!ext || !["xlsx", "xls", "csv"].includes(ext)) {
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
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: true,
  });
  if (rawRows.length === 0) {
    return apiError("File Excel kosong", 400, "EMPTY_FILE");
  }

  const { parsed, errors } = parseRows(rawRows, {
    role: optionParse.data.defaultRole,
    password: optionParse.data.defaultPassword,
  });
  if (parsed.length === 0) {
    return apiError(
      "Tidak ada baris valid untuk diproses",
      400,
      "NO_VALID_ROWS",
    );
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

      if (!optionParse.data.updateExisting) {
        skipped += 1;
        continue;
      }

      await db
        .update(users)
        .set({
          fullName: row.fullName,
          role: row.role,
          passwordHash:
            optionParse.data.resetPasswordOnUpdate || row.password !== null
              ? await hashPassword(
                  row.password || optionParse.data.defaultPassword,
                )
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
      passwordHash: await hashPassword(
        row.password || optionParse.data.defaultPassword,
      ),
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
