import { getAttendanceHistoryStudentOptions } from "@/core/services/attendance-service";
import { requireRole } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";

export async function GET(request: Request) {
  const session = await auth();
  const guard = requireRole(session, ["admin", "super_admin"]);
  if (guard) {
    return guard;
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || undefined;
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit") || "20"), 1),
      50,
    );

    return apiOk(await getAttendanceHistoryStudentOptions({ search, limit }));
  } catch (error) {
    return apiError(
      error instanceof Error
        ? error.message
        : "Gagal memuat opsi siswa attendance",
      400,
      "VALIDATION_ERROR",
    );
  }
}
