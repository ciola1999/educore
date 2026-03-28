import { requirePermission } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";
import {
  deleteTeachingAssignment,
  updateTeachingAssignment,
} from "@/lib/services/academic";

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
  const result = await updateTeachingAssignment(id, await request.json());
  if (!result.success) {
    return apiError(
      result.error,
      result.code === "NOT_FOUND"
        ? 404
        : result.code === "TEACHING_ASSIGNMENT_EXISTS"
          ? 409
          : result.code === "VALIDATION_ERROR" ||
              result.code === "INVALID_TEACHER" ||
              result.code === "SUBJECT_NOT_FOUND" ||
              result.code === "CLASS_NOT_FOUND" ||
              result.code === "SEMESTER_NOT_FOUND"
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
  const result = await deleteTeachingAssignment(id);
  if (!result.success) {
    return apiError(
      result.error,
      result.code === "NOT_FOUND"
        ? 404
        : result.code === "TEACHING_ASSIGNMENT_IN_USE"
          ? 409
          : 500,
      result.code,
    );
  }

  return apiOk({ deleted: true });
}
