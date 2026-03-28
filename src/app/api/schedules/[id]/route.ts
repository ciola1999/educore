import { requirePermission } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";
import { deleteSchedule, updateSchedule } from "@/lib/services/academic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const guard = requirePermission(session, "academic:write");
  if (guard) {
    return guard;
  }

  const { id } = await context.params;
  const result = await updateSchedule(id, await request.json());
  if (!result.success) {
    return apiError(
      result.error,
      result.code === "NOT_FOUND"
        ? 404
        : result.code === "SCHEDULE_EXISTS" ||
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

  return apiOk({ updated: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const guard = requirePermission(session, "academic:write");
  if (guard) {
    return guard;
  }

  const { id } = await context.params;
  const result = await deleteSchedule(id);
  if (!result.success) {
    return apiError(
      result.error,
      result.code === "NOT_FOUND" ? 404 : 500,
      result.code,
    );
  }

  return apiOk({ deleted: true });
}
