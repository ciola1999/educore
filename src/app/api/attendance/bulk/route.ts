import { requirePermission } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import {
  canAccessAttendanceClass,
  resolveAttendanceAccessScope,
} from "@/lib/auth/attendance-access";
import { auth } from "@/lib/auth/web/auth";
import { getDb } from "@/lib/db";
import { bulkAttendanceSchema } from "@/lib/validations/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  const guard = requirePermission(session, "attendance:write");
  if (guard) {
    return guard;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Body request attendance tidak valid", 400, "INVALID_JSON");
  }

  if (
    typeof body === "object" &&
    body !== null &&
    "classId" in body &&
    body.classId === "all"
  ) {
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

  const db = await getDb();
  const scope = await resolveAttendanceAccessScope(db, session?.user);
  if (!scope || !scope.hasRosterAccess) {
    return apiError("Forbidden", 403, "FORBIDDEN");
  }

  const parsedBody = bulkAttendanceSchema
    .omit({ recordedBy: true })
    .safeParse(body);
  if (!parsedBody.success) {
    return apiError(
      parsedBody.error.issues[0]?.message || "Payload attendance tidak valid",
      400,
      "VALIDATION_ERROR",
    );
  }
  if (!canAccessAttendanceClass(scope, parsedBody.data.classId)) {
    return apiError(
      "Kamu tidak punya akses ke kelas attendance ini.",
      403,
      "ATTENDANCE_CLASS_FORBIDDEN",
    );
  }

  const { recordBulkAttendance } = await import(
    "@/core/services/attendance-service"
  );
  const result = await recordBulkAttendance({
    ...parsedBody.data,
    recordedBy: userId,
  });

  if (!result.success) {
    return apiError(result.message, 400);
  }

  return apiOk(result);
}
