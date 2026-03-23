import { requireRole } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";
import { deleteTeacher, updateTeacher } from "@/lib/services/teacher";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const guard = requireRole(session, ["admin", "super_admin"]);
  if (guard) {
    return guard;
  }

  const { id } = await context.params;
  const body = await request.json();
  const result = await updateTeacher(id, body);

  if (!result.success) {
    return apiError(
      result.error,
      result.code === "VALIDATION_ERROR"
        ? 400
        : result.code === "EMAIL_EXISTS"
          ? 409
          : result.code === "NOT_FOUND"
            ? 404
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
  const guard = requireRole(session, ["admin", "super_admin"]);
  if (guard) {
    return guard;
  }

  const { id } = await context.params;
  const success = await deleteTeacher(id);

  if (!success) {
    return apiError("Gagal menghapus guru", 500);
  }

  return apiOk({ deleted: true });
}
