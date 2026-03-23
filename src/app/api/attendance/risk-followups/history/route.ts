import { getAttendanceRiskFollowUpHistory } from "@/core/services/attendance-service";
import { requirePermission } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";

export async function GET(request: Request) {
  const session = await auth();
  const guard = requirePermission(session, "attendance:read");
  if (guard) {
    return guard;
  }

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId");

  if (!studentId) {
    return apiError("studentId wajib diisi", 400, "VALIDATION_ERROR");
  }

  try {
    const history = await getAttendanceRiskFollowUpHistory(studentId);
    return apiOk(history);
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Gagal memuat riwayat follow-up",
      400,
      "VALIDATION_ERROR",
    );
  }
}
