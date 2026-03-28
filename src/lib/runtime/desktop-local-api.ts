import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { AUTH_ROLES, type AuthRole } from "@/core/auth/roles";
import { isTauri } from "@/core/env";
import { checkPermission, hasRole } from "@/lib/auth/rbac";
import {
  buildLoginEmailCandidates,
  normalizeLoginIdentifier,
} from "@/lib/auth/web/login-identifier";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
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
import { getLegacyScheduleAuditReport } from "@/lib/services/legacy-schedule-audit";
import {
  bulkArchiveAlreadyCanonicalLegacySchedules,
  bulkRepairReadyLegacySchedules,
  repairLegacySchedule,
} from "@/lib/services/legacy-schedule-repair";
import {
  addTeacher,
  deleteTeacher,
  getTeacherOptions,
  getTeachers,
  updateTeacher,
} from "@/lib/services/teacher";
import { useStore } from "@/lib/store/use-store";

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
  if (
    !userRow ||
    !isSupportedRole(userRow.role) ||
    !userRow.passwordHash ||
    !(await verifyDesktopPassword(password, userRow.passwordHash))
  ) {
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

  const userRow = userRows[0];
  if (!userRow?.passwordHash) {
    return apiError("Akun tidak ditemukan", 404, "USER_NOT_FOUND");
  }

  const isCurrentValid = await verifyDesktopPassword(
    currentPassword,
    userRow.passwordHash,
  );

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

  return apiOk({ changed: true });
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

function ensurePermission(permission: "academic:read" | "academic:write") {
  const user = getDesktopUser();
  if (!user) {
    return apiError("Unauthorized", 401);
  }
  if (!checkPermission(user, permission)) {
    return apiError("Forbidden", 403);
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
