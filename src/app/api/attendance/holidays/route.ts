import { addHoliday, getHolidays } from "@/core/services/attendance-service";
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
    const data = await getHolidays();
    return apiOk(data);
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Gagal memuat hari libur",
      500,
      "ATTENDANCE_HOLIDAYS_LOAD_FAILED",
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
    const body = (await request.json()) as {
      date?: string;
      name?: string;
    };
    await addHoliday(body.date ?? "", body.name ?? "");
    return apiOk({ success: true });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Gagal menyimpan hari libur",
      400,
    );
  }
}
