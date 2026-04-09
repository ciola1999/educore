import { requirePermission } from "@/lib/api/authz";
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

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  const guard = requirePermission(session, "attendance:read");
  if (guard) {
    return guard;
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit") || "20"), 1),
    500,
  );
  const offset = Math.max(Number(searchParams.get("offset") || "0"), 0);
  const sortBy =
    searchParams.get("sortBy") === "earliest" ? "earliest" : "latest";
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;
  const sessionUser = session?.user as SessionUserLike | undefined;
  const sessionUserId = sessionUser?.id;
  const sessionRole = sessionUser?.role;
  const requestedStudentId = searchParams.get("studentId") || undefined;
  const studentId =
    sessionRole === "student" ? sessionUserId : requestedStudentId;
  const status = searchParams.get("status") || undefined;
  const searchQuery = searchParams.get("searchQuery") || undefined;
  let className = searchParams.get("className") || undefined;
  const sourceParam = searchParams.get("source");
  const exportMode = searchParams.get("export") === "true";
  const summaryMode = searchParams.get("summary") === "true";
  const classSummaryMode = searchParams.get("classSummary") === "true";
  const studentSummaryMode = searchParams.get("studentSummary") === "true";
  const trendMode = searchParams.get("trend") === "true";
  const heatmapMode = searchParams.get("heatmap") === "true";
  const analyticsBundleMode = searchParams.get("analyticsBundle") === "true";
  const source =
    sourceParam === "qr" || sourceParam === "manual" || sourceParam === "all"
      ? sourceParam
      : undefined;

  if (
    sessionRole === "student" &&
    requestedStudentId &&
    requestedStudentId !== sessionUserId
  ) {
    return apiError("Forbidden", 403);
  }

  if (sessionRole !== "student") {
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
  }

  try {
    const attendanceService = await import(
      "@/core/services/attendance-service"
    );

    if (summaryMode) {
      const summary = await attendanceService.getAttendanceHistorySummary({
        startDate,
        endDate,
        sortBy,
        studentId,
        status,
        searchQuery,
        source,
        className,
      });

      return apiOk(summary);
    }

    if (classSummaryMode) {
      const summary = await attendanceService.getAttendanceHistoryClassSummary({
        startDate,
        endDate,
        sortBy,
        studentId,
        status,
        searchQuery,
        source,
        className,
      });

      return apiOk(summary);
    }

    if (studentSummaryMode) {
      const summary =
        await attendanceService.getAttendanceHistoryStudentSummary({
          startDate,
          endDate,
          sortBy,
          studentId,
          status,
          searchQuery,
          source,
          className,
        });

      return apiOk(summary);
    }

    if (trendMode) {
      const trend = await attendanceService.getAttendanceHistoryTrend({
        startDate,
        endDate,
        sortBy,
        studentId,
        status,
        searchQuery,
        source,
        className,
      });

      return apiOk(trend);
    }

    if (heatmapMode) {
      const heatmap = await attendanceService.getAttendanceHistoryHeatmap({
        startDate,
        endDate,
        sortBy,
        studentId,
        status,
        searchQuery,
        source,
        className,
      });

      return apiOk(heatmap);
    }

    if (analyticsBundleMode) {
      const analytics =
        await attendanceService.getAttendanceHistoryAnalyticsBundle({
          startDate,
          endDate,
          sortBy,
          studentId,
          status,
          searchQuery,
          source,
          className,
        });

      return apiOk(analytics);
    }

    const [data, total] = await Promise.all([
      exportMode
        ? attendanceService.getAttendanceHistoryExportRows({
            startDate,
            endDate,
            sortBy,
            studentId,
            status,
            searchQuery,
            source,
            className,
          })
        : attendanceService.getAttendanceHistory({
            startDate,
            endDate,
            sortBy,
            limit,
            offset,
            studentId,
            status,
            searchQuery,
            source,
            className,
          }),
      attendanceService.getAttendanceHistoryCount({
        startDate,
        endDate,
        sortBy,
        offset,
        studentId,
        status,
        searchQuery,
        source,
        className,
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
