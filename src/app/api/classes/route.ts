import { requirePermission } from "@/lib/api/authz";
import { apiCreated, apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";
import { addClass, getClasses } from "@/lib/services/academic";

export async function GET() {
  const session = await auth();
  const guard = requirePermission(session, "academic:read");
  if (guard) {
    return guard;
  }

  const data = await getClasses();
  return apiOk(data);
}

export async function POST(request: Request) {
  const session = await auth();
  const guard = requirePermission(session, "academic:write");
  if (guard) {
    return guard;
  }

  const body = await request.json();
  const result = (await addClass(body)) as {
    success: boolean;
    error?: string;
    code?: string;
    id?: string;
  };

  if (!result.success) {
    return apiError(
      result.error || "Gagal membuat kelas",
      result.code === "CLASS_EXISTS"
        ? 409
        : result.code === "VALIDATION_ERROR" ||
            result.code === "INVALID_HOMEROOM_TEACHER"
          ? 400
          : 500,
      result.code,
    );
  }

  return apiCreated({ id: result.id });
}
