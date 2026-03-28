import { requirePermission } from "@/lib/api/authz";
import { apiCreated, apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";
import { addSemester, getSemesters } from "@/lib/services/academic";

export async function GET() {
  const session = await auth();
  const guard = requirePermission(session, "academic:read");
  if (guard) {
    return guard;
  }

  return apiOk(await getSemesters());
}

export async function POST(request: Request) {
  const session = await auth();
  const guard = requirePermission(session, "academic:write");
  if (guard) {
    return guard;
  }

  const result = await addSemester(await request.json());
  if (!result.success) {
    return apiError(
      result.error,
      result.code === "SEMESTER_EXISTS"
        ? 409
        : result.code === "VALIDATION_ERROR" ||
            result.code === "ACADEMIC_YEAR_NOT_FOUND"
          ? 400
          : 500,
      result.code,
    );
  }

  return apiCreated({ id: result.id });
}
