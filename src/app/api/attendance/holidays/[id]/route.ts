import { deleteHoliday } from "@/core/services/attendance-service";
import { requirePermission } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  const guard = requirePermission(session, "attendance:write");
  if (guard) {
    return guard;
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return apiError("ID hari libur tidak valid", 400);
  }

  try {
    await deleteHoliday(id);
    return apiOk({ success: true });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Gagal menghapus hari libur",
      500,
      "ATTENDANCE_HOLIDAY_DELETE_FAILED",
    );
  }
}
