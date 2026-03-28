import { requirePermission } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";
import { deleteSemester, updateSemester } from "@/lib/services/academic";

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
  const result = await updateSemester(id, await request.json());
  if (!result.success) {
    return apiError(
      result.error,
      result.code === "NOT_FOUND"
        ? 404
        : result.code === "SEMESTER_EXISTS"
          ? 409
          : result.code === "ACTIVE_SEMESTER_REQUIRED"
            ? 409
            : result.code === "VALIDATION_ERROR" ||
                result.code === "ACADEMIC_YEAR_NOT_FOUND"
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
  const result = await deleteSemester(id);
  if (!result.success) {
    return apiError(
      result.error,
      result.code === "NOT_FOUND"
        ? 404
        : result.code === "SEMESTER_IN_USE"
          ? 409
          : result.code === "ACTIVE_SEMESTER_REQUIRED"
            ? 409
            : 500,
      result.code,
    );
  }

  return apiOk({ deleted: true });
}
