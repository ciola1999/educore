import { and, desc, eq, inArray, isNull, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import { AUTH_ROLES, type AuthRole } from "@/core/auth/roles";
import { isTauri } from "@/core/env";
import {
  type AttendanceHistoryFilter,
  addHoliday,
  createAttendanceRiskFollowUp,
  deleteAttendanceSetting,
  deleteHoliday,
  getAttendanceHistory,
  getAttendanceHistoryAnalyticsBundle,
  getAttendanceHistoryClassSummary,
  getAttendanceHistoryCount,
  getAttendanceHistoryExportRows,
  getAttendanceHistoryHeatmap,
  getAttendanceHistoryStudentOptions,
  getAttendanceHistoryStudentSummary,
  getAttendanceHistorySummary,
  getAttendanceHistoryTrend,
  getAttendanceRiskAssignmentSummary,
  getAttendanceRiskFollowUpAuditTrail,
  getAttendanceRiskFollowUpHistory,
  getAttendanceRiskNotificationSummary,
  getAttendanceRiskNotifications,
  getAttendanceRiskSettings,
  getAttendanceRiskStudents,
  getAttendanceRosterStudents,
  getAttendanceSettings,
  getHolidays,
  getTodayAttendanceRecords,
  markAttendanceRiskNotificationRead,
  processQRScan,
  recordBulkAttendance,
  updateAttendanceRiskFollowUp,
  upsertAttendanceRiskSettings,
  upsertAttendanceSetting,
} from "@/core/services/attendance-service";
import { qrScanSchema } from "@/core/validation/schemas";
import { hashPassword } from "@/lib/auth/hash";
import {
  checkAnyPermission,
  checkPermission,
  hasRole,
  type Permission,
} from "@/lib/auth/rbac";
import {
  buildLoginEmailCandidates,
  normalizeLoginIdentifier,
} from "@/lib/auth/web/login-identifier";
import { getDb } from "@/lib/db";
import {
  attendance,
  classes,
  studentDailyAttendance,
  students,
  users,
} from "@/lib/db/schema";
import { handleDesktopAcademicRoute } from "@/lib/runtime/desktop-academic-route";
import { handleDesktopAttendanceRoute } from "@/lib/runtime/desktop-attendance-route";
import { handleDesktopAuthRoute } from "@/lib/runtime/desktop-auth-route";
import {
  handleDesktopStudentImportRequest,
  toDesktopRouteErrorResponse,
} from "@/lib/runtime/desktop-import-handlers";
import {
  apiError,
  apiOk,
  type DesktopApiResponse,
} from "@/lib/runtime/desktop-route-response";
import { handleDesktopStudentsRoute } from "@/lib/runtime/desktop-students-route";
import { handleDesktopSyncRoute } from "@/lib/runtime/desktop-sync-route";
import { handleDesktopTeachersRoute } from "@/lib/runtime/desktop-teachers-route";
import {
  addAcademicYear,
  addClass,
  addSchedule,
  addSemester,
  addSubject,
  addTeachingAssignment,
  deleteAcademicYear,
  deleteClass,
  deleteSchedule,
  deleteSemester,
  deleteSubject,
  deleteTeachingAssignment,
  getAcademicYears,
  getClasses,
  getSchedules,
  getSemesters,
  getSubjects,
  getTeachingAssignmentScheduleOptions,
  getTeachingAssignments,
  updateAcademicYear,
  updateClass,
  updateSchedule,
  updateSemester,
  updateSubject,
  updateTeachingAssignment,
} from "@/lib/services/academic";
import { getDashboardStats } from "@/lib/services/dashboard";
import { getLegacyScheduleAuditReport } from "@/lib/services/legacy-schedule-audit";
import {
  bulkArchiveAlreadyCanonicalLegacySchedules,
  bulkRepairReadyLegacySchedules,
  repairLegacySchedule,
} from "@/lib/services/legacy-schedule-repair";
import { syncUsersToStudentsProjection } from "@/lib/services/student-projection";
import { useStore } from "@/lib/store/use-store";
import { pullFromCloud, pushToCloud } from "@/lib/sync/turso-sync";
import {
  isUuidLikeClassValue,
  sanitizeClassDisplayName,
} from "@/lib/utils/class-name";
import {
  studentInsertSchema,
  studentUpdateSchema,
} from "@/lib/validations/schemas";

type DesktopAuthUserRow = {
  id: string;
  fullName: string;
  email: string;
  role: AuthRole;
  version: number;
  nip: string | null;
  nis: string | null;
  nisn: string | null;
  tempatLahir: string | null;
  tanggalLahir: Date | null;
  jenisKelamin: "L" | "P" | null;
  alamat: string | null;
  noTelepon: string | null;
  foto: string | null;
  kelasId: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  provider: string | null;
  providerId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  hlc: string | null;
  syncStatus: "synced" | "pending" | "error";
  passwordHash: string | null;
};

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 5 * 60 * 1000;
const loginAttemptMap = new Map<
  string,
  {
    count: number;
    firstAttemptAt: number;
  }
>();

function getDesktopUser() {
  return useStore.getState().user;
}

function isSupportedRole(role: string): role is AuthRole {
  return AUTH_ROLES.includes(role as AuthRole);
}

function buildDesktopSession(row: DesktopAuthUserRow) {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    role: row.role,
    version: row.version,
    hlc: row.hlc,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
    syncStatus: row.syncStatus,
    nip: row.nip,
    nis: row.nis,
    nisn: row.nisn,
    tempatLahir: row.tempatLahir,
    tanggalLahir: row.tanggalLahir,
    jenisKelamin: row.jenisKelamin,
    alamat: row.alamat,
    noTelepon: row.noTelepon,
    foto: row.foto,
    kelasId: row.kelasId,
    isActive: row.isActive,
    lastLoginAt: row.lastLoginAt,
    provider: row.provider,
    providerId: row.providerId,
  };
}

function consumeDesktopRateLimit(identifier: string) {
  const now = Date.now();
  const current = loginAttemptMap.get(identifier);

  if (current && now - current.firstAttemptAt <= LOCKOUT_WINDOW_MS) {
    if (current.count >= MAX_LOGIN_ATTEMPTS) {
      return {
        allowed: false,
        retryAfterMs: LOCKOUT_WINDOW_MS - (now - current.firstAttemptAt),
      };
    }

    loginAttemptMap.set(identifier, {
      count: current.count + 1,
      firstAttemptAt: current.firstAttemptAt,
    });
    return { allowed: true, retryAfterMs: 0 };
  }

  loginAttemptMap.set(identifier, {
    count: 1,
    firstAttemptAt: now,
  });
  return { allowed: true, retryAfterMs: 0 };
}

function resetDesktopRateLimit(identifier: string) {
  loginAttemptMap.delete(identifier);
}

function isDesktopOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

async function verifyDesktopPassword(password: string, hash: string) {
  const { invoke } = await import("@tauri-apps/api/core");
  const result = await invoke<{ success: boolean }>("verify_password", {
    request: {
      password,
      stored_hash: hash,
    },
  });
  return result.success;
}

async function hashDesktopPassword(password: string) {
  const { invoke } = await import("@tauri-apps/api/core");
  const result = await invoke<{
    success: boolean;
    hash?: string;
    error?: string;
  }>("set_password", {
    request: {
      user_id: "desktop-user",
      password,
      is_first_time: false,
    },
  });

  if (!result.success || !result.hash) {
    throw new Error(result.error || "Gagal membuat hash password");
  }

  return result.hash;
}

async function getDesktopAuthUserById(userId: string) {
  const db = await getDb();
  const userRows = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
      version: users.version,
      passwordHash: users.passwordHash,
      nip: users.nip,
      nis: users.nis,
      nisn: users.nisn,
      tempatLahir: users.tempatLahir,
      tanggalLahir: users.tanggalLahir,
      jenisKelamin: users.jenisKelamin,
      alamat: users.alamat,
      noTelepon: users.noTelepon,
      foto: users.foto,
      kelasId: users.kelasId,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      provider: users.provider,
      providerId: users.providerId,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      deletedAt: users.deletedAt,
      hlc: users.hlc,
      syncStatus: users.syncStatus,
    })
    .from(users)
    .where(
      and(
        eq(users.id, userId),
        eq(users.isActive, true),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  const userRow = userRows[0];
  if (!userRow || !isSupportedRole(userRow.role)) {
    return null;
  }

  return {
    ...userRow,
    role: userRow.role,
  } satisfies DesktopAuthUserRow;
}

async function getDesktopAuthUserByIdentifier(identifier: string) {
  const db = await getDb();
  const emailCandidates = buildLoginEmailCandidates(identifier);
  const userRows = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
      version: users.version,
      passwordHash: users.passwordHash,
      nip: users.nip,
      nis: users.nis,
      nisn: users.nisn,
      tempatLahir: users.tempatLahir,
      tanggalLahir: users.tanggalLahir,
      jenisKelamin: users.jenisKelamin,
      alamat: users.alamat,
      noTelepon: users.noTelepon,
      foto: users.foto,
      kelasId: users.kelasId,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      provider: users.provider,
      providerId: users.providerId,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      deletedAt: users.deletedAt,
      hlc: users.hlc,
      syncStatus: users.syncStatus,
    })
    .from(users)
    .where(
      and(
        eq(users.isActive, true),
        isNull(users.deletedAt),
        or(
          inArray(users.email, emailCandidates),
          eq(users.nip, identifier),
          eq(users.nis, identifier),
        ),
      ),
    )
    .limit(1);

  const userRow = userRows[0];
  if (!userRow || !isSupportedRole(userRow.role)) {
    return null;
  }

  return {
    ...userRow,
    role: userRow.role,
  } satisfies DesktopAuthUserRow;
}

async function runDesktopAuthRepairSync(reason: string) {
  try {
    await syncUsersToStudentsProjection();
  } catch (error) {
    console.warn(
      `[DESKTOP_AUTH] Local attendance projection sync failed during ${reason}.`,
      error,
    );
  }

  if (isDesktopOffline()) {
    console.info(
      `[DESKTOP_AUTH] Skipping cloud pull during ${reason} because desktop runtime is offline.`,
    );
    return {
      repaired: false,
      message: "OFFLINE_DESKTOP_LOCAL_ONLY",
    };
  }

  try {
    const syncResult = await pullFromCloud();
    if (syncResult.status === "error") {
      console.warn(
        `[DESKTOP_AUTH] Cloud pull skipped during ${reason}: ${syncResult.message}`,
      );
      return {
        repaired: false,
        message: syncResult.message,
      };
    }
  } catch (error) {
    console.warn(
      `[DESKTOP_AUTH] Cloud pull unavailable during ${reason}. Continuing with local data.`,
      error,
    );
    return {
      repaired: false,
      message: error instanceof Error ? error.message : "SYNC_PULL_UNAVAILABLE",
    };
  }

  try {
    await syncUsersToStudentsProjection();
  } catch (error) {
    console.warn(
      `[DESKTOP_AUTH] Attendance projection resync failed after cloud pull during ${reason}.`,
      error,
    );
  }

  return {
    repaired: true,
    message: null,
  };
}

async function repairDesktopOperationalState(userId: string) {
  const repairResult = await runDesktopAuthRepairSync("login repair");
  if (!repairResult.repaired) {
    return;
  }

  const refreshedUser = await getDesktopAuthUserById(userId);
  if (refreshedUser) {
    useStore.getState().login(buildDesktopSession(refreshedUser));
  }
}

async function handleDesktopLogin(body: unknown) {
  const payload = body as {
    email?: string;
    password?: string;
  };
  const identifier = normalizeLoginIdentifier(payload.email ?? "");
  const password = payload.password?.trim() ?? "";

  if (!identifier || !password) {
    return apiError("Email atau password salah", 400, "INVALID_CREDENTIALS");
  }

  const rateLimit = consumeDesktopRateLimit(identifier);
  if (!rateLimit.allowed) {
    return apiError(
      `Akun terkunci sementara. Coba lagi dalam ${Math.ceil(
        rateLimit.retryAfterMs / 1000 / 60,
      )} menit.`,
      429,
      "RATE_LIMITED",
    );
  }

  const db = await getDb();
  let userRow = await getDesktopAuthUserByIdentifier(identifier);
  let isValidPassword = Boolean(
    userRow?.passwordHash &&
      (await verifyDesktopPassword(password, userRow.passwordHash)),
  );

  if (!userRow || !isValidPassword) {
    const repairResult = await runDesktopAuthRepairSync("credential repair");
    if (repairResult.repaired) {
      userRow = await getDesktopAuthUserByIdentifier(identifier);
      isValidPassword = Boolean(
        userRow?.passwordHash &&
          (await verifyDesktopPassword(password, userRow.passwordHash)),
      );
    }
  }

  if (!userRow || !isValidPassword) {
    return apiError("Email atau password salah", 401, "INVALID_CREDENTIALS");
  }

  resetDesktopRateLimit(identifier);

  const now = new Date();
  await db
    .update(users)
    .set({
      lastLoginAt: now,
      updatedAt: now,
      syncStatus: "pending",
    })
    .where(eq(users.id, userRow.id));

  const sessionUser = buildDesktopSession({
    ...userRow,
    role: userRow.role,
    lastLoginAt: now,
    updatedAt: now,
  });

  useStore.getState().login(sessionUser);
  void repairDesktopOperationalState(userRow.id);
  return apiOk({ user: sessionUser });
}

