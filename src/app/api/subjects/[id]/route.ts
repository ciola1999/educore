import { requirePermission } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";
import { deleteSubject, updateSubject } from "@/lib/services/academic";

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
  const result = (await updateSubject(id, body)) as {
    success: boolean;
    error?: string;
    code?: string;
  };

  if (!result.success) {
    return apiError(
      result.error || "Gagal memperbarui mata pelajaran",
      result.code === "NOT_FOUND"
        ? 404
        : result.code === "SUBJECT_CODE_EXISTS"
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
  const result = (await deleteSubject(id)) as {
    success: boolean;
    error?: string;
    code?: string;
  };

  if (!result.success) {
    return apiError(
      result.error || "Gagal menghapus mata pelajaran",
      result.code === "NOT_FOUND"
        ? 404
        : result.code === "SUBJECT_IN_USE"
          ? 409
          : 500,
      result.code,
    );
  }

  return apiOk({ deleted: true });
}
