import {
  getAttendanceRiskSettings,
  upsertAttendanceRiskSettings,
} from "@/core/services/attendance-service";
import { requirePermission } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";

export async function GET() {
  const session = await auth();
  const guard = requirePermission(session, "attendance:read");
  if (guard) {
    return guard;
  }

  try {
    const settings = await getAttendanceRiskSettings();
    return apiOk(settings);
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Gagal memuat pengaturan risiko",
      400,
      "VALIDATION_ERROR",
    );
  }
}

export async function PUT(request: Request) {
  const session = await auth();
  const guard = requirePermission(session, "settings:manage");
  if (guard) {
    return guard;
  }

  try {
    const body = (await request.json()) as {
      alphaThreshold?: number;
      lateThreshold?: number;
      rateThreshold?: number;
    };

    const settings = await upsertAttendanceRiskSettings({
      alphaThreshold: Number(body.alphaThreshold ?? 0),
      lateThreshold: Number(body.lateThreshold ?? 0),
      rateThreshold: Number(body.rateThreshold ?? 0),
    });

    return apiOk(settings);
  } catch (error) {
    return apiError(
      error instanceof Error
        ? error.message
        : "Gagal menyimpan pengaturan risiko",
      400,
      "VALIDATION_ERROR",
    );
  }
}
