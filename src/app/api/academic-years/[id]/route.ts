import { requirePermission } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";
import {
  deleteAcademicYear,
  updateAcademicYear,
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
  const result = await updateAcademicYear(id, await request.json());
  if (!result.success) {
    return apiError(
      result.error,
      result.code === "NOT_FOUND"
        ? 404
        : result.code === "ACADEMIC_YEAR_EXISTS"
          ? 409
          : result.code === "ACTIVE_ACADEMIC_YEAR_REQUIRED"
            ? 409
            : result.code === "VALIDATION_ERROR"
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
  const result = await deleteAcademicYear(id);
  if (!result.success) {
    return apiError(
      result.error,
      result.code === "NOT_FOUND"
        ? 404
        : result.code === "ACADEMIC_YEAR_IN_USE"
          ? 409
          : result.code === "ACTIVE_ACADEMIC_YEAR_REQUIRED"
            ? 409
            : 500,
      result.code,
    );
  }

  return apiOk({ deleted: true });
}