async function handleDesktopChangePassword(body: unknown) {
  const payload = body as {
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  };
  const sessionUser = getDesktopUser();
  const currentPassword = payload.currentPassword?.trim() ?? "";
  const newPassword = payload.newPassword ?? "";
  const confirmPassword = payload.confirmPassword ?? "";

  if (!sessionUser?.id) {
    return apiError("Unauthorized", 401, "UNAUTHORIZED");
  }

  if (!currentPassword) {
    return apiError("Password saat ini wajib diisi", 400, "VALIDATION_ERROR");
  }

  if (newPassword.length < 8) {
    return apiError(
      "Password baru minimal 8 karakter",
      400,
      "VALIDATION_ERROR",
    );
  }

  if (newPassword !== confirmPassword) {
    return apiError("Konfirmasi password tidak cocok", 400, "VALIDATION_ERROR");
  }

  if (currentPassword === newPassword) {
    return apiError(
      "Password baru tidak boleh sama dengan password saat ini",
      400,
      "VALIDATION_ERROR",
    );
  }

  const db = await getDb();
  const userRows = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(
      and(
        eq(users.id, sessionUser.id),
        eq(users.isActive, true),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  let userRow = userRows[0];
  if (!userRow?.passwordHash) {
    return apiError("Akun tidak ditemukan", 404, "USER_NOT_FOUND");
  }

  let isCurrentValid = await verifyDesktopPassword(
    currentPassword,
    userRow.passwordHash,
  );

  if (!isCurrentValid) {
    const repairResult = await runDesktopAuthRepairSync(
      "password verification repair",
    );

    if (repairResult.repaired) {
      const repairedRows = await db
        .select({
          id: users.id,
          passwordHash: users.passwordHash,
        })
        .from(users)
        .where(
          and(
            eq(users.id, sessionUser.id),
            eq(users.isActive, true),
            isNull(users.deletedAt),
          ),
        )
        .limit(1);

      userRow = repairedRows[0];
      isCurrentValid = Boolean(
        userRow?.passwordHash &&
          (await verifyDesktopPassword(currentPassword, userRow.passwordHash)),
      );
    }
  }

  if (!isCurrentValid) {
    return apiError("Password saat ini salah", 400, "INVALID_CURRENT_PASSWORD");
  }

  const nextHash = await hashDesktopPassword(newPassword);
  await db
    .update(users)
    .set({
      passwordHash: nextHash,
      syncStatus: "pending",
      updatedAt: new Date(),
      version: sql`${users.version} + 1`,
    })
    .where(eq(users.id, sessionUser.id));

  const pushResult = await pushToCloud({ tables: ["users"] });
  const syncStatus = pushResult.status === "success" ? "synced" : "pending";

  if (pushResult.status === "error") {
    console.warn(
      `[DESKTOP_AUTH] Password changed locally but cloud sync is pending: ${pushResult.message}`,
    );
  }

  return apiOk({
    changed: true,
    syncStatus,
    syncMessage: pushResult.message,
  });
}

function ensureRole(roles: Array<"admin" | "super_admin">) {
  const user = getDesktopUser();
  if (!user) {
    return apiError("Unauthorized", 401);
  }
  if (!hasRole(user, roles)) {
    return apiError("Forbidden", 403);
  }
  return null;
}

function ensurePermission(permission: Permission) {
  const user = getDesktopUser();
  if (!user) {
    return apiError("Unauthorized", 401);
  }
  if (!checkPermission(user, permission)) {
    return apiError("Forbidden", 403);
  }
  return null;
}

function ensureAnyPermission(permissions: Permission[]) {
  const user = getDesktopUser();
  if (!user) {
    return apiError("Unauthorized", 401);
  }
  if (!checkAnyPermission(user, permissions)) {
    return apiError("Forbidden", 403);
  }
  return null;
}

function getDesktopSessionUser() {
  return getDesktopUser();
}

function parseAttendanceSource(
  value: string | null,
): AttendanceHistoryFilter["source"] {
  return value === "qr" || value === "manual" || value === "all"
    ? value
    : undefined;
}

function isDisabledParam(value: string | null) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "0" || normalized === "false" || normalized === "no";
}

function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

type DesktopStudentAttendanceTodayStatus =
  | "present"
  | "late"
  | "sick"
  | "permission"
  | "alpha";

type DesktopStudentAttendanceTodaySnapshot = {
  studentId: string;
  status: DesktopStudentAttendanceTodayStatus;
  source: "qr" | "manual";
  checkInTime: Date | null;
  checkOutTime: Date | null;
};

type DesktopStudentStatsSummary = {
  total: number;
  male: number;
  female: number;
  activeGrades: number;
};

type DesktopStudentRowWithAccountClass = {
  id: string;
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
  createdAt: Date;
  accountClassName: string | null;
};

type DesktopStudentImportRowError = {
  row: number;
  message: string;
  nis?: string;
};

type DesktopParsedStudentImportRow = {
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

type DesktopStudentImportSheetRowsExtraction = {
  rows: Record<string, unknown>[];
  headerRowIndex: number;
};

type DesktopTeacherImportRowError = {
  row: number;
  message: string;
  email?: string;
};

type DesktopParsedTeacherImportRow = {
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

const desktopStudentCreateRequestSchema = studentInsertSchema.extend({
  account: z
    .object({
      email: z.string().email("Email akun siswa tidak valid"),
      password: z.string().min(8, "Password akun siswa minimal 8 karakter"),
    })
    .optional(),
});

const desktopStudentUpdateRequestSchema = studentUpdateSchema.extend({
  account: z
    .object({
      email: z.string().email("Email akun tidak valid").optional(),
      password: z.string().min(8, "Password minimal 8 karakter").optional(),
      confirmPassword: z
        .string()
        .min(8, "Konfirmasi password minimal 8 karakter")
        .optional(),
    })
    .optional(),
});

const desktopBulkCreateStudentAccountsSchema = z.object({
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

const desktopBulkResetStudentPasswordSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1, "Pilih minimal 1 akun siswa"),
  password: z.string().min(8, "Password default minimal 8 karakter"),
});

const desktopRepairStudentClassesSchema = z.object({
  studentIds: z.array(z.string().uuid()).optional(),
  sourceToken: z.string().trim().optional(),
  className: z.string().trim().min(1, "Kelas tujuan wajib diisi"),
});

const _desktopStudentImportRequestSchema = z.object({
  fileName: z.string().trim().min(1, "Nama file import wajib diisi"),
  fileDataBase64: z
    .string()
    .trim()
    .min(1, "Isi file import wajib dikirim ke runtime desktop"),
  updateExisting: z.boolean().default(true),
});

const _desktopTeacherImportRequestSchema = z.object({
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

const DESKTOP_STUDENT_IMPORT_COLUMN_ALIASES = {
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

const DESKTOP_TEACHER_IMPORT_COLUMN_ALIASES = {
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

type DesktopStudentUpdatePayload = z.infer<
  typeof desktopStudentUpdateRequestSchema
>;

function normalizeStudentDate(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function normalizeDesktopStudentPayload(payload: DesktopStudentUpdatePayload) {
  const normalizedGrade = payload.grade
    ? sanitizeClassDisplayName(payload.grade)
    : undefined;

  return {
    nis: payload.nis?.trim(),
    nisn: payload.nisn?.trim() || null,
    fullName: payload.fullName?.trim(),
    gender: payload.gender,
    grade: normalizedGrade,
    parentName: payload.parentName?.trim() || null,
    parentPhone: payload.parentPhone?.trim() || null,
    tempatLahir: payload.tempatLahir?.trim() || null,
    tanggalLahir: payload.tanggalLahir ?? null,
    alamat: payload.alamat?.trim() || null,
  };
}

function getStudentAcademicYearLabel(): string {
  const year = new Date().getFullYear();
  return `${year}/${year + 1}`;
}

function normalizeEmailLocalPart(nis: string) {
  return nis.trim().toLowerCase().replace(/\s+/g, "");
}

function normalizeStudentImportHeader(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_]/gu, "")
    .replace(/\s+/g, " ");
}

function pickStudentImportCell(
  row: Record<string, unknown>,
  aliases: readonly string[],
): unknown {
  const entries = Object.entries(row);
  for (const [key, value] of entries) {
    const normalized = normalizeStudentImportHeader(key);
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

function asTrimmedStudentImportString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function parseStudentImportGender(value: unknown): "L" | "P" | null {
  const raw = asTrimmedStudentImportString(value).toLowerCase();
  if (!raw) return null;

  const maleSet = new Set(["l", "male", "m", "laki-laki", "laki laki", "lk"]);
  const femaleSet = new Set(["p", "female", "f", "perempuan", "wanita", "pr"]);

  if (maleSet.has(raw)) return "L";
  if (femaleSet.has(raw)) return "P";
  return null;
}

async function getDesktopStudentIdentity(
  db: Awaited<ReturnType<typeof getDb>>,
  identifier: string,
) {
  const normalizedIdentifier = identifier.trim();
  if (!normalizedIdentifier) {
    return null;
  }

  const rows = await db
    .select({ id: students.id, nis: students.nis })
    .from(students)
    .where(
      and(
        or(
          eq(students.id, normalizedIdentifier),
          eq(students.nis, normalizedIdentifier),
        ),
        isNull(students.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

function parseTeacherImportRole(
  value: unknown,
  fallback: AuthRole,
): AuthRole | null {
  const raw = asTrimmedStudentImportString(value).toLowerCase();
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

function parseTeacherImportBoolean(value: unknown, fallback = true): boolean {
  const raw = asTrimmedStudentImportString(value).toLowerCase();
  if (!raw) return fallback;
  if (["1", "true", "yes", "ya", "aktif", "active"].includes(raw)) return true;
  if (["0", "false", "no", "tidak", "nonaktif", "inactive"].includes(raw)) {
    return false;
  }
  return fallback;
}

function parseStudentImportDateValue(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const raw = asTrimmedStudentImportString(value);
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

function _extractStudentImportRowsFromSheet(
  sheet: unknown,
  XLSX: typeof import("xlsx"),
): DesktopStudentImportSheetRowsExtraction {
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
    nis: new Set<string>(DESKTOP_STUDENT_IMPORT_COLUMN_ALIASES.nis),
    fullName: new Set<string>(DESKTOP_STUDENT_IMPORT_COLUMN_ALIASES.fullName),
    gender: new Set<string>(DESKTOP_STUDENT_IMPORT_COLUMN_ALIASES.gender),
    grade: new Set<string>(DESKTOP_STUDENT_IMPORT_COLUMN_ALIASES.grade),
  };

  let bestIndex = 0;
  let bestScore = -1;

  for (let i = 0; i < Math.min(matrix.length, 15); i += 1) {
    const row = matrix[i] || [];
    const normalizedCells = row.map((cell) =>
      normalizeStudentImportHeader(asTrimmedStudentImportString(cell)),
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
    const value = asTrimmedStudentImportString(cell);
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
      Object.values(row).some(
        (value) => asTrimmedStudentImportString(value) !== "",
      ),
    );

  return { rows, headerRowIndex: bestIndex };
}

function _parseStudentImportRows(
  rawRows: Record<string, unknown>[],
  headerRowIndex: number,
): {
  parsed: DesktopParsedStudentImportRow[];
  errors: DesktopStudentImportRowError[];
} {
  const parsed: DesktopParsedStudentImportRow[] = [];
  const errors: DesktopStudentImportRowError[] = [];
  const nisSet = new Set<string>();

  rawRows.forEach((rawRow, index) => {
    const rowNumber = headerRowIndex + index + 2;
    const nis = asTrimmedStudentImportString(
      pickStudentImportCell(rawRow, DESKTOP_STUDENT_IMPORT_COLUMN_ALIASES.nis),
    );
    const fullName = asTrimmedStudentImportString(
      pickStudentImportCell(
        rawRow,
        DESKTOP_STUDENT_IMPORT_COLUMN_ALIASES.fullName,
      ),
    );
    const grade = sanitizeClassDisplayName(
      asTrimmedStudentImportString(
        pickStudentImportCell(
          rawRow,
          DESKTOP_STUDENT_IMPORT_COLUMN_ALIASES.grade,
        ),
      ),
    );
    const gender = parseStudentImportGender(
      pickStudentImportCell(
        rawRow,
        DESKTOP_STUDENT_IMPORT_COLUMN_ALIASES.gender,
      ),
    );
    const nisnRaw = asTrimmedStudentImportString(
      pickStudentImportCell(rawRow, DESKTOP_STUDENT_IMPORT_COLUMN_ALIASES.nisn),
    );
    const tanggalLahir = parseStudentImportDateValue(
      pickStudentImportCell(
        rawRow,
        DESKTOP_STUDENT_IMPORT_COLUMN_ALIASES.tanggalLahir,
      ),
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
        asTrimmedStudentImportString(
          pickStudentImportCell(
            rawRow,
            DESKTOP_STUDENT_IMPORT_COLUMN_ALIASES.parentName,
          ),
        ) || null,
      parentPhone:
        asTrimmedStudentImportString(
          pickStudentImportCell(
            rawRow,
            DESKTOP_STUDENT_IMPORT_COLUMN_ALIASES.parentPhone,
          ),
        ) || null,
      tempatLahir:
        asTrimmedStudentImportString(
          pickStudentImportCell(
            rawRow,
            DESKTOP_STUDENT_IMPORT_COLUMN_ALIASES.tempatLahir,
          ),
        ) || null,
      tanggalLahir,
      alamat:
        asTrimmedStudentImportString(
          pickStudentImportCell(
            rawRow,
            DESKTOP_STUDENT_IMPORT_COLUMN_ALIASES.alamat,
          ),
        ) || null,
    });
  });

  return { parsed, errors };
}

function _parseTeacherImportRows(
  rawRows: Record<string, unknown>[],
  defaults: { role: AuthRole; password: string },
): {
  parsed: DesktopParsedTeacherImportRow[];
  errors: DesktopTeacherImportRowError[];
} {
  const parsed: DesktopParsedTeacherImportRow[] = [];
  const errors: DesktopTeacherImportRowError[] = [];
  const emailSet = new Set<string>();

  rawRows.forEach((rawRow, index) => {
    const row = index + 2;
    const fullName = asTrimmedStudentImportString(
      pickStudentImportCell(
        rawRow,
        DESKTOP_TEACHER_IMPORT_COLUMN_ALIASES.fullName,
      ),
    );
    const email = asTrimmedStudentImportString(
      pickStudentImportCell(
        rawRow,
        DESKTOP_TEACHER_IMPORT_COLUMN_ALIASES.email,
      ),
    )
      .toLowerCase()
      .trim();
    const role = parseTeacherImportRole(
      pickStudentImportCell(rawRow, DESKTOP_TEACHER_IMPORT_COLUMN_ALIASES.role),
      defaults.role,
    );
    const passwordCell = asTrimmedStudentImportString(
      pickStudentImportCell(
        rawRow,
        DESKTOP_TEACHER_IMPORT_COLUMN_ALIASES.password,
      ),
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
        asTrimmedStudentImportString(
          pickStudentImportCell(
            rawRow,
            DESKTOP_TEACHER_IMPORT_COLUMN_ALIASES.nip,
          ),
        ) || null,
      jenisKelamin: parseStudentImportGender(
        pickStudentImportCell(
          rawRow,
          DESKTOP_TEACHER_IMPORT_COLUMN_ALIASES.jenisKelamin,
        ),
      ),
      tempatLahir:
        asTrimmedStudentImportString(
          pickStudentImportCell(
            rawRow,
            DESKTOP_TEACHER_IMPORT_COLUMN_ALIASES.tempatLahir,
          ),
        ) || null,
      tanggalLahir: parseStudentImportDateValue(
        pickStudentImportCell(
          rawRow,
          DESKTOP_TEACHER_IMPORT_COLUMN_ALIASES.tanggalLahir,
        ),
      ),
      alamat:
        asTrimmedStudentImportString(
          pickStudentImportCell(
            rawRow,
            DESKTOP_TEACHER_IMPORT_COLUMN_ALIASES.alamat,
          ),
        ) || null,
      noTelepon:
        asTrimmedStudentImportString(
          pickStudentImportCell(
            rawRow,
            DESKTOP_TEACHER_IMPORT_COLUMN_ALIASES.noTelepon,
          ),
        ) || null,
      isActive: parseTeacherImportBoolean(
        pickStudentImportCell(
          rawRow,
          DESKTOP_TEACHER_IMPORT_COLUMN_ALIASES.isActive,
        ),
        true,
      ),
    });
  });

  return { parsed, errors };
}

function _decodeBase64ToArrayBuffer(base64: string) {
  const normalizedBase64 = base64.trim();
  const binary = atob(normalizedBase64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return bytes.buffer;
}

function mapDesktopStudentQrStatus(
  status: string,
): DesktopStudentAttendanceTodayStatus {
  switch (status) {
    case "LATE":
      return "late";
    case "EXCUSED":
      return "permission";
    case "ABSENT":
      return "alpha";
    default:
      return "present";
  }
}

function mapDesktopStudentManualStatus(
  status: string,
): DesktopStudentAttendanceTodayStatus {
  switch (status) {
    case "sick":
      return "sick";
    case "permission":
      return "permission";
    case "alpha":
      return "alpha";
    default:
      return "present";
  }
}

async function getDesktopStudentStatsSummary(
  db: Awaited<ReturnType<typeof getDb>>,
): Promise<DesktopStudentStatsSummary> {
  const base = isNull(students.deletedAt);
  const [totalRes, maleRes, femaleRes, gradeRes] = await Promise.all([
    db.select({ value: sql<number>`count(*)` }).from(students).where(base),
    db
      .select({ value: sql<number>`count(*)` })
      .from(students)
      .where(and(base, eq(students.gender, "L"))),
    db
      .select({ value: sql<number>`count(*)` })
      .from(students)
      .where(and(base, eq(students.gender, "P"))),
    db
      .select({ value: sql<number>`count(distinct ${students.grade})` })
      .from(students)
      .where(base),
  ]);

  return {
    total: Number(totalRes[0]?.value || 0),
    male: Number(maleRes[0]?.value || 0),
    female: Number(femaleRes[0]?.value || 0),
    activeGrades: Number(gradeRes[0]?.value || 0),
  };
}

async function getDesktopStudentAttendanceTodaySnapshotMap(
  db: Awaited<ReturnType<typeof getDb>>,
  studentIds: string[],
  date: string,
) {
  if (studentIds.length === 0) {
    return new Map<string, DesktopStudentAttendanceTodaySnapshot>();
  }

  const [qrRows, manualRows] = await Promise.all([
    db
      .select({
        studentId: studentDailyAttendance.studentId,
        status: studentDailyAttendance.status,
        checkInTime: studentDailyAttendance.checkInTime,
        checkOutTime: studentDailyAttendance.checkOutTime,
        updatedAt: studentDailyAttendance.updatedAt,
      })
      .from(studentDailyAttendance)
      .where(
        and(
          eq(studentDailyAttendance.date, date),
          inArray(studentDailyAttendance.studentId, studentIds),
          isNull(studentDailyAttendance.deletedAt),
        ),
      ),
    db
      .select({
        studentId: attendance.studentId,
        status: attendance.status,
        updatedAt: attendance.updatedAt,
      })
      .from(attendance)
      .where(
        and(
          eq(attendance.date, date),
          inArray(attendance.studentId, studentIds),
          isNull(attendance.deletedAt),
        ),
      ),
  ]);

  const qrByStudent = new Map<string, (typeof qrRows)[number]>();
  for (const row of qrRows) {
    const current = qrByStudent.get(row.studentId);
    if (!current || row.updatedAt > current.updatedAt) {
      qrByStudent.set(row.studentId, row);
    }
  }

  const manualByStudent = new Map<string, (typeof manualRows)[number]>();
  for (const row of manualRows) {
    const current = manualByStudent.get(row.studentId);
    if (!current || row.updatedAt > current.updatedAt) {
      manualByStudent.set(row.studentId, row);
    }
  }

  const attendanceMap = new Map<
    string,
    DesktopStudentAttendanceTodaySnapshot
  >();
  for (const studentId of studentIds) {
    const qrRow = qrByStudent.get(studentId);
    if (qrRow) {
      attendanceMap.set(studentId, {
        studentId,
        status: mapDesktopStudentQrStatus(qrRow.status),
        source: "qr",
        checkInTime: qrRow.checkInTime,
        checkOutTime: qrRow.checkOutTime,
      });
      continue;
    }

    const manualRow = manualByStudent.get(studentId);
    if (manualRow) {
      attendanceMap.set(studentId, {
        studentId,
        status: mapDesktopStudentManualStatus(manualRow.status),
        source: "manual",
        checkInTime: null,
        checkOutTime: null,
      });
    }
  }

  return attendanceMap;
}

async function resolveDesktopStudentGrades(
  db: Awaited<ReturnType<typeof getDb>>,
  rows: DesktopStudentRowWithAccountClass[],
) {
  const classIds = [
    ...new Set(rows.map((row) => row.grade.trim()).filter(Boolean)),
  ];
  if (classIds.length === 0) {
    return rows;
  }

  const classRows = await db
    .select({ id: classes.id, name: classes.name })
    .from(classes)
    .where(and(inArray(classes.id, classIds), isNull(classes.deletedAt)));
  const classNameById = new Map(classRows.map((row) => [row.id, row.name]));

  return rows.map((row) => ({
    ...row,
    grade: sanitizeClassDisplayName(
      row.accountClassName,
      classNameById.get(row.grade.trim()),
      row.grade,
    ),
  }));
}

async function handleDesktopAttendanceProjectionSync() {
  const guard = ensureAnyPermission([
    "attendance:read",
    "attendance:write",
    "academic:read",
    "academic:write",
  ]);
  if (guard) return guard;

  try {
    return apiOk(await syncUsersToStudentsProjection());
  } catch (error) {
    return apiError(
      error instanceof Error
        ? error.message
        : "Sinkronisasi proyeksi attendance gagal",
      500,
      "ATTENDANCE_PROJECTION_SYNC_FAILED",
    );
  }
}

async function handleDesktopAttendanceClasses() {
  const guard = ensurePermission("attendance:read");
  if (guard) return guard;

  const db = await getDb();
  const data = await db
    .select({ id: classes.id, name: classes.name })
    .from(classes)
    .where(isNull(classes.deletedAt));
  return apiOk(data);
}

async function handleDesktopAttendanceStudentOptions(url: URL) {
  const guard = ensureRole(["admin", "super_admin"]);
  if (guard) return guard;

  const search = url.searchParams.get("search")?.trim() || undefined;
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit") || "20"), 1),
    50,
  );
  return apiOk(await getAttendanceHistoryStudentOptions({ search, limit }));
}

async function handleDesktopAttendanceStudents(url: URL) {
  const guard = ensurePermission("attendance:read");
  if (guard) return guard;

  const classId = url.searchParams.get("classId");
  const date = url.searchParams.get("date");
  if (!classId || !date) {
    return apiError("classId dan date wajib diisi", 400);
  }

  const db = await getDb();
  let studentResults: Awaited<
    ReturnType<typeof getAttendanceRosterStudents>
  >["students"] = [];

  try {
    const roster = await getAttendanceRosterStudents(classId);
    studentResults = roster.students;
  } catch {
    return apiError("Kelas tidak ditemukan", 404);
  }

  const dailyLogs = await db
    .select()
    .from(studentDailyAttendance)
    .where(
      and(
        eq(studentDailyAttendance.date, date),
        isNull(studentDailyAttendance.deletedAt),
      ),
    );

  const manualConditions = [
    eq(attendance.date, date),
    isNull(attendance.deletedAt),
  ];
  if (classId !== "all") {
    manualConditions.push(eq(attendance.classId, classId));
  }

  const manualAttendanceRows = await db
    .select({
      studentId: attendance.studentId,
      status: attendance.status,
      notes: attendance.notes,
      updatedAt: attendance.updatedAt,
      createdAt: attendance.createdAt,
    })
    .from(attendance)
    .where(and(...manualConditions))
    .orderBy(desc(attendance.updatedAt), desc(attendance.createdAt));

  const logMap = new Map(dailyLogs.map((log) => [log.studentId, log]));
  const manualAttendanceMap = new Map<
    string,
    (typeof manualAttendanceRows)[number]
  >();
  for (const row of manualAttendanceRows) {
    if (!manualAttendanceMap.has(row.studentId)) {
      manualAttendanceMap.set(row.studentId, row);
    }
  }

  return apiOk(
    studentResults.map((student) => {
      const log = logMap.get(student.id);
      const manualAttendance = manualAttendanceMap.get(student.id);

      let status: "present" | "sick" | "permission" | "alpha" = "present";
      if (!log && manualAttendance) {
        status = manualAttendance.status as typeof status;
      }

      return {
        id: student.id,
        nis: student.nis,
        nisn: student.nisn,
        fullName: student.fullName,
        grade: student.grade,
        tempatLahir: student.tempatLahir,
        tanggalLahir: student.tanggalLahir,
        alamat: student.alamat,
        parentName: student.parentName,
        parentPhone: student.parentPhone,
        status,
        notes: log ? "" : (manualAttendance?.notes ?? ""),
        checkInTime: log?.checkInTime ?? null,
        checkOutTime: log?.checkOutTime ?? null,
        isLocked: Boolean(log),
      };
    }),
  );
}

async function handleDesktopAttendanceBulk(body: unknown) {
  const guard = ensurePermission("attendance:write");
  if (guard) return guard;

  if ((body as { classId?: string } | null)?.classId === "all") {
    return apiError(
      "classId=all hanya valid untuk baca data. Simpan absensi manual harus memilih satu kelas spesifik.",
      400,
      "INVALID_CLASS_SCOPE",
    );
  }

  const sessionUserId = getDesktopSessionUser()?.id;
  if (!sessionUserId) {
    return apiError("Sesi user tidak valid", 401);
  }

  const result = await recordBulkAttendance({
    ...(body as Record<string, unknown>),
    recordedBy: sessionUserId,
  } as never);

  if (!result.success) {
    return apiError(result.message, 400);
  }

  return apiOk(result);
}

async function handleDesktopAttendanceToday() {
  const guard = ensurePermission("attendance:read");
  if (guard) return guard;

  const records = await getTodayAttendanceRecords();
  const sessionUser = getDesktopSessionUser();
  const sessionUserId = sessionUser?.id;
  const sessionRole = sessionUser?.role;
  const scopedRecords =
    sessionRole === "student" && sessionUserId
      ? records.filter((record) => record.studentId === sessionUserId)
      : records;
  return apiOk(scopedRecords);
}

async function handleDesktopAttendanceScan(body: unknown) {
  const guard = ensurePermission("attendance:write");
  if (guard) return guard;

  if (!body || typeof body !== "object") {
    return apiError(
      "Payload QR scan harus berupa JSON yang valid",
      400,
      "VALIDATION_ERROR",
    );
  }

  const parsed = qrScanSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message || "Payload QR scan tidak valid",
      400,
      "VALIDATION_ERROR",
    );
  }

  try {
    return apiOk(await processQRScan(parsed.data.qrData));
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Internal Server Error",
      500,
    );
  }
}

async function handleDesktopAttendanceHistory(
  url: URL,
  sessionUserId: string | undefined,
  sessionRole: string | undefined,
) {
  const guard = ensurePermission("attendance:read");
  if (guard) return guard;

  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit") || "20"), 1),
    500,
  );
  const offset = Math.max(Number(url.searchParams.get("offset") || "0"), 0);
  const sortBy: AttendanceHistoryFilter["sortBy"] =
    url.searchParams.get("sortBy") === "earliest" ? "earliest" : "latest";
  const startDate = url.searchParams.get("startDate") || undefined;
  const endDate = url.searchParams.get("endDate") || undefined;
  const requestedStudentId = url.searchParams.get("studentId") || undefined;
  const studentId =
    sessionRole === "student" ? sessionUserId : requestedStudentId;
  const status = url.searchParams.get("status") || undefined;
  const searchQuery = url.searchParams.get("searchQuery") || undefined;
  const className = url.searchParams.get("className") || undefined;
  const source = parseAttendanceSource(url.searchParams.get("source"));
  const exportMode = url.searchParams.get("export") === "true";
  const summaryMode = url.searchParams.get("summary") === "true";
  const classSummaryMode = url.searchParams.get("classSummary") === "true";
  const studentSummaryMode = url.searchParams.get("studentSummary") === "true";
  const trendMode = url.searchParams.get("trend") === "true";
  const heatmapMode = url.searchParams.get("heatmap") === "true";
  const analyticsBundleMode =
    url.searchParams.get("analyticsBundle") === "true";

  if (
    sessionRole === "student" &&
    requestedStudentId &&
    requestedStudentId !== sessionUserId
  ) {
    return apiError("Forbidden", 403);
  }

  try {
    const filter = {
      startDate,
      endDate,
      sortBy,
      studentId,
      status,
      searchQuery,
      source,
      className,
    };

    if (summaryMode) {
      return apiOk(await getAttendanceHistorySummary(filter));
    }
    if (classSummaryMode) {
      return apiOk(await getAttendanceHistoryClassSummary(filter));
    }
    if (studentSummaryMode) {
      return apiOk(await getAttendanceHistoryStudentSummary(filter));
    }
    if (trendMode) {
      return apiOk(await getAttendanceHistoryTrend(filter));
    }
    if (heatmapMode) {
      return apiOk(await getAttendanceHistoryHeatmap(filter));
    }
    if (analyticsBundleMode) {
      return apiOk(await getAttendanceHistoryAnalyticsBundle(filter));
    }

    const [data, total] = await Promise.all([
      exportMode
        ? getAttendanceHistoryExportRows(filter)
        : getAttendanceHistory({
            ...filter,
            limit,
            offset,
          }),
      getAttendanceHistoryCount({
        ...filter,
        offset,
      }),
    ]);

    return apiOk({
      data,
      total,
      limit,
      offset,
    });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Gagal memuat riwayat absensi",
      400,
      "VALIDATION_ERROR",
    );
  }
}

async function handleDesktopAttendanceSettings(method: string, body: unknown) {
  if (method === "GET") {
    const guard = ensurePermission("attendance:read");
    if (guard) return guard;

    try {
      return apiOk(await getAttendanceSettings());
    } catch (error) {
      return apiError(
        error instanceof Error
          ? error.message
          : "Gagal memuat pengaturan absensi",
        500,
        "ATTENDANCE_SETTINGS_LOAD_FAILED",
      );
    }
  }

  if (method === "POST") {
    const guard = ensurePermission("attendance:write");
    if (guard) return guard;

    try {
      await upsertAttendanceSetting(body as never);
      return apiOk({ success: true });
    } catch (error) {
      return apiError(
        error instanceof Error ? error.message : "Gagal menyimpan pengaturan",
        400,
      );
    }
  }

  return null;
}

async function handleDesktopAttendanceHolidays(method: string, body: unknown) {
  if (method === "GET") {
    const guard = ensurePermission("attendance:read");
    if (guard) return guard;

    try {
      return apiOk(await getHolidays());
    } catch (error) {
      return apiError(
        error instanceof Error ? error.message : "Gagal memuat hari libur",
        500,
        "ATTENDANCE_HOLIDAYS_LOAD_FAILED",
      );
    }
  }

  if (method === "POST") {
    const guard = ensurePermission("attendance:write");
    if (guard) return guard;

    try {
      const payload = body as { date?: string; name?: string };
      await addHoliday(payload.date ?? "", payload.name ?? "");
      return apiOk({ success: true });
    } catch (error) {
      return apiError(
        error instanceof Error ? error.message : "Gagal menyimpan hari libur",
        400,
      );
    }
  }

  return null;
}

async function handleDesktopDeleteAttendanceSetting(id: string | undefined) {
  const guard = ensurePermission("attendance:write");
  if (guard) return guard;

  if (!id?.trim()) {
    return apiError("ID pengaturan absensi tidak valid", 400);
  }

  try {
    await deleteAttendanceSetting(id);
    return apiOk({ success: true });
  } catch (error) {
    return apiError(
      error instanceof Error
        ? error.message
        : "Gagal menghapus pengaturan absensi",
      500,
      "ATTENDANCE_SETTINGS_DELETE_FAILED",
    );
  }
}

async function handleDesktopDeleteAttendanceHoliday(id: string | undefined) {
  const guard = ensurePermission("attendance:write");
  if (guard) return guard;

  if (!id?.trim()) {
    return apiError("ID hari libur tidak valid", 400);
  }

  try {
    await deleteHoliday(id);
    return apiOk({ success: true });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Gagal menghapus hari libur",
      500,
      "ATTENDANCE_HOLIDAY_DELETE_FAILED",
    );
  }
}

async function handleDesktopAttendanceRiskInsights(
  url: URL,
  sessionUser: ReturnType<typeof getDesktopSessionUser>,
  sessionUserId: string | undefined,
  sessionRole: string | undefined,
) {
  if (!hasRole(sessionUser, ["admin", "super_admin", "teacher", "staff"])) {
    return apiError("Forbidden", 403);
  }
  if (!sessionUserId) {
    return apiError("Unauthorized", 401);
  }

  try {
    const { startDate, endDate } = getCurrentMonthRange();
    const className = url.searchParams.get("className")?.trim() || undefined;
    const requestedAssigneeId =
      url.searchParams.get("assigneeUserId")?.trim() || undefined;
    const includeStudents = !isDisabledParam(
      url.searchParams.get("includeStudents"),
    );
    const includeAssignmentSummary = !isDisabledParam(
      url.searchParams.get("includeAssignmentSummary"),
    );
    const canViewAssignmentSummary =
      sessionRole === "admin" || sessionRole === "super_admin";
    const assigneeUserId =
      canViewAssignmentSummary && requestedAssigneeId
        ? requestedAssigneeId
        : sessionUserId;
    const settings = await getAttendanceRiskSettings();
    const [students, notifications, notificationSummary, assignmentSummary] =
      await Promise.all([
        includeStudents
          ? getAttendanceRiskStudents(
              { startDate, endDate, className },
              settings,
            )
          : Promise.resolve([]),
        getAttendanceRiskNotifications(assigneeUserId),
        className
          ? Promise.resolve(null)
          : getAttendanceRiskNotificationSummary(assigneeUserId),
        canViewAssignmentSummary && includeAssignmentSummary
          ? getAttendanceRiskAssignmentSummary(className)
          : Promise.resolve([]),
      ]);
    const scopedNotifications = className
      ? notifications.filter(
          (notification) => notification.className === className,
        )
      : notifications;
    const scopedNotificationSummary = className
      ? {
          total: scopedNotifications.length,
          pending: scopedNotifications.filter(
            (notification) => !notification.isRead,
          ).length,
          done: scopedNotifications.filter(
            (notification) => notification.isRead,
          ).length,
        }
      : notificationSummary;

    return apiOk({
      settings,
      students: students.slice(0, 5),
      notifications: scopedNotifications,
      notificationSummary: scopedNotificationSummary,
      assignmentSummary: assignmentSummary.slice(0, 6),
      period: { startDate, endDate },
      className: className ?? null,
      assigneeUserId:
        canViewAssignmentSummary && requestedAssigneeId
          ? requestedAssigneeId
          : null,
      meta: {
        includeStudents,
        includeAssignmentSummary:
          canViewAssignmentSummary && includeAssignmentSummary,
      },
    });
  } catch (error) {
    return apiError(
      error instanceof Error
        ? error.message
        : "Gagal memuat insight attendance",
      400,
      "VALIDATION_ERROR",
    );
  }
}

async function handleDesktopAttendanceRiskSettings(
  method: string,
  body: unknown,
) {
  if (method === "GET") {
    const guard = ensurePermission("attendance:read");
    if (guard) return guard;

    try {
      return apiOk(await getAttendanceRiskSettings());
    } catch (error) {
      return apiError(
        error instanceof Error
          ? error.message
          : "Gagal memuat pengaturan risiko",
        400,
        "VALIDATION_ERROR",
      );
    }
  }

  if (method === "PUT") {
    const guard = ensurePermission("settings:manage");
    if (guard) return guard;

    try {
      const payload = body as {
        alphaThreshold?: number;
        lateThreshold?: number;
        rateThreshold?: number;
      };
      return apiOk(
        await upsertAttendanceRiskSettings({
          alphaThreshold: Number(payload.alphaThreshold ?? 0),
          lateThreshold: Number(payload.lateThreshold ?? 0),
          rateThreshold: Number(payload.rateThreshold ?? 0),
        }),
      );
    } catch (error) {
      return apiError(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan pengaturan risiko",
        400,
        "VALIDATION_ERROR",
      );
    }
  }

  return null;
}

async function handleDesktopCreateAttendanceRiskFollowUp(
  body: unknown,
  sessionUserId: string | undefined,
) {
  const guard = ensurePermission("attendance:write");
  if (guard) return guard;
  if (!sessionUserId) {
    return apiError("Unauthorized", 401);
  }

  try {
    const payload = body as {
      studentId?: string;
      riskFlags?: unknown[];
      note?: string;
      deadline?: string | null;
    };
    const normalizedRiskFlags = Array.isArray(payload.riskFlags)
      ? payload.riskFlags
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

    if (!payload.studentId || normalizedRiskFlags.length === 0) {
      return apiError("Payload follow-up tidak valid", 400, "VALIDATION_ERROR");
    }
    if (
      normalizedRiskFlags.length > 10 ||
      normalizedRiskFlags.some((item) => item.length > 120)
    ) {
      return apiError(
        "Indikator follow-up tidak valid",
        400,
        "VALIDATION_ERROR",
      );
    }
    if (typeof payload.note === "string" && payload.note.trim().length > 300) {
      return apiError(
        "Catatan follow-up maksimal 300 karakter",
        400,
        "VALIDATION_ERROR",
      );
    }
    if (
      payload.deadline !== null &&
      payload.deadline !== undefined &&
      (typeof payload.deadline !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(payload.deadline))
    ) {
      return apiError(
        "Deadline follow-up harus berformat YYYY-MM-DD",
        400,
        "VALIDATION_ERROR",
      );
    }

    await createAttendanceRiskFollowUp({
      actorUserId: sessionUserId,
      studentId: payload.studentId,
      riskFlags: normalizedRiskFlags,
      note: typeof payload.note === "string" ? payload.note : undefined,
      deadline: typeof payload.deadline === "string" ? payload.deadline : null,
    });
    return apiOk({ success: true });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Gagal membuat follow-up",
      400,
      "VALIDATION_ERROR",
    );
  }
}

async function handleDesktopAttendanceRiskFollowUpHistory(
  url: URL,
  sessionUserId: string | undefined,
  sessionRole: string | undefined,
) {
  const guard = ensurePermission("attendance:read");
  if (guard) return guard;
  if (!sessionUserId) {
    return apiError("Unauthorized", 401);
  }

  const studentId = url.searchParams.get("studentId")?.trim();
  if (!studentId) {
    return apiError("studentId wajib diisi", 400, "VALIDATION_ERROR");
  }

  const allowAnyAssignee =
    sessionRole === "admin" || sessionRole === "super_admin";
  if (
    !allowAnyAssignee &&
    sessionRole === "student" &&
    studentId !== sessionUserId
  ) {
    return apiError("Forbidden", 403, "FORBIDDEN");
  }

  try {
    return apiOk(
      await getAttendanceRiskFollowUpHistory(studentId, {
        assigneeUserId: sessionUserId,
        allowAnyAssignee,
      }),
    );
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Gagal memuat riwayat follow-up",
      400,
      "VALIDATION_ERROR",
    );
  }
}

async function handleDesktopUpdateAttendanceRiskFollowUp(
  id: string | undefined,
  body: unknown,
  sessionUserId: string | undefined,
  sessionRole: string | undefined,
) {
  const guard = ensurePermission("attendance:write");
  if (guard) return guard;
  if (!sessionUserId) {
    return apiError("Unauthorized", 401);
  }
  if (!id) {
    return apiError("ID follow-up tidak valid", 400, "VALIDATION_ERROR");
  }

  try {
    const payload = (body ?? null) as {
      note?: string | null;
      deadline?: string | null;
      markDone?: boolean;
      assigneeUserId?: string | null;
    } | null;
    const canManageAnyAssignee =
      sessionRole === "admin" || sessionRole === "super_admin";

    if (
      payload &&
      ("note" in payload ||
        "deadline" in payload ||
        "assigneeUserId" in payload)
    ) {
      if (
        typeof payload.note === "string" &&
        payload.note.trim().length > 300
      ) {
        return apiError(
          "Catatan follow-up maksimal 300 karakter",
          400,
          "VALIDATION_ERROR",
        );
      }
      if (
        payload.deadline !== null &&
        payload.deadline !== undefined &&
        (typeof payload.deadline !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(payload.deadline))
      ) {
        return apiError(
          "Deadline follow-up harus berformat YYYY-MM-DD",
          400,
          "VALIDATION_ERROR",
        );
      }
      if (
        "assigneeUserId" in payload &&
        payload.assigneeUserId !== undefined &&
        !canManageAnyAssignee
      ) {
        return apiError(
          "Hanya admin yang dapat melakukan reassign follow-up",
          403,
          "FORBIDDEN",
        );
      }

      await updateAttendanceRiskFollowUp(
        id,
        sessionUserId,
        {
          note: payload.note,
          deadline: payload.deadline,
          isRead: payload.markDone === true ? true : undefined,
          assigneeUserId: payload.assigneeUserId,
        },
        { allowAnyAssignee: canManageAnyAssignee },
      );
      return apiOk({ success: true });
    }

    await markAttendanceRiskNotificationRead(id, sessionUserId, {
      allowAnyAssignee: canManageAnyAssignee,
    });
    return apiOk({ success: true });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Gagal menandai follow-up",
      400,
      "VALIDATION_ERROR",
    );
  }
}

async function handleDesktopAttendanceRiskFollowUpAuditTrail(
  id: string | undefined,
  sessionUserId: string | undefined,
  sessionRole: string | undefined,
) {
  const guard = ensurePermission("attendance:read");
  if (guard) return guard;
  if (!sessionUserId) {
    return apiError("Unauthorized", 401);
  }
  if (!id) {
    return apiError("ID follow-up tidak valid", 400, "VALIDATION_ERROR");
  }

  try {
    return apiOk(
      await getAttendanceRiskFollowUpAuditTrail(id, sessionUserId, {
        allowAnyAssignee:
          sessionRole === "admin" || sessionRole === "super_admin",
      }),
    );
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Gagal memuat audit trail",
      400,
      "VALIDATION_ERROR",
    );
  }
}

async function handleAttendance(
  url: URL,
  method: string,
  pathSegments: string[],
  body: unknown,
) {
  const sessionUser = getDesktopSessionUser();
  const sessionUserId = sessionUser?.id;
  const sessionRole = sessionUser?.role;

  if (pathSegments.length === 2 && pathSegments[1] === "attendance") {
    return null;
  }

  if (
    pathSegments.length === 3 &&
    pathSegments[2] === "projection-sync" &&
    method === "POST"
  ) {
    return handleDesktopAttendanceProjectionSync();
  }

  if (pathSegments.length === 3 && pathSegments[2] === "classes") {
    if (method !== "GET") {
      return null;
    }
    return handleDesktopAttendanceClasses();
  }

  if (pathSegments.length === 3 && pathSegments[2] === "student-options") {
    if (method !== "GET") {
      return null;
    }
    return handleDesktopAttendanceStudentOptions(url);
  }

  if (pathSegments.length === 3 && pathSegments[2] === "students") {
    if (method !== "GET") {
      return null;
    }
    return handleDesktopAttendanceStudents(url);
  }

  if (pathSegments.length === 3 && pathSegments[2] === "bulk") {
    if (method !== "POST") {
      return null;
    }
    return handleDesktopAttendanceBulk(body);
  }

  if (pathSegments.length === 3 && pathSegments[2] === "today") {
    if (method !== "GET") {
      return null;
    }
    return handleDesktopAttendanceToday();
  }

  if (pathSegments.length === 3 && pathSegments[2] === "scan") {
    if (method !== "POST") {
      return null;
    }
    return handleDesktopAttendanceScan(body);
  }

  if (pathSegments.length === 3 && pathSegments[2] === "history") {
    if (method !== "GET") {
      return null;
    }
    return handleDesktopAttendanceHistory(url, sessionUserId, sessionRole);
  }

  if (pathSegments.length === 3 && pathSegments[2] === "settings") {
    return handleDesktopAttendanceSettings(method, body);
  }

  if (
    pathSegments.length === 4 &&
    pathSegments[2] === "settings" &&
    method === "DELETE"
  ) {
    return handleDesktopDeleteAttendanceSetting(pathSegments[3]);
  }

  if (pathSegments.length === 3 && pathSegments[2] === "holidays") {
    return handleDesktopAttendanceHolidays(method, body);
  }

  if (
    pathSegments.length === 4 &&
    pathSegments[2] === "holidays" &&
    method === "DELETE"
  ) {
    return handleDesktopDeleteAttendanceHoliday(pathSegments[3]);
  }

  if (pathSegments.length === 3 && pathSegments[2] === "risk-settings") {
    return handleDesktopAttendanceRiskSettings(method, body);
  }

  if (pathSegments.length === 3 && pathSegments[2] === "risk-insights") {
    if (method !== "GET") {
      return null;
    }
    return handleDesktopAttendanceRiskInsights(
      url,
      sessionUser,
      sessionUserId,
      sessionRole,
    );
  }

  if (pathSegments.length === 3 && pathSegments[2] === "risk-followups") {
    if (method !== "POST") {
      return null;
    }
    return handleDesktopCreateAttendanceRiskFollowUp(body, sessionUserId);
  }

  if (
    pathSegments.length === 4 &&
    pathSegments[2] === "risk-followups" &&
    pathSegments[3] === "history"
  ) {
    if (method !== "GET") {
      return null;
    }
    return handleDesktopAttendanceRiskFollowUpHistory(
      url,
      sessionUserId,
      sessionRole,
    );
  }

  if (
    pathSegments.length === 4 &&
    pathSegments[2] === "risk-followups" &&
    method === "PATCH"
  ) {
    return handleDesktopUpdateAttendanceRiskFollowUp(
      pathSegments[3],
      body,
      sessionUserId,
      sessionRole,
    );
  }

  if (
    pathSegments.length === 5 &&
    pathSegments[2] === "risk-followups" &&
    pathSegments[4] === "history" &&
    method === "GET"
  ) {
    return handleDesktopAttendanceRiskFollowUpAuditTrail(
      pathSegments[3],
      sessionUserId,
      sessionRole,
    );
  }

  return null;
}

async function handleDashboard(method: string, pathSegments: string[]) {
  if (
    pathSegments.length === 3 &&
    pathSegments[2] === "stats" &&
    method === "GET"
  ) {
    const sessionUser = getDesktopSessionUser();
    if (!sessionUser) {
      return apiError("Unauthorized", 401, "UNAUTHORIZED");
    }

    if (!hasRole(sessionUser, ["admin", "super_admin", "teacher", "staff"])) {
      return apiError("Forbidden", 403, "FORBIDDEN");
    }

    return apiOk(await getDashboardStats());
  }

  return null;
}

async function handleDesktopStudentLegacyGroups() {
  const guard = ensureRole(["admin", "super_admin"]);
  if (guard) return guard;

  const db = await getDb();
  const rows = await db
    .select({
      id: students.id,
      nis: students.nis,
      fullName: students.fullName,
      grade: students.grade,
      kelasId: users.kelasId,
    })
    .from(students)
    .leftJoin(users, and(isNull(users.deletedAt), eq(students.id, users.id)))
    .where(isNull(students.deletedAt));

  const groups = new Map<
    string,
    {
      sourceToken: string;
      count: number;
      samples: Array<{ id: string; nis: string; fullName: string }>;
    }
  >();

  for (const row of rows) {
    const sourceToken = isUuidLikeClassValue(row.kelasId)
      ? row.kelasId?.trim() || null
      : isUuidLikeClassValue(row.grade)
        ? row.grade.trim()
        : row.grade === "UNASSIGNED"
          ? "UNASSIGNED"
          : null;

    if (!sourceToken) {
      continue;
    }

    const current = groups.get(sourceToken) ?? {
      sourceToken,
      count: 0,
      samples: [],
    };
    current.count += 1;
    if (current.samples.length < 5) {
      current.samples.push({
        id: row.id,
        nis: row.nis,
        fullName: row.fullName,
      });
    }
    groups.set(sourceToken, current);
  }

  return apiOk(Array.from(groups.values()).sort((a, b) => b.count - a.count));
}

async function handleDesktopStudentClassRepair(body: unknown) {
  const guard = ensureRole(["admin", "super_admin"]);
  if (guard) return guard;

  const validation = desktopRepairStudentClassesSchema.safeParse(body);
  if (!validation.success) {
    return apiError(
      validation.error.issues[0]?.message || "Data repair kelas tidak valid",
      400,
      "VALIDATION_ERROR",
    );
  }

  const targetClassName = sanitizeClassDisplayName(validation.data.className);
  if (
    targetClassName === "UNASSIGNED" ||
    isUuidLikeClassValue(targetClassName)
  ) {
    return apiError("Nama kelas tujuan tidak valid", 400, "INVALID_CLASS_NAME");
  }

  const db = await getDb();
  const requestedIds = validation.data.studentIds ?? [];
  const sourceToken = validation.data.sourceToken?.trim() || null;
  const targetStudents =
    requestedIds.length > 0
      ? await db
          .select({ id: students.id })
          .from(students)
          .where(
            and(inArray(students.id, requestedIds), isNull(students.deletedAt)),
          )
      : await db
          .select({ id: students.id })
          .from(students)
          .where(isNull(students.deletedAt));

  if (targetStudents.length === 0) {
    return apiError("Data siswa tidak ditemukan", 404, "STUDENT_NOT_FOUND");
  }

  const studentIds = targetStudents.map((student) => student.id);
  const targetRows = await db
    .select({
      id: students.id,
      grade: students.grade,
      kelasId: users.kelasId,
    })
    .from(students)
    .leftJoin(users, and(eq(users.id, students.id), isNull(users.deletedAt)))
    .where(inArray(students.id, studentIds));
  const legacyStudentIds = targetRows
    .filter(
      (student) =>
        isUuidLikeClassValue(student.grade) ||
        student.grade === "UNASSIGNED" ||
        isUuidLikeClassValue(student.kelasId),
    )
    .map((student) => student.id);

  const filteredLegacyStudentIds =
    sourceToken === null
      ? legacyStudentIds
      : (
          await db
            .select({
              id: students.id,
              grade: students.grade,
              kelasId: users.kelasId,
            })
            .from(students)
            .leftJoin(
              users,
              and(eq(users.id, students.id), isNull(users.deletedAt)),
            )
            .where(inArray(students.id, legacyStudentIds))
        )
          .filter((row) => {
            const token = isUuidLikeClassValue(row.kelasId)
              ? row.kelasId?.trim()
              : isUuidLikeClassValue(row.grade)
                ? row.grade.trim()
                : row.grade === "UNASSIGNED"
                  ? "UNASSIGNED"
                  : null;
            return token === sourceToken;
          })
          .map((row) => row.id);

  if (filteredLegacyStudentIds.length === 0) {
    return apiOk({
      updated: 0,
      className: targetClassName,
    });
  }

  const now = new Date();
  const classRows = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.name, targetClassName), isNull(classes.deletedAt)))
    .limit(1);

  let kelasId = classRows[0]?.id ?? null;
  if (!kelasId) {
    kelasId = crypto.randomUUID();
    await db.insert(classes).values({
      id: kelasId,
      name: targetClassName,
      academicYear: getStudentAcademicYearLabel(),
      isActive: true,
      syncStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });
  }

  await db
    .update(students)
    .set({
      grade: targetClassName,
      syncStatus: "pending",
      updatedAt: now,
    })
    .where(inArray(students.id, filteredLegacyStudentIds));

  await db
    .update(users)
    .set({
      kelasId,
      syncStatus: "pending",
      updatedAt: now,
    })
    .where(
      and(
        inArray(users.id, filteredLegacyStudentIds),
        eq(users.role, "student"),
        isNull(users.deletedAt),
      ),
    );

  return apiOk({
    updated: filteredLegacyStudentIds.length,
    className: targetClassName,
  });
}

