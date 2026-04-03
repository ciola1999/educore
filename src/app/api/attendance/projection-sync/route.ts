import { requireAnyPermission } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  const guard = requireAnyPermission(session, [
    "attendance:read",
    "attendance:write",
    "academic:read",
    "academic:write",
  ]);
  if (guard) {
    return guard;
  }

  try {
    const { syncUsersToStudentsProjection } = await import(
      "@/lib/services/student-projection"
    );
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
