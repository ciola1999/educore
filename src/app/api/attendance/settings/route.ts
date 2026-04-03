import { requirePermission } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";
import type { NewAttendanceSetting } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const guard = requirePermission(session, "attendance:read");
  if (guard) {
    return guard;
  }

  try {
    const { getAttendanceSettings } = await import(
      "@/core/services/attendance-service"
    );
    const data = await getAttendanceSettings();
    return apiOk(data);
  } catch (error) {
    return apiError(
      error instanceof Error
        ? error.message
        : "Gagal memuat pengaturan absensi",
      500,
      "ATTENDANCE_SETTINGS_LOAD_FAILED",
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  const guard = requirePermission(session, "attendance:write");
  if (guard) {
    return guard;
  }

  try {
    const body = (await request.json()) as NewAttendanceSetting;
    const { upsertAttendanceSetting } = await import(
      "@/core/services/attendance-service"
    );
    await upsertAttendanceSetting(body);
    return apiOk({ success: true });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Gagal menyimpan pengaturan",
      400,
    );
  }
}
