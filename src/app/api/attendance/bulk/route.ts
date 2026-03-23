import { recordBulkAttendance } from "@/core/services/attendance-service";
import { requirePermission } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";

export async function POST(request: Request) {
  const session = await auth();
  const guard = requirePermission(session, "attendance:write");
  if (guard) {
    return guard;
  }

  const body = await request.json();
  if (body?.classId === "all") {
    return apiError(
      "classId=all hanya valid untuk baca data. Simpan absensi manual harus memilih satu kelas spesifik.",
      400,
      "INVALID_CLASS_SCOPE",
    );
  }

  const userId = session?.user?.id;
  if (!userId) {
    return apiError("Sesi user tidak valid", 401);
  }

  const result = await recordBulkAttendance({
    ...body,
    recordedBy: userId,
  });

  if (!result.success) {
    return apiError(result.message, 400);
  }

  return apiOk(result);
}
