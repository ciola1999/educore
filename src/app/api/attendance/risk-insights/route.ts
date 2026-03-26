import {
  getAttendanceRiskAssignmentSummary,
  getAttendanceRiskNotificationSummary,
  getAttendanceRiskNotifications,
  getAttendanceRiskSettings,
  getAttendanceRiskStudents,
} from "@/core/services/attendance-service";
import { requireRole } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";

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
    const className = url.searchParams.get("className")?.trim() || undefined;
    const requestedAssigneeId =
      url.searchParams.get("assigneeUserId")?.trim() || undefined;
    const canViewAssignmentSummary =
      sessionUser.role === "admin" || sessionUser.role === "super_admin";
    const assigneeUserId =
      canViewAssignmentSummary && requestedAssigneeId
        ? requestedAssigneeId
        : sessionUser.id;
    const settings = await getAttendanceRiskSettings();
    const [students, notifications, notificationSummary, assignmentSummary] =
      await Promise.all([
        getAttendanceRiskStudents({ startDate, endDate, className }, settings),
        getAttendanceRiskNotifications(assigneeUserId),
        getAttendanceRiskNotificationSummary(assigneeUserId),
        canViewAssignmentSummary
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
