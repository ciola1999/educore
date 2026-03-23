import {
  getAttendanceSettings,
  upsertAttendanceSetting,
} from "@/core/services/attendance-service";
import { requirePermission } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";
import type { NewAttendanceSetting } from "@/lib/db/schema";

export async function GET() {
  const session = await auth();
  const guard = requirePermission(session, "attendance:read");
  if (guard) {
    return guard;
  }

  const data = await getAttendanceSettings();
  return apiOk(data);
}

export async function POST(request: Request) {
  const session = await auth();
  const guard = requirePermission(session, "attendance:write");
  if (guard) {
    return guard;
  }

  try {
    const body = (await request.json()) as NewAttendanceSetting;
    await upsertAttendanceSetting(body);
    return apiOk({ success: true });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Gagal menyimpan pengaturan",
      400,
    );
  }
}