async function handleDesktopBulkCreateStudentAccounts(body: unknown) {
  const guard = ensureRole(["admin", "super_admin"]);
  if (guard) return guard;

  const validation = desktopBulkCreateStudentAccountsSchema.safeParse(body);
  if (!validation.success) {
    return apiError(
      validation.error.issues[0]?.message || "Data bulk akun siswa tidak valid",
      400,
      "VALIDATION_ERROR",
    );
  }

  const { emailDomain, password } = validation.data;
  const studentIds = Array.from(new Set(validation.data.studentIds));
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
    .select({ id: users.id, deletedAt: users.deletedAt })
    .from(users)
    .where(
      and(
        inArray(
          users.id,
          studentRows.map((student) => student.id),
        ),
        eq(users.role, "student"),
      ),
    );
  const activeAccountSet = new Set(
    existingAccounts
      .filter((item) => item.deletedAt === null)
      .map((item) => item.id),
  );
  const deletedAccountSet = new Set(
    existingAccounts
      .filter((item) => item.deletedAt !== null)
      .map((item) => item.id),
  );

  const candidates = studentRows.filter(
    (student) => !activeAccountSet.has(student.id),
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
    .select({ id: users.id, email: users.email, deletedAt: users.deletedAt })
    .from(users)
    .where(inArray(users.email, candidateEmails));
  const now = new Date();
  const passwordHash = await hashPassword(password);
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
  let created = 0;
  let skipped = studentRows.length - candidates.length;

  if (missingClassNames.length > 0) {
    const academicYear = getStudentAcademicYearLabel();
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

  for (const student of candidates) {
    const email = `${normalizeEmailLocalPart(student.nis)}@${emailDomain}`;
    const emailOwner = existingEmailRows.find((item) => item.email === email);
    if (
      emailOwner &&
      (emailOwner.deletedAt === null || emailOwner.id !== student.id)
    ) {
      skipped += 1;
      continue;
    }

    const kelasId = (() => {
      const grade = sanitizeClassDisplayName(
        student.grade,
        student.grade ? classNameById.get(student.grade.trim()) : null,
      );
      if (!grade || grade === "UNASSIGNED") {
        return null;
      }
      return classIdByName.get(grade) ?? null;
    })();

    if (deletedAccountSet.has(student.id)) {
      await db
        .update(users)
        .set({
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
          kelasId,
          isActive: true,
          deletedAt: null,
          syncStatus: "pending",
          updatedAt: now,
        })
        .where(eq(users.id, student.id));
    } else {
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
        kelasId,
        isActive: true,
        syncStatus: "pending",
        createdAt: now,
        updatedAt: now,
      });
    }
    created += 1;
  }

  return apiOk({
    created,
    skipped,
    message: `Berhasil membuat ${created} akun siswa, ${skipped} data dilewati.`,
  });
}

