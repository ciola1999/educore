import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
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
  users,
} from "@/lib/db/schema";
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
import {
  addTeacher,
  deleteTeacher,
  getTeacherOptions,
  getTeachers,
  updateTeacher,
} from "@/lib/services/teacher";
import { useStore } from "@/lib/store/use-store";
import { pullFromCloud, pushToCloud } from "@/lib/sync/turso-sync";

type DesktopApiResponse = Response | null;
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

function jsonResponse(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

function apiOk<T>(data: T, status = 200) {
  return jsonResponse({ success: true, data }, { status });
}

function apiError(message: string, status: number, code?: string) {
  return jsonResponse(
    {
      success: false,
      error: message,
      code,
    },
    { status },
  );
}

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

  if (pathSegments.length === 3 && pathSegments[2] === "classes") {
    if (method !== "GET") {
      return null;
    }
    const guard = ensurePermission("attendance:read");
    if (guard) return guard;

    const db = await getDb();
    const data = await db
      .select({ id: classes.id, name: classes.name })
      .from(classes)
      .where(isNull(classes.deletedAt));
    return apiOk(data);
  }

  if (pathSegments.length === 3 && pathSegments[2] === "student-options") {
    const guard = ensureRole(["admin", "super_admin"]);
    if (guard) return guard;
    if (method !== "GET") {
      return null;
    }

    const search = url.searchParams.get("search")?.trim() || undefined;
    const limit = Math.min(
      Math.max(Number(url.searchParams.get("limit") || "20"), 1),
      50,
    );
    return apiOk(await getAttendanceHistoryStudentOptions({ search, limit }));
  }

  if (pathSegments.length === 3 && pathSegments[2] === "students") {
    if (method !== "GET") {
      return null;
    }
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

  if (pathSegments.length === 3 && pathSegments[2] === "bulk") {
    if (method !== "POST") {
      return null;
    }
    const guard = ensurePermission("attendance:write");
    if (guard) return guard;
    if ((body as { classId?: string } | null)?.classId === "all") {
      return apiError(
        "classId=all hanya valid untuk baca data. Simpan absensi manual harus memilih satu kelas spesifik.",
        400,
        "INVALID_CLASS_SCOPE",
      );
    }
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

  if (pathSegments.length === 3 && pathSegments[2] === "today") {
    if (method !== "GET") {
      return null;
    }
    const guard = ensurePermission("attendance:read");
    if (guard) return guard;

    const records = await getTodayAttendanceRecords();
    const scopedRecords =
      sessionRole === "student" && sessionUserId
        ? records.filter((record) => record.studentId === sessionUserId)
        : records;
    return apiOk(scopedRecords);
  }

  if (pathSegments.length === 3 && pathSegments[2] === "scan") {
    if (method !== "POST") {
      return null;
    }
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

  if (pathSegments.length === 3 && pathSegments[2] === "history") {
    if (method !== "GET") {
      return null;
    }
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
    const studentSummaryMode =
      url.searchParams.get("studentSummary") === "true";
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

  if (pathSegments.length === 3 && pathSegments[2] === "settings") {
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

  if (
    pathSegments.length === 4 &&
    pathSegments[2] === "settings" &&
    method === "DELETE"
  ) {
    const guard = ensurePermission("attendance:write");
    if (guard) return guard;

    const id = pathSegments[3];
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

  if (pathSegments.length === 3 && pathSegments[2] === "holidays") {
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

  if (
    pathSegments.length === 4 &&
    pathSegments[2] === "holidays" &&
    method === "DELETE"
  ) {
    const guard = ensurePermission("attendance:write");
    if (guard) return guard;

    const id = pathSegments[3];
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

  if (pathSegments.length === 3 && pathSegments[2] === "risk-settings") {
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

  if (pathSegments.length === 3 && pathSegments[2] === "risk-insights") {
    if (method !== "GET") {
      return null;
    }
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

  if (pathSegments.length === 3 && pathSegments[2] === "risk-followups") {
    if (method !== "POST") {
      return null;
    }
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
        return apiError(
          "Payload follow-up tidak valid",
          400,
          "VALIDATION_ERROR",
        );
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

      await createAttendanceRiskFollowUp({
        actorUserId: sessionUserId,
        studentId: payload.studentId,
        riskFlags: normalizedRiskFlags,
        note: typeof payload.note === "string" ? payload.note : undefined,
        deadline:
          typeof payload.deadline === "string" ? payload.deadline : null,
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

  if (
    pathSegments.length === 4 &&
    pathSegments[2] === "risk-followups" &&
    pathSegments[3] === "history"
  ) {
    if (method !== "GET") {
      return null;
    }
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
        error instanceof Error
          ? error.message
          : "Gagal memuat riwayat follow-up",
        400,
        "VALIDATION_ERROR",
      );
    }
  }

  if (
    pathSegments.length === 4 &&
    pathSegments[2] === "risk-followups" &&
    method === "PATCH"
  ) {
    const guard = ensurePermission("attendance:write");
    if (guard) return guard;
    if (!sessionUserId) {
      return apiError("Unauthorized", 401);
    }

    const id = pathSegments[3];
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

  if (
    pathSegments.length === 5 &&
    pathSegments[2] === "risk-followups" &&
    pathSegments[4] === "history" &&
    method === "GET"
  ) {
    const guard = ensurePermission("attendance:read");
    if (guard) return guard;
    if (!sessionUserId) {
      return apiError("Unauthorized", 401);
    }

    const id = pathSegments[3];
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

async function handleClasses(
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

async function handleAcademicYears(
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

async function handleSemesters(
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

async function handleSubjects(
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

async function handleTeachers(
  url: URL,
  method: string,
  pathSegments: string[],
  body: unknown,
) {
  if (pathSegments.length === 2) {
    if (method === "GET") {
      if (url.searchParams.get("view") === "options") {
        const guard = ensurePermission("academic:write");
        if (guard) return guard;
        return apiOk(await getTeacherOptions());
      }

      const guard = ensureRole(["admin", "super_admin"]);
      if (guard) return guard;

      const teachers = await getTeachers({
        search: url.searchParams.get("search") || undefined,
        role:
          (url.searchParams.get("role") as
            | "admin"
            | "super_admin"
            | "teacher"
            | "staff"
            | undefined) || undefined,
        sortBy:
          (url.searchParams.get("sortBy") as
            | "fullName"
            | "email"
            | "createdAt"
            | undefined) || undefined,
        sortOrder:
          (url.searchParams.get("sortOrder") as "asc" | "desc" | undefined) ||
          undefined,
      });

      return apiOk(teachers);
    }

    if (method === "POST") {
      const guard = ensureRole(["admin", "super_admin"]);
      if (guard) return guard;
      const result = await addTeacher(body as never);

      if (!result.success) {
        return apiError(
          result.error,
          result.code === "VALIDATION_ERROR"
            ? 400
            : result.code === "EMAIL_EXISTS"
              ? 409
              : 500,
          result.code,
        );
      }

      return apiOk({ id: result.id }, 201);
    }
  }

  if (pathSegments.length === 3) {
    const guard = ensureRole(["admin", "super_admin"]);
    if (guard) return guard;
    const id = pathSegments[2];

    if (method === "PATCH") {
      const result = await updateTeacher(id, body as never);

      if (!result.success) {
        return apiError(
          result.error,
          result.code === "VALIDATION_ERROR"
            ? 400
            : result.code === "EMAIL_EXISTS"
              ? 409
              : result.code === "TEACHER_IN_USE"
                ? 409
                : result.code === "NOT_FOUND"
                  ? 404
                  : 500,
          result.code,
        );
      }

      return apiOk({ updated: true });
    }

    if (method === "DELETE") {
      const result = await deleteTeacher(id);
      if (!result.success) {
        return apiError(
          result.error,
          result.code === "NOT_FOUND"
            ? 404
            : result.code === "TEACHER_IN_USE"
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

async function handleTeachingAssignments(
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

async function handleSchedules(
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

  if (url.pathname === "/api/teachers/import") {
    return apiError(
      "Import Excel user belum tersedia di desktop production. Gunakan runtime web atau bun tauri dev.",
      501,
      "DESKTOP_ROUTE_NOT_IMPLEMENTED",
    );
  }

  if (url.pathname === "/api/auth/logout" && method === "POST") {
    useStore.getState().logout();
    return apiOk({ message: "Logout berhasil" });
  }

  if (url.pathname === "/api/auth/login" && method === "POST") {
    return handleDesktopLogin(body);
  }

  if (url.pathname === "/api/auth/change-password" && method === "POST") {
    return handleDesktopChangePassword(body);
  }

  if (pathSegments[1] === "dashboard") {
    return handleDashboard(method, pathSegments);
  }

  if (pathSegments[1] === "attendance") {
    return handleAttendance(url, method, pathSegments, init?.body);
  }

  if (pathSegments[1] === "classes") {
    return handleClasses(method, pathSegments, init?.body);
  }

  if (pathSegments[1] === "academic-years") {
    return handleAcademicYears(method, pathSegments, init?.body);
  }

  if (pathSegments[1] === "semesters") {
    return handleSemesters(method, pathSegments, init?.body);
  }

  if (pathSegments[1] === "subjects") {
    return handleSubjects(method, pathSegments, init?.body);
  }

  if (pathSegments[1] === "teaching-assignments") {
    return handleTeachingAssignments(url, method, pathSegments, init?.body);
  }

  if (pathSegments[1] === "schedules") {
    return handleSchedules(url, method, pathSegments, init?.body);
  }

  if (pathSegments[1] === "teachers") {
    return handleTeachers(url, method, pathSegments, init?.body);
  }

  return null;
}
