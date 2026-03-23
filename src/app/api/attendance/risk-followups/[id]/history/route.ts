import { getAttendanceRiskFollowUpAuditTrail } from "@/core/services/attendance-service";
import { requirePermission } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";

type SessionUserLike = {
  id?: string;
  role?: string;
};

export async function GET(
  _request: Request,
  context: { params: Promise<unknown> },
) {
  const session = await auth();
  const guard = requirePermission(session, "attendance:read");
  if (guard) {
    return guard;
  }

  const sessionUser = session?.user as SessionUserLike | undefined;
  if (!sessionUser?.id) {
    return apiError("Unauthorized", 401);
  }

  try {
    const params = (await context.params) as { id?: string };
    if (!params.id) {
      return apiError("ID follow-up tidak valid", 400, "VALIDATION_ERROR");
    }

    const rows = await getAttendanceRiskFollowUpAuditTrail(
      params.id,
      sessionUser.id,
      {
        allowAnyAssignee:
          sessionUser.role === "admin" || sessionUser.role === "super_admin",
      },
    );
    return apiOk(rows);
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Gagal memuat audit trail",
      400,
      "VALIDATION_ERROR",
    );
  }
}
