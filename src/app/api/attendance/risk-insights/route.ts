import {
  getAttendanceRiskAssignmentSummary,
  getAttendanceRiskNotificationSummary,
  getAttendanceRiskNotifications,
  getAttendanceRiskSettings,
  getAttendanceRiskStudents,
} from "@/core/services/attendance-service";
import { requireRole } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import {
  getAuthorizedAttendanceClassNames,
  resolveAttendanceAccessScope,
  resolveAttendanceClassNameFilter,
} from "@/lib/auth/attendance-access";
import { auth } from "@/lib/auth/web/auth";
import { getDb } from "@/lib/db";

type SessionUserLike = {
  id?: string;
  role?: string;
};

function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function isDisabledParam(value: string | null) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "0" || normalized === "false" || normalized === "no";
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  const guard = requireRole(session, [
    "admin",
    "super_admin",
    "teacher",
    "staff",
  ]);
  if (guard) {
    return guard;
  }

  const sessionUser = session?.user as SessionUserLike | undefined;
  if (!sessionUser?.id) {
    return apiError("Unauthorized", 401);
  }

  try {
    const { startDate, endDate } = getCurrentMonthRange();
    const url = new URL(request.url);
    let className = url.searchParams.get("className")?.trim() || undefined;
    const requestedAssigneeId =
      url.searchParams.get("assigneeUserId")?.trim() || undefined;
    const includeStudents = !isDisabledParam(
      url.searchParams.get("includeStudents"),
    );
    const includeAssignmentSummary = !isDisabledParam(
      url.searchParams.get("includeAssignmentSummary"),
    );
    const db = await getDb();
    const scope = await resolveAttendanceAccessScope(db, session?.user);
    if (!scope || !scope.hasRosterAccess) {
      return apiError("Forbidden", 403, "FORBIDDEN");
    }
    const classNames = await getAuthorizedAttendanceClassNames(db, scope);
    const resolvedClassFilter = resolveAttendanceClassNameFilter(
      scope,
      classNames,
      className,
    );
    if (!resolvedClassFilter.ok) {
      return apiError(
        resolvedClassFilter.message,
        resolvedClassFilter.code === "ATTENDANCE_CLASS_FILTER_REQUIRED"
          ? 400
          : 403,
        resolvedClassFilter.code,
      );
    }
    className = resolvedClassFilter.className;
    const canViewAssignmentSummary =
      sessionUser.role === "admin" || sessionUser.role === "super_admin";
    const assigneeUserId =
      canViewAssignmentSummary && requestedAssigneeId
        ? requestedAssigneeId
        : sessionUser.id;
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
