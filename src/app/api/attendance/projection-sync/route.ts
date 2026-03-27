import { requireAnyPermission } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";
import { syncUsersToStudentsProjection } from "@/lib/services/student-projection";

export async function POST() {
  const session = await auth();
  const guard = requireAnyPermission(session, [
    "attendance:write",
    "academic:write",
  ]);
  if (guard) {
    return guard;
  }

  try {
    const result = await syncUsersToStudentsProjection();
    return apiOk(result);
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
