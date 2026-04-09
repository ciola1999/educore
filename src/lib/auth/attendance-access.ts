import { and, eq, inArray, isNull } from "drizzle-orm";
import type { AuthRole } from "@/core/auth/roles";
import type { getDb } from "@/lib/db";
import { classes, users } from "@/lib/db/schema";

type DbClient = Awaited<ReturnType<typeof getDb>>;

export type AttendanceAccessUser = {
  id?: string | null;
  role?: string | null;
};

export type AttendanceAccessScope = {
  userId: string;
  role: AuthRole;
  hasRosterAccess: boolean;
  hasGlobalClassAccess: boolean;
  classIds: string[];
};

export type ResolvedAttendanceClassNameFilter =
  | {
      ok: true;
      className: string | undefined;
    }
  | {
      ok: false;
      code:
        | "FORBIDDEN"
        | "ATTENDANCE_CLASS_FORBIDDEN"
        | "ATTENDANCE_CLASS_FILTER_REQUIRED";
      message: string;
    };

function normalizeAttendanceClassName(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase() || "";
}

const GLOBAL_ATTENDANCE_CLASS_ROLES: AuthRole[] = [
  "super_admin",
  "admin",
  "staff",
];

const ROSTER_ATTENDANCE_ROLES: AuthRole[] = [
  "super_admin",
  "admin",
  "staff",
  "teacher",
];

export async function resolveAttendanceAccessScope(
  db: DbClient,
  user: AttendanceAccessUser | null | undefined,
): Promise<AttendanceAccessScope | null> {
  const userId = user?.id?.trim();
  if (!userId) {
    return null;
  }

  const userRows = await db
    .select({
      id: users.id,
      role: users.role,
      kelasId: users.kelasId,
      isActive: users.isActive,
    })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);

  const dbUser = userRows[0];
  if (!dbUser?.isActive) {
    return null;
  }

  const role = dbUser.role;
  const hasGlobalClassAccess = GLOBAL_ATTENDANCE_CLASS_ROLES.includes(role);
  const hasRosterAccess = ROSTER_ATTENDANCE_ROLES.includes(role);

  if (hasGlobalClassAccess || role !== "teacher") {
    return {
      userId,
      role,
      hasRosterAccess,
      hasGlobalClassAccess,
      classIds: dbUser.kelasId ? [dbUser.kelasId] : [],
    };
  }

  const directClassIds = dbUser.kelasId ? [dbUser.kelasId] : [];
  const homeroomRows = await db
    .select({ id: classes.id })
    .from(classes)
    .where(
      and(
        eq(classes.homeroomTeacherId, userId),
        eq(classes.isActive, true),
        isNull(classes.deletedAt),
      ),
    );

  const classIds = Array.from(
    new Set([...directClassIds, ...homeroomRows.map((row) => row.id)]),
  );

  return {
    userId,
    role,
    hasRosterAccess,
    hasGlobalClassAccess: false,
    classIds,
  };
}

export async function getAuthorizedAttendanceClasses(
  db: DbClient,
  scope: AttendanceAccessScope,
) {
  if (!scope.hasRosterAccess) {
    return [];
  }

  if (scope.hasGlobalClassAccess) {
    return db
      .select({ id: classes.id, name: classes.name })
      .from(classes)
      .where(isNull(classes.deletedAt));
  }

  if (scope.classIds.length === 0) {
    return [];
  }

  return db
    .select({ id: classes.id, name: classes.name })
    .from(classes)
    .where(and(inArray(classes.id, scope.classIds), isNull(classes.deletedAt)));
}

export async function getAuthorizedAttendanceClassNames(
  db: DbClient,
  scope: AttendanceAccessScope,
) {
  const rows = await getAuthorizedAttendanceClasses(db, scope);
  return Array.from(
    new Set(rows.map((row) => row.name.trim()).filter(Boolean)),
  );
}

export function canAccessAttendanceClass(
  scope: AttendanceAccessScope,
  classId: string,
) {
  if (!scope.hasRosterAccess) {
    return false;
  }

  if (scope.hasGlobalClassAccess) {
    return true;
  }

  if (classId === "all") {
    return false;
  }

  return scope.classIds.includes(classId);
}

export function canAccessAttendanceClassName(
  scope: AttendanceAccessScope,
  classNames: string[],
  className: string,
) {
  if (!scope.hasRosterAccess) {
    return false;
  }

  if (scope.hasGlobalClassAccess) {
    return true;
  }

  const normalizedRequestedClassName = normalizeAttendanceClassName(className);

  return classNames.some(
    (candidate) =>
      normalizeAttendanceClassName(candidate) === normalizedRequestedClassName,
  );
}

export function resolveAttendanceClassNameFilter(
  scope: AttendanceAccessScope,
  classNames: string[],
  requestedClassName?: string | null,
): ResolvedAttendanceClassNameFilter {
  if (!scope.hasRosterAccess) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Forbidden",
    };
  }

  const normalizedRequestedClassName = requestedClassName?.trim() || undefined;
  if (scope.hasGlobalClassAccess) {
    return {
      ok: true,
      className: normalizedRequestedClassName,
    };
  }

  if (normalizedRequestedClassName) {
    if (
      canAccessAttendanceClassName(
        scope,
        classNames,
        normalizedRequestedClassName,
      )
    ) {
      const matchedClassName =
        classNames.find(
          (candidate) =>
            normalizeAttendanceClassName(candidate) ===
            normalizeAttendanceClassName(normalizedRequestedClassName),
        ) ?? normalizedRequestedClassName;

      return {
        ok: true,
        className: matchedClassName,
      };
    }

    return {
      ok: false,
      code: "ATTENDANCE_CLASS_FORBIDDEN",
      message: "Kamu tidak punya akses ke kelas attendance ini.",
    };
  }

  if (classNames.length === 0) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Forbidden",
    };
  }

  if (classNames.length === 1) {
    return {
      ok: true,
      className: classNames[0],
    };
  }

  return {
    ok: false,
    code: "ATTENDANCE_CLASS_FILTER_REQUIRED",
    message:
      "Pilih satu kelas attendance yang kamu pegang untuk melihat data ini.",
  };
}