async function handleDesktopBulkResetStudentPasswords(body: unknown) {
  const guard = ensureRole(["admin", "super_admin"]);
  if (guard) return guard;

  const validation = desktopBulkResetStudentPasswordSchema.safeParse(body);
  if (!validation.success) {
    return apiError(
      validation.error.issues[0]?.message || "Data reset password tidak valid",
      400,
      "VALIDATION_ERROR",
    );
  }

  const { password } = validation.data;
  const studentIds = Array.from(new Set(validation.data.studentIds));
  const db = await getDb();
  const studentAccounts = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        inArray(users.id, studentIds),
        eq(users.role, "student"),
        eq(users.isActive, true),
        isNull(users.deletedAt),
      ),
    );

  if (studentAccounts.length === 0) {
    return apiError(
      "Akun siswa aktif tidak ditemukan",
      404,
      "ACCOUNT_NOT_FOUND",
    );
  }

  const passwordHash = await hashPassword(password);
  const updatedAt = new Date();
  const skipped = studentIds.length - studentAccounts.length;

  await db
    .update(users)
    .set({
      passwordHash,
      syncStatus: "pending",
      updatedAt,
    })
    .where(
      and(
        inArray(
          users.id,
          studentAccounts.map((account) => account.id),
        ),
        eq(users.role, "student"),
        eq(users.isActive, true),
        isNull(users.deletedAt),
      ),
    );

  return apiOk({
    updated: studentAccounts.length,
    skipped,
    message: `Berhasil reset password ${studentAccounts.length} akun siswa, ${skipped} data dilewati.`,
  });
}

