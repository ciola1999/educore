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
  };

  if (!result.success) {
    return apiError(result.error || "Gagal memperbarui mata pelajaran", 400);
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
  };

  if (!result.success) {
    return apiError(result.error || "Gagal menghapus mata pelajaran", 400);
  }

  return apiOk({ deleted: true });
}
