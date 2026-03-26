import {
  getAttendanceHistory,
  getAttendanceHistoryAnalyticsBundle,
  getAttendanceHistoryClassSummary,
  getAttendanceHistoryCount,
  getAttendanceHistoryExportRows,
  getAttendanceHistoryHeatmap,
  getAttendanceHistoryStudentSummary,
  getAttendanceHistorySummary,
  getAttendanceHistoryTrend,
} from "@/core/services/attendance-service";
import { requirePermission } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";

type SessionUserLike = {
  id?: string;
  role?: string;
};

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
  const className = searchParams.get("className") || undefined;
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

  try {
    if (summaryMode) {
      const summary = await getAttendanceHistorySummary({
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
      const summary = await getAttendanceHistoryClassSummary({
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
      const summary = await getAttendanceHistoryStudentSummary({
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
      const trend = await getAttendanceHistoryTrend({
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
      const heatmap = await getAttendanceHistoryHeatmap({
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
      const analytics = await getAttendanceHistoryAnalyticsBundle({
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
        ? getAttendanceHistoryExportRows({
            startDate,
            endDate,
            sortBy,
            studentId,
            status,
            searchQuery,
            source,
            className,
          })
        : getAttendanceHistory({
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
      getAttendanceHistoryCount({
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