async function handleDesktopCreateStudentAccount(
  identifier: string | undefined,
  body: unknown,
) {
  const guard = ensureRole(["admin", "super_admin"]);
  if (guard) return guard;
  if (!identifier) {
    return apiError("Data siswa tidak ditemukan", 404, "NOT_FOUND");
  }

  const payload = z
    .object({
      email: z.string().email("Email akun siswa tidak valid"),
      password: z.string().min(8, "Password akun siswa minimal 8 karakter"),
    })
    .safeParse(body);

  if (!payload.success) {
    return apiError(
      payload.error.issues[0]?.message || "Data akun siswa tidak valid",
      400,
      "VALIDATION_ERROR",
    );
  }

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
    .where(
      and(
        or(eq(students.id, identifier), eq(students.nis, identifier)),
        isNull(students.deletedAt),
      ),
    )
    .limit(1);

  if (studentRows.length === 0) {
    return apiError("Data siswa tidak ditemukan", 404, "STUDENT_NOT_FOUND");
  }

  const student = studentRows[0];
  const normalizedEmail = payload.data.email.trim().toLowerCase();
  const password = payload.data.password;

  const existingUserByEmail = await db
    .select({ id: users.id, deletedAt: users.deletedAt })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (
    existingUserByEmail[0] &&
    (existingUserByEmail[0].deletedAt === null ||
      existingUserByEmail[0].id !== student.id)
  ) {
    return apiError("Email akun siswa sudah terdaftar", 409, "EMAIL_EXISTS");
  }

  const passwordHash = await hashPassword(password);
  const existingById = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, student.id))
    .limit(1);
  const rawGrade = student.grade?.trim() || "";
  let gradeName = sanitizeClassDisplayName(rawGrade);
  if (isUuidLikeClassValue(rawGrade)) {
    const classById = await db
      .select({ name: classes.name })
      .from(classes)
      .where(and(eq(classes.id, rawGrade), isNull(classes.deletedAt)))
      .limit(1);
    gradeName = sanitizeClassDisplayName(classById[0]?.name, rawGrade);
  }

  let kelasId: string | null = null;
  if (
    gradeName &&
    gradeName !== "UNASSIGNED" &&
    !isUuidLikeClassValue(gradeName)
  ) {
    const classRows = await db
      .select({ id: classes.id })
      .from(classes)
      .where(and(eq(classes.name, gradeName), isNull(classes.deletedAt)))
      .limit(1);

    if (classRows.length > 0) {
      kelasId = classRows[0]?.id ?? null;
    } else {
      kelasId = crypto.randomUUID();
      await db.insert(classes).values({
        id: kelasId,
        name: gradeName,
        academicYear: getStudentAcademicYearLabel(),
        isActive: true,
        syncStatus: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  if (existingById[0]?.role && existingById[0].role !== "student") {
    return apiError(
      "ID siswa sudah dipakai akun non-student",
      409,
      "ID_ROLE_CONFLICT",
    );
  }

  const now = new Date();
  if (existingById[0]) {
    await db
      .update(users)
      .set({
        fullName: student.fullName,
        email: normalizedEmail,
        role: "student",
        passwordHash,
        nis: student.nis,
        nisn: student.nisn,
        tempatLahir: student.tempatLahir,
        tanggalLahir: student.tanggalLahir,
        jenisKelamin: student.gender,
        alamat: student.alamat,
        kelasId,
        isActive: true,
        deletedAt: null,
        syncStatus: "pending",
        updatedAt: now,
      })
      .where(eq(users.id, student.id));
  } else {
    await db.insert(users).values({
      id: student.id,
      fullName: student.fullName,
      email: normalizedEmail,
      role: "student",
      passwordHash,
      nis: student.nis,
      nisn: student.nisn,
      tempatLahir: student.tempatLahir,
      tanggalLahir: student.tanggalLahir,
      jenisKelamin: student.gender,
      alamat: student.alamat,
      kelasId,
      isActive: true,
      syncStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });
  }

  return apiOk({ accountCreated: true });
}

async function handleDesktopStudentStats() {
  const db = await getDb();
  const sessionUser = getDesktopSessionUser();
  const sessionRole = sessionUser?.role;
  const sessionUserId = sessionUser?.id;

  if (sessionRole === "student" && sessionUserId) {
    const ownRecord = await db
      .select({
        grade: students.grade,
        gender: students.gender,
      })
      .from(students)
      .where(and(eq(students.id, sessionUserId), isNull(students.deletedAt)))
      .limit(1);

    const gender = ownRecord[0]?.gender;
    return apiOk({
      total: ownRecord.length,
      male: gender === "L" ? 1 : 0,
      female: gender === "P" ? 1 : 0,
      activeGrades: ownRecord[0]?.grade ? 1 : 0,
    });
  }

  const guard = ensureRole(["admin", "super_admin"]);
  if (guard) return guard;
  return apiOk(await getDesktopStudentStatsSummary(db));
}

async function handleDesktopStudentsList(url: URL) {
  const db = await getDb();
  const sessionUser = getDesktopSessionUser();
  const sessionRole = sessionUser?.role;
  const sessionUserId = sessionUser?.id;

  if (sessionRole === "student" && sessionUserId) {
    const accountRows = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(
        and(
          eq(users.id, sessionUserId),
          eq(users.role, "student"),
          eq(users.isActive, true),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);

    const ownRecordRows = await db
      .select({
        id: students.id,
        nis: students.nis,
        nisn: students.nisn,
        fullName: students.fullName,
        gender: students.gender,
        grade: students.grade,
        parentName: students.parentName,
        parentPhone: students.parentPhone,
        tempatLahir: students.tempatLahir,
        tanggalLahir: students.tanggalLahir,
        alamat: students.alamat,
        createdAt: students.createdAt,
        accountClassName: classes.name,
      })
      .from(students)
      .leftJoin(
        users,
        and(
          eq(users.id, students.id),
          eq(users.role, "student"),
          eq(users.isActive, true),
          isNull(users.deletedAt),
        ),
      )
      .leftJoin(
        classes,
        and(eq(users.kelasId, classes.id), isNull(classes.deletedAt)),
      )
      .where(and(eq(students.id, sessionUserId), isNull(students.deletedAt)))
      .limit(1);

    const ownRows = await resolveDesktopStudentGrades(db, ownRecordRows);
    const ownAccount = accountRows[0];
    return apiOk({
      data: ownRows.map((row) => ({
        ...row,
        hasAccount: Boolean(ownAccount?.id),
        accountEmail: ownAccount?.email ?? null,
      })),
      total: ownRows.length,
      page: 1,
      totalPages: 1,
    });
  }

  const guard = ensureRole(["admin", "super_admin"]);
  if (guard) return guard;

  const page = Math.max(Number(url.searchParams.get("page") || "1"), 1);
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit") || "12"), 1),
    50,
  );
  const search = url.searchParams.get("search")?.trim() || "";
  const sortBy = url.searchParams.get("sortBy") || "createdAt";
  const sortDir = url.searchParams.get("sortDir") === "asc" ? "asc" : "desc";
  const includeStats = url.searchParams.get("includeStats") === "1";
  const includeAttendanceToday =
    url.searchParams.get("includeAttendanceToday") === "1";
  const attendanceDate = normalizeStudentDate(url.searchParams.get("date"));
  const offset = (page - 1) * limit;

  if (includeAttendanceToday && !attendanceDate) {
    return apiError("Parameter date wajib format YYYY-MM-DD", 400);
  }

  let conditions = isNull(students.deletedAt);
  if (search) {
    const query = `%${search}%`;
    const searchCondition = or(
      like(students.fullName, query),
      like(students.nis, query),
      like(students.grade, query),
      like(students.nisn, query),
    );

    if (searchCondition) {
      const mergedCondition = and(conditions, searchCondition);
      if (mergedCondition) {
        conditions = mergedCondition;
      }
    }
  }

  const [rawRows, totalResult, stats] = await Promise.all([
    db
      .select({
        id: students.id,
        nis: students.nis,
        nisn: students.nisn,
        fullName: students.fullName,
        gender: students.gender,
        grade: students.grade,
        parentName: students.parentName,
        parentPhone: students.parentPhone,
        tempatLahir: students.tempatLahir,
        tanggalLahir: students.tanggalLahir,
        alamat: students.alamat,
        createdAt: students.createdAt,
        accountClassName: classes.name,
      })
      .from(students)
      .leftJoin(
        users,
        and(
          eq(users.id, students.id),
          eq(users.role, "student"),
          eq(users.isActive, true),
          isNull(users.deletedAt),
        ),
      )
      .leftJoin(
        classes,
        and(eq(users.kelasId, classes.id), isNull(classes.deletedAt)),
      )
      .where(conditions)
      .orderBy(
        sortBy === "fullName"
          ? sortDir === "asc"
            ? students.fullName
            : desc(students.fullName)
          : sortBy === "nis"
            ? sortDir === "asc"
              ? students.nis
              : desc(students.nis)
            : sortBy === "grade"
              ? sortDir === "asc"
                ? students.grade
                : desc(students.grade)
              : sortDir === "asc"
                ? students.createdAt
                : desc(students.createdAt),
      )
      .limit(limit)
      .offset(offset),
    db
      .select({ value: sql<number>`count(*)` })
      .from(students)
      .where(conditions),
    includeStats ? getDesktopStudentStatsSummary(db) : Promise.resolve(null),
  ]);

  const rows = await resolveDesktopStudentGrades(db, rawRows);
  const total = Number(totalResult[0]?.value || 0);
  const studentIds = rows.map((row) => row.id);
  let accountIds = new Set<string>();
  const attendanceMap =
    includeAttendanceToday && attendanceDate
      ? await getDesktopStudentAttendanceTodaySnapshotMap(
          db,
          studentIds,
          attendanceDate,
        )
      : new Map<string, DesktopStudentAttendanceTodaySnapshot>();

  if (studentIds.length > 0) {
    const accounts = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(
        and(
          inArray(users.id, studentIds),
          eq(users.role, "student"),
          eq(users.isActive, true),
          isNull(users.deletedAt),
        ),
      );
    accountIds = new Set(accounts.map((item) => item.id));
    const accountById = new Map(accounts.map((item) => [item.id, item.email]));

    return apiOk({
      data: rows.map((row) => ({
        ...row,
        hasAccount: accountIds.has(row.id),
        accountEmail: accountById.get(row.id) ?? null,
        attendanceToday: attendanceMap.get(row.id) ?? null,
      })),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      stats,
    });
  }

  return apiOk({
    data: rows.map((row) => ({
      ...row,
      hasAccount: accountIds.has(row.id),
      accountEmail: null,
      attendanceToday: attendanceMap.get(row.id) ?? null,
    })),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    stats,
  });
}

async function handleDesktopCreateStudent(body: unknown) {
  const guard = ensureRole(["admin", "super_admin"]);
  if (guard) return guard;

  const validation = desktopStudentCreateRequestSchema.safeParse(body);
  if (!validation.success) {
    return apiError(
      validation.error.issues[0]?.message || "Data siswa tidak valid",
      400,
      "VALIDATION_ERROR",
    );
  }

  const db = await getDb();
  const data = validation.data;
  const normalizedNis = data.nis.trim();
  const normalizedFullName = data.fullName.trim();
  const normalizedGrade = sanitizeClassDisplayName(data.grade);
  const normalizedAccountEmail = data.account?.email.trim().toLowerCase();
  const now = new Date();

  const existingStudentRows = await db
    .select({ id: students.id, deletedAt: students.deletedAt })
    .from(students)
    .where(eq(students.nis, normalizedNis))
    .limit(1);
  const existingStudent = existingStudentRows[0];

  if (existingStudent?.deletedAt === null) {
    return apiError("NIS sudah terdaftar", 409, "NIS_EXISTS");
  }

  if (normalizedAccountEmail) {
    const existingUserByEmail = await db
      .select({ id: users.id, deletedAt: users.deletedAt })
      .from(users)
      .where(eq(users.email, normalizedAccountEmail))
      .limit(1);

    if (
      existingUserByEmail[0] &&
      (existingUserByEmail[0].deletedAt === null ||
        existingUserByEmail[0].id !== (existingStudent?.id ?? null))
    ) {
      return apiError("Email akun siswa sudah terdaftar", 409, "EMAIL_EXISTS");
    }
  }

  const id = existingStudent?.id || data.id || crypto.randomUUID();

  if (existingStudent) {
    await db
      .update(students)
      .set({
        nis: normalizedNis,
        nisn: data.nisn || null,
        fullName: normalizedFullName,
        gender: data.gender,
        grade: normalizedGrade,
        parentName: data.parentName || null,
        parentPhone: data.parentPhone || null,
        tempatLahir: data.tempatLahir || null,
        tanggalLahir: data.tanggalLahir || null,
        alamat: data.alamat || null,
        deletedAt: null,
        syncStatus: "pending",
        updatedAt: now,
      })
      .where(eq(students.id, id));
  } else {
    await db.insert(students).values({
      id,
      nis: normalizedNis,
      nisn: data.nisn || null,
      fullName: normalizedFullName,
      gender: data.gender,
      grade: normalizedGrade,
      parentName: data.parentName || null,
      parentPhone: data.parentPhone || null,
      tempatLahir: data.tempatLahir || null,
      tanggalLahir: data.tanggalLahir || null,
      alamat: data.alamat || null,
      syncStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });
  }

  let userCreated = false;
  if (data.account && normalizedAccountEmail) {
    let kelasId: string | null = null;
    if (normalizedGrade && normalizedGrade !== "UNASSIGNED") {
      const classRows = await db
        .select({ id: classes.id })
        .from(classes)
        .where(
          and(eq(classes.name, normalizedGrade), isNull(classes.deletedAt)),
        )
        .limit(1);

      if (classRows.length > 0) {
        kelasId = classRows[0]?.id ?? null;
      } else {
        kelasId = crypto.randomUUID();
        await db.insert(classes).values({
          id: kelasId,
          name: normalizedGrade,
          academicYear: getStudentAcademicYearLabel(),
          isActive: true,
          syncStatus: "pending",
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    const passwordHash = await hashPassword(data.account.password);
    const existingUserById = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (existingUserById[0]?.role && existingUserById[0].role !== "student") {
      return apiError(
        "ID siswa sudah dipakai akun non-student",
        409,
        "ID_ROLE_CONFLICT",
      );
    }

    if (existingUserById[0]) {
      await db
        .update(users)
        .set({
          fullName: normalizedFullName,
          email: normalizedAccountEmail,
          role: "student",
          passwordHash,
          nis: normalizedNis,
          nisn: data.nisn || null,
          tempatLahir: data.tempatLahir || null,
          tanggalLahir: data.tanggalLahir || null,
          jenisKelamin: data.gender,
          alamat: data.alamat || null,
          kelasId,
          isActive: true,
          deletedAt: null,
          syncStatus: "pending",
          updatedAt: now,
        })
        .where(eq(users.id, id));
    } else {
      await db.insert(users).values({
        id,
        fullName: normalizedFullName,
        email: normalizedAccountEmail,
        role: "student",
        passwordHash,
        nis: normalizedNis,
        nisn: data.nisn || null,
        tempatLahir: data.tempatLahir || null,
        tanggalLahir: data.tanggalLahir || null,
        jenisKelamin: data.gender,
        alamat: data.alamat || null,
        kelasId,
        isActive: true,
        syncStatus: "pending",
        createdAt: now,
        updatedAt: now,
      });
    }

    userCreated = true;
  }

  return apiOk({ id, created: true, userCreated }, 201);
}

async function handleDesktopUpdateStudent(
  identifier: string | undefined,
  body: unknown,
) {
  const guard = ensureRole(["admin", "super_admin"]);
  if (guard) return guard;
  if (!identifier) {
    return apiError("Data siswa tidak ditemukan", 404, "NOT_FOUND");
  }

  const validation = desktopStudentUpdateRequestSchema.safeParse(body);
  if (!validation.success) {
    return apiError(
      validation.error.issues[0]?.message || "Data siswa tidak valid",
      400,
      "VALIDATION_ERROR",
    );
  }

  const db = await getDb();
  const existingStudent = await getDesktopStudentIdentity(db, identifier);
  if (!existingStudent) {
    return apiError("Data siswa tidak ditemukan", 404, "NOT_FOUND");
  }

  const payload = normalizeDesktopStudentPayload(validation.data);
  const id = existingStudent.id;
  const normalizedNis = payload.nis || existingStudent.nis;
  if (!normalizedNis) {
    return apiError("NIS wajib diisi", 400, "VALIDATION_ERROR");
  }

  const duplicateNis = await db
    .select({ id: students.id })
    .from(students)
    .where(eq(students.nis, normalizedNis))
    .limit(1);
  if (duplicateNis.length > 0 && duplicateNis[0]?.id !== id) {
    return apiError("NIS sudah terdaftar", 409, "NIS_EXISTS");
  }

  const now = new Date();
  await db
    .update(students)
    .set({
      nis: normalizedNis,
      nisn: payload.nisn ?? undefined,
      fullName: payload.fullName ?? undefined,
      gender: payload.gender ?? undefined,
      grade: payload.grade ?? undefined,
      parentName: payload.parentName ?? undefined,
      parentPhone: payload.parentPhone ?? undefined,
      tempatLahir: payload.tempatLahir ?? undefined,
      tanggalLahir: payload.tanggalLahir ?? undefined,
      alamat: payload.alamat ?? undefined,
      syncStatus: "pending",
      updatedAt: now,
    })
    .where(eq(students.id, id));

  let kelasId: string | null | undefined;
  if (payload.grade && payload.grade !== "UNASSIGNED") {
    const existingClass = await db
      .select({ id: classes.id })
      .from(classes)
      .where(and(eq(classes.name, payload.grade), isNull(classes.deletedAt)))
      .limit(1);

    if (existingClass.length > 0) {
      kelasId = existingClass[0]?.id ?? null;
    } else if (!isUuidLikeClassValue(payload.grade)) {
      kelasId = crypto.randomUUID();
      await db.insert(classes).values({
        id: kelasId,
        name: payload.grade,
        academicYear: getStudentAcademicYearLabel(),
        isActive: true,
        syncStatus: "pending",
        createdAt: now,
        updatedAt: now,
      });
    } else {
      kelasId = null;
    }
  } else {
    kelasId = null;
  }

  await db
    .update(users)
    .set({
      fullName: payload.fullName ?? undefined,
      nis: normalizedNis,
      nisn: payload.nisn ?? undefined,
      tempatLahir: payload.tempatLahir ?? undefined,
      tanggalLahir: payload.tanggalLahir ?? undefined,
      jenisKelamin: payload.gender ?? undefined,
      alamat: payload.alamat ?? undefined,
      kelasId,
      syncStatus: "pending",
      updatedAt: now,
    })
    .where(
      and(eq(users.id, id), eq(users.role, "student"), isNull(users.deletedAt)),
    );

  if (validation.data.account) {
    const account = validation.data.account;
    const normalizedEmail = account.email?.trim().toLowerCase();
    const hasPasswordInput = Boolean(
      account.password || account.confirmPassword,
    );

    if (hasPasswordInput && account.password !== account.confirmPassword) {
      return apiError(
        "Konfirmasi password akun siswa tidak cocok",
        400,
        "VALIDATION_ERROR",
      );
    }

    if (normalizedEmail) {
      const duplicateEmail = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      if (duplicateEmail.length > 0 && duplicateEmail[0]?.id !== id) {
        return apiError(
          "Email akun siswa sudah terdaftar",
          409,
          "EMAIL_EXISTS",
        );
      }
    }

    await db
      .update(users)
      .set({
        email: normalizedEmail || undefined,
        passwordHash: account.password
          ? await hashPassword(account.password)
          : undefined,
        syncStatus: "pending",
        updatedAt: now,
      })
      .where(
        and(
          eq(users.id, id),
          eq(users.role, "student"),
          isNull(users.deletedAt),
        ),
      );
  }

  return apiOk({ updated: true });
}

async function handleDesktopDeleteStudent(identifier: string | undefined) {
  const guard = ensureRole(["admin", "super_admin"]);
  if (guard) return guard;
  if (!identifier) {
    return apiError("Data siswa tidak ditemukan", 404, "NOT_FOUND");
  }

  const db = await getDb();
  const existingStudent = await getDesktopStudentIdentity(db, identifier);
  if (!existingStudent) {
    return apiError("Data siswa tidak ditemukan", 404, "NOT_FOUND");
  }

  const id = existingStudent.id;
  const deletedAt = new Date();
  await db
    .update(students)
    .set({
      deletedAt,
      syncStatus: "pending",
      updatedAt: deletedAt,
    })
    .where(eq(students.id, id));

  await db
    .update(users)
    .set({
      deletedAt,
      isActive: false,
      syncStatus: "pending",
      updatedAt: deletedAt,
    })
    .where(
      and(eq(users.id, id), eq(users.role, "student"), isNull(users.deletedAt)),
    );

  return apiOk({ deleted: true });
}

async function handleDesktopStudentImportRoute(body: unknown) {
  const guard = ensureRole(["admin", "super_admin"]);
  if (guard) return guard;

  try {
    return apiOk(await handleDesktopStudentImportRequest(body));
  } catch (error) {
    const routeError = toDesktopRouteErrorResponse(error);
    return apiError(routeError.message, routeError.status, routeError.code);
  }
}

async function handleStudents(
  url: URL,
  method: string,
  pathSegments: string[],
  body: unknown,
) {
  if (
    pathSegments.length === 3 &&
    pathSegments[2] === "import" &&
    method === "POST"
  ) {
    return handleDesktopStudentImportRoute(body);
  }

  if (pathSegments.length === 2 && method === "POST") {
    return handleDesktopCreateStudent(body);
  }

  if (pathSegments.length === 2 && method === "GET") {
    return handleDesktopStudentsList(url);
  }

  if (pathSegments.length === 3 && method === "PATCH") {
    return handleDesktopUpdateStudent(pathSegments[2], body);
  }

  if (pathSegments.length === 3 && method === "DELETE") {
    return handleDesktopDeleteStudent(pathSegments[2]);
  }

  if (
    pathSegments.length === 4 &&
    pathSegments[3] === "account" &&
    method === "POST"
  ) {
    return handleDesktopCreateStudentAccount(pathSegments[2], body);
  }

  if (
    pathSegments.length === 4 &&
    pathSegments[2] === "accounts" &&
    pathSegments[3] === "bulk" &&
    method === "POST"
  ) {
    return handleDesktopBulkCreateStudentAccounts(body);
  }

  if (
    pathSegments.length === 5 &&
    pathSegments[2] === "accounts" &&
    pathSegments[3] === "reset-password" &&
    pathSegments[4] === "bulk" &&
    method === "POST"
  ) {
    return handleDesktopBulkResetStudentPasswords(body);
  }

  if (
    pathSegments.length === 4 &&
    pathSegments[2] === "classes" &&
    pathSegments[3] === "legacy-groups" &&
    method === "GET"
  ) {
    return handleDesktopStudentLegacyGroups();
  }

  if (
    pathSegments.length === 4 &&
    pathSegments[2] === "classes" &&
    pathSegments[3] === "repair" &&
    method === "POST"
  ) {
    return handleDesktopStudentClassRepair(body);
  }

  if (
    pathSegments.length === 3 &&
    pathSegments[2] === "stats" &&
    method === "GET"
  ) {
    return handleDesktopStudentStats();
  }

  return null;
}

async function _handleClasses(
  method: string,
  pathSegments: string[],
  body: unknown,
) {
  if (pathSegments.length === 2) {
    if (method === "GET") {
      const guard = ensurePermission("academic:read");
      if (guard) return guard;
      return apiOk(await getClasses());
    }

    if (method === "POST") {
      const guard = ensurePermission("academic:write");
      if (guard) return guard;
      const result = await addClass(
        body as {
          name: string;
          academicYear: string;
          homeroomTeacherId?: string | null;
        },
      );

      if (!result.success) {
        return apiError(
          result.error,
          result.code === "CLASS_EXISTS"
            ? 409
            : result.code === "VALIDATION_ERROR" ||
                result.code === "INVALID_HOMEROOM_TEACHER"
              ? 400
              : 500,
          result.code,
        );
      }

      return apiOk({ id: result.id }, 201);
    }
  }

  if (pathSegments.length === 3) {
    const guard = ensurePermission("academic:write");
    if (guard) return guard;
    const id = pathSegments[2];

    if (method === "PATCH") {
      const result = await updateClass(
        id,
        body as {
          name: string;
          academicYear: string;
          homeroomTeacherId?: string | null;
        },
      );

      if (!result.success) {
        return apiError(
          result.error,
          result.code === "NOT_FOUND"
            ? 404
            : result.code === "CLASS_EXISTS"
              ? 409
              : result.code === "VALIDATION_ERROR" ||
                  result.code === "INVALID_HOMEROOM_TEACHER"
                ? 400
                : 500,
          result.code,
        );
      }

      return apiOk({ updated: true });
    }

    if (method === "DELETE") {
      const result = await deleteClass(id);

      if (!result.success) {
        return apiError(
          result.error,
          result.code === "NOT_FOUND"
            ? 404
            : result.code === "CLASS_IN_USE"
              ? 409
              : 500,
          result.code,
        );
      }

      return apiOk({ deleted: true });
    }
  }

  return null;
}

async function _handleAcademicYears(
  method: string,
  pathSegments: string[],
  body: unknown,
) {
  if (pathSegments.length === 2) {
    if (method === "GET") {
      const guard = ensurePermission("academic:read");
      if (guard) return guard;
      return apiOk(await getAcademicYears());
    }

    if (method === "POST") {
      const guard = ensurePermission("academic:write");
      if (guard) return guard;
      const result = await addAcademicYear(body as never);
      if (!result.success) {
        return apiError(
          result.error,
          result.code === "ACADEMIC_YEAR_EXISTS"
            ? 409
            : result.code === "VALIDATION_ERROR"
              ? 400
              : 500,
          result.code,
        );
      }

      return apiOk({ id: result.id }, 201);
    }
  }

  if (pathSegments.length === 3) {
    const guard = ensurePermission("academic:write");
    if (guard) return guard;
    const id = pathSegments[2];

    if (method === "PATCH") {
      const result = await updateAcademicYear(id, body as never);
      if (!result.success) {
        return apiError(
          result.error,
          result.code === "NOT_FOUND"
            ? 404
            : result.code === "ACADEMIC_YEAR_EXISTS"
              ? 409
              : result.code === "ACTIVE_ACADEMIC_YEAR_REQUIRED"
                ? 409
                : result.code === "VALIDATION_ERROR"
                  ? 400
                  : 500,
          result.code,
        );
      }

      return apiOk({ updated: true });
    }

    if (method === "DELETE") {
      const result = await deleteAcademicYear(id);
      if (!result.success) {
        return apiError(
          result.error,
          result.code === "NOT_FOUND"
            ? 404
            : result.code === "ACADEMIC_YEAR_IN_USE"
              ? 409
              : result.code === "ACTIVE_ACADEMIC_YEAR_REQUIRED"
                ? 409
                : 500,
          result.code,
        );
      }

      return apiOk({ deleted: true });
    }
  }

  return null;
}

async function _handleSemesters(
  method: string,
  pathSegments: string[],
  body: unknown,
) {
  if (pathSegments.length === 2) {
    if (method === "GET") {
      const guard = ensurePermission("academic:read");
      if (guard) return guard;
      return apiOk(await getSemesters());
    }

    if (method === "POST") {
      const guard = ensurePermission("academic:write");
      if (guard) return guard;
      const result = await addSemester(body as never);
      if (!result.success) {
        return apiError(
          result.error,
          result.code === "SEMESTER_EXISTS"
            ? 409
            : result.code === "VALIDATION_ERROR" ||
                result.code === "ACADEMIC_YEAR_NOT_FOUND"
              ? 400
              : 500,
          result.code,
        );
      }

      return apiOk({ id: result.id }, 201);
    }
  }

  if (pathSegments.length === 3) {
    const guard = ensurePermission("academic:write");
    if (guard) return guard;
    const id = pathSegments[2];

    if (method === "PATCH") {
      const result = await updateSemester(id, body as never);
      if (!result.success) {
        return apiError(
          result.error,
          result.code === "NOT_FOUND"
            ? 404
            : result.code === "SEMESTER_EXISTS"
              ? 409
              : result.code === "ACTIVE_SEMESTER_REQUIRED"
                ? 409
                : result.code === "VALIDATION_ERROR" ||
                    result.code === "ACADEMIC_YEAR_NOT_FOUND"
                  ? 400
                  : 500,
          result.code,
        );
      }

      return apiOk({ updated: true });
    }

    if (method === "DELETE") {
      const result = await deleteSemester(id);
      if (!result.success) {
        return apiError(
          result.error,
          result.code === "NOT_FOUND"
            ? 404
            : result.code === "SEMESTER_IN_USE"
              ? 409
              : result.code === "ACTIVE_SEMESTER_REQUIRED"
                ? 409
                : 500,
          result.code,
        );
      }

      return apiOk({ deleted: true });
    }
  }

  return null;
}

async function _handleSubjects(
  method: string,
  pathSegments: string[],
  body: unknown,
) {
  if (pathSegments.length === 2) {
    if (method === "GET") {
      const guard = ensurePermission("academic:read");
      if (guard) return guard;
      return apiOk(await getSubjects());
    }

    if (method === "POST") {
      const guard = ensurePermission("academic:write");
      if (guard) return guard;
      const result = await addSubject(body as { name: string; code: string });

      if (!result.success) {
        return apiError(
          result.error,
          result.code === "SUBJECT_CODE_EXISTS"
            ? 409
            : result.code === "VALIDATION_ERROR"
              ? 400
              : 500,
          result.code,
        );
      }

      return apiOk({ created: true }, 201);
    }
  }

  if (pathSegments.length === 3) {
    const guard = ensurePermission("academic:write");
    if (guard) return guard;
    const id = pathSegments[2];

    if (method === "PATCH") {
      const result = await updateSubject(
        id,
        body as { name: string; code: string },
      );

      if (!result.success) {
        return apiError(
          result.error,
          result.code === "NOT_FOUND"
            ? 404
            : result.code === "SUBJECT_CODE_EXISTS"
              ? 409
              : result.code === "VALIDATION_ERROR"
                ? 400
                : 500,
          result.code,
        );
      }

      return apiOk({ updated: true });
    }

    if (method === "DELETE") {
      const result = await deleteSubject(id);

      if (!result.success) {
        return apiError(
          result.error,
          result.code === "NOT_FOUND"
            ? 404
            : result.code === "SUBJECT_IN_USE"
              ? 409
              : 500,
          result.code,
        );
      }

      return apiOk({ deleted: true });
    }
  }

  return null;
}

async function _handleTeachingAssignments(
  url: URL,
  method: string,
  pathSegments: string[],
  body: unknown,
) {
  if (
    pathSegments.length === 3 &&
    pathSegments[2] === "schedule-legacy-repair" &&
    method === "POST"
  ) {
    const guard = ensurePermission("academic:write");
    if (guard) return guard;

    const payload = body as {
      mode?: string;
      legacyScheduleId?: string;
      guruMapelId?: string;
      limit?: number;
    };

    if (payload.mode === "ready_to_backfill") {
      return apiOk(
        await bulkRepairReadyLegacySchedules({ limit: payload.limit }),
      );
    }

    if (payload.mode === "already_canonical") {
      return apiOk(
        await bulkArchiveAlreadyCanonicalLegacySchedules({
          limit: payload.limit,
        }),
      );
    }

    const result = await repairLegacySchedule(
      payload as {
        legacyScheduleId: string;
        guruMapelId?: string;
      },
    );

    if (!result.success) {
      return apiError(
        result.error,
        result.code === "NOT_FOUND"
          ? 404
          : result.code === "LEGACY_TABLE_RETIRED"
            ? 410
            : result.code === "AMBIGUOUS_ASSIGNMENT"
              ? 409
              : result.code === "MISSING_ASSIGNMENT" ||
                  result.code === "INVALID_ASSIGNMENT_SELECTION"
                ? 400
                : 500,
        result.code,
      );
    }

    return apiOk(result);
  }

  if (
    pathSegments.length === 3 &&
    pathSegments[2] === "schedule-legacy-audit" &&
    method === "GET"
  ) {
    const guard = ensurePermission("academic:write");
    if (guard) return guard;

    const status = url.searchParams.get("status") || undefined;
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

    return apiOk(
      await getLegacyScheduleAuditReport({
        status:
          status === "already_canonical" ||
          status === "ready_to_backfill" ||
          status === "ambiguous_assignment" ||
          status === "missing_assignment"
            ? status
            : undefined,
        limit: Number.isFinite(limit) ? limit : undefined,
      }),
    );
  }

  if (pathSegments.length === 2) {
    if (method === "GET") {
      const guard = ensurePermission("academic:read");
      if (guard) return guard;
      if (url.searchParams.get("view") === "schedule-options") {
        return apiOk(await getTeachingAssignmentScheduleOptions());
      }
      return apiOk(await getTeachingAssignments());
    }

    if (method === "POST") {
      const guard = ensurePermission("academic:write");
      if (guard) return guard;
      const result = await addTeachingAssignment(body as never);

      if (!result.success) {
        return apiError(
          result.error,
          result.code === "TEACHING_ASSIGNMENT_EXISTS"
            ? 409
            : result.code === "VALIDATION_ERROR" ||
                result.code === "INVALID_TEACHER" ||
                result.code === "SUBJECT_NOT_FOUND" ||
                result.code === "CLASS_NOT_FOUND" ||
                result.code === "SEMESTER_NOT_FOUND"
              ? 400
              : 500,
          result.code,
        );
      }

      return apiOk({ id: result.id }, 201);
    }
  }

  if (pathSegments.length === 3) {
    const guard = ensurePermission("academic:write");
    if (guard) return guard;
    const id = pathSegments[2];

    if (method === "PATCH") {
      const result = await updateTeachingAssignment(id, body as never);
      if (!result.success) {
        return apiError(
          result.error,
          result.code === "NOT_FOUND"
            ? 404
            : result.code === "TEACHING_ASSIGNMENT_EXISTS"
              ? 409
              : result.code === "VALIDATION_ERROR" ||
                  result.code === "INVALID_TEACHER" ||
                  result.code === "SUBJECT_NOT_FOUND" ||
                  result.code === "CLASS_NOT_FOUND" ||
                  result.code === "SEMESTER_NOT_FOUND"
                ? 400
                : 500,
          result.code,
        );
      }

      return apiOk({ updated: true });
    }

    if (method === "DELETE") {
      const result = await deleteTeachingAssignment(id);
      if (!result.success) {
        return apiError(
          result.error,
          result.code === "NOT_FOUND"
            ? 404
            : result.code === "TEACHING_ASSIGNMENT_IN_USE"
              ? 409
              : 500,
          result.code,
        );
      }

      return apiOk({ deleted: true });
    }
  }

  return null;
}

async function _handleSchedules(
  url: URL,
  method: string,
  pathSegments: string[],
  body: unknown,
) {
  if (pathSegments.length === 2) {
    if (method === "GET") {
      const guard = ensurePermission("academic:read");
      if (guard) return guard;
      const hariParam = url.searchParams.get("hari");
      const parsedHari =
        hariParam === null ? undefined : Number.parseInt(hariParam.trim(), 10);

      if (
        hariParam !== null &&
        (parsedHari === undefined ||
          !Number.isInteger(parsedHari) ||
          parsedHari < 0 ||
          parsedHari > 6)
      ) {
        return apiError("Filter hari tidak valid.", 400, "VALIDATION_ERROR");
      }

      return apiOk(
        await getSchedules({
          hari: parsedHari,
          search: url.searchParams.get("search") || undefined,
        }),
      );
    }

    if (method === "POST") {
      const guard = ensurePermission("academic:write");
      if (guard) return guard;
      const result = await addSchedule(body as never);

      if (!result.success) {
        return apiError(
          result.error,
          result.code === "SCHEDULE_EXISTS" ||
            result.code === "TEACHER_SCHEDULE_CONFLICT" ||
            result.code === "CLASS_SCHEDULE_CONFLICT" ||
            result.code === "ROOM_SCHEDULE_CONFLICT"
            ? 409
            : result.code === "VALIDATION_ERROR" ||
                result.code === "TEACHING_ASSIGNMENT_NOT_FOUND"
              ? 400
              : 500,
          result.code,
        );
      }

      return apiOk({ id: result.id }, 201);
    }
  }

  if (pathSegments.length === 3) {
    const guard = ensurePermission("academic:write");
    if (guard) return guard;
    const id = pathSegments[2];

    if (method === "PATCH") {
      const result = await updateSchedule(id, body as never);

      if (!result.success) {
        return apiError(
          result.error,
          result.code === "NOT_FOUND"
            ? 404
            : result.code === "SCHEDULE_EXISTS" ||
                result.code === "TEACHER_SCHEDULE_CONFLICT" ||
                result.code === "CLASS_SCHEDULE_CONFLICT" ||
                result.code === "ROOM_SCHEDULE_CONFLICT"
              ? 409
              : result.code === "VALIDATION_ERROR" ||
                  result.code === "TEACHING_ASSIGNMENT_NOT_FOUND"
                ? 400
                : 500,
          result.code,
        );
      }

      return apiOk({ updated: true });
    }

    if (method === "DELETE") {
      const result = await deleteSchedule(id);

      if (!result.success) {
        return apiError(
          result.error,
          result.code === "NOT_FOUND" ? 404 : 500,
          result.code,
        );
      }

      return apiOk({ deleted: true });
    }
  }

  return null;
}

export async function handleDesktopLocalApiRequest(
  input: string,
  init?: {
    method?: string;
    body?: unknown;
  },
): Promise<DesktopApiResponse> {
  if (!isTauri() || !input.startsWith("/api/")) {
    return null;
  }

  const url = new URL(input, "http://desktop.local");
  const method = init?.method?.toUpperCase() ?? "GET";
  const body = init?.body;
  const pathSegments = url.pathname.split("/").filter(Boolean);

  if (pathSegments[1] === "auth") {
    return handleDesktopAuthRoute(url.pathname, method, body, {
      logout: () => useStore.getState().logout(),
      handleLogin: handleDesktopLogin,
      handleChangePassword: handleDesktopChangePassword,
    });
  }

  if (pathSegments[1] === "sync") {
    return handleDesktopSyncRoute(url.pathname, method);
  }

  if (pathSegments[1] === "dashboard") {
    return handleDashboard(method, pathSegments);
  }

  if (pathSegments[1] === "students") {
    return handleDesktopStudentsRoute(url, method, pathSegments, init?.body, {
      handleStudents,
    });
  }

  if (pathSegments[1] === "attendance") {
    return handleDesktopAttendanceRoute(url, method, pathSegments, init?.body, {
      handleAttendance,
    });
  }

  if (
    pathSegments[1] === "classes" ||
    pathSegments[1] === "academic-years" ||
    pathSegments[1] === "semesters" ||
    pathSegments[1] === "subjects" ||
    pathSegments[1] === "teaching-assignments" ||
    pathSegments[1] === "schedules"
  ) {
    return handleDesktopAcademicRoute(url, method, pathSegments, init?.body, {
      ensurePermission,
    });
  }

  if (pathSegments[1] === "teachers") {
    return handleDesktopTeachersRoute(url, method, pathSegments, init?.body, {
      ensureRole,
      ensurePermission,
    });
  }

  return null;
}
