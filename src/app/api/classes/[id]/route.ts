import { requirePermission } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";
import { deleteClass, updateClass } from "@/lib/services/academic";

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
  const body = await request.json();
  const result = (await updateClass(id, body)) as {
    success: boolean;
    error?: string;
    code?: string;
  };

  if (!result.success) {
    return apiError(
      result.error || "Gagal memperbarui kelas",
      result.code === "NOT_FOUND"
        ? 404
        : result.code === "CLASS_EXISTS"
          ? 409
          : result.code === "VALIDATION_ERROR" ||
              result.code === "INVALID_HOMEROOM_TEACHER"
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
  const result = (await deleteClass(id)) as {
    success: boolean;
    error?: string;
    code?: string;
  };

  if (!result.success) {
    return apiError(
      result.error || "Gagal menghapus kelas",
      result.code === "NOT_FOUND"
        ? 404
        : result.code === "CLASS_IN_USE"
          ? 409
          : 500,
      result.code,
    );
  }

  return apiOk({ deleted: true });
}
