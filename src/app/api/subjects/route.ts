import { requirePermission } from "@/lib/api/authz";
import { apiCreated, apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";
import { addSubject, getSubjects } from "@/lib/services/academic";

export async function GET() {
  const session = await auth();
  const guard = requirePermission(session, "academic:read");
  if (guard) {
    return guard;
  }

  const data = await getSubjects();
  return apiOk(data);
}

export async function POST(request: Request) {
  const session = await auth();
  const guard = requirePermission(session, "academic:write");
  if (guard) {
    return guard;
  }

  const body = await request.json();
  const result = (await addSubject(body)) as {
    success: boolean;
    error?: string;
    code?: string;
  };

  if (!result.success) {
    return apiError(
      result.error || "Gagal membuat mata pelajaran",
      result.code === "SUBJECT_CODE_EXISTS"
        ? 409
        : result.code === "VALIDATION_ERROR"
          ? 400
          : 500,
      result.code,
    );
  }

  return apiCreated({ created: true });
}
