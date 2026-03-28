import { requirePermission } from "@/lib/api/authz";
import { apiCreated, apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";
import { addSchedule, getSchedules } from "@/lib/services/academic";

export async function GET(request: Request) {
  const session = await auth();
  const guard = requirePermission(session, "academic:read");
  if (guard) {
    return guard;
  }

  const url = new URL(request.url);
  const hariParam = url.searchParams.get("hari");
  const parsedHari =
    hariParam === null ? undefined : Number.parseInt(hariParam.trim(), 10);

  if (
    hariParam !== null &&
    (parsedHari === undefined ||
      !Number.isInteger(parsedHari) ||
      parsedHari < 0 ||
      parsedHari > 6)
  ) {
    return apiError("Filter hari tidak valid.", 400, "VALIDATION_ERROR");
  }

  return apiOk(
    await getSchedules({
      hari: parsedHari,
      search: url.searchParams.get("search") || undefined,
    }),
  );
}

export async function POST(request: Request) {
  const session = await auth();
  const guard = requirePermission(session, "academic:write");
  if (guard) {
    return guard;
  }

  const result = await addSchedule(await request.json());
  if (!result.success) {
    return apiError(
      result.error,
      result.code === "SCHEDULE_EXISTS" ||
        result.code === "TEACHER_SCHEDULE_CONFLICT" ||
        result.code === "CLASS_SCHEDULE_CONFLICT" ||
        result.code === "ROOM_SCHEDULE_CONFLICT"
        ? 409
        : result.code === "VALIDATION_ERROR" ||
            result.code === "TEACHING_ASSIGNMENT_NOT_FOUND"
          ? 400
          : 500,
      result.code,
    );
  }

  return apiCreated({ id: result.id });
}
