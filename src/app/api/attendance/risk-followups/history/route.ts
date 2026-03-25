import { getAttendanceRiskFollowUpHistory } from "@/core/services/attendance-service";
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

  const sessionUser = session?.user as SessionUserLike | undefined;
  if (!sessionUser?.id) {
    return apiError("Unauthorized", 401);
  }

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId")?.trim();

  if (!studentId) {
    return apiError("studentId wajib diisi", 400, "VALIDATION_ERROR");
  }

  const allowAnyAssignee =
    sessionUser.role === "admin" || sessionUser.role === "super_admin";
  if (!allowAnyAssignee && sessionUser.role === "student") {
    if (studentId !== sessionUser.id) {
      return apiError("Forbidden", 403, "FORBIDDEN");
    }
  }

  try {
    const history = await getAttendanceRiskFollowUpHistory(studentId, {
      assigneeUserId: sessionUser.id,
      allowAnyAssignee,
    });
    return apiOk(history);
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Gagal memuat riwayat follow-up",
      400,
      "VALIDATION_ERROR",
    );
  }
}
