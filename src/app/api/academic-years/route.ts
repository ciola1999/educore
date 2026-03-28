import { requirePermission } from "@/lib/api/authz";
import { apiCreated, apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";
import { addAcademicYear, getAcademicYears } from "@/lib/services/academic";

export async function GET() {
  const session = await auth();
  const guard = requirePermission(session, "academic:read");
  if (guard) {
    return guard;
  }

  return apiOk(await getAcademicYears());
}

export async function POST(request: Request) {
  const session = await auth();
  const guard = requirePermission(session, "academic:write");
  if (guard) {
    return guard;
  }

  const result = await addAcademicYear(await request.json());
  if (!result.success) {
    return apiError(
      result.error,
      result.code === "ACADEMIC_YEAR_EXISTS"
        ? 409
        : result.code === "VALIDATION_ERROR"
          ? 400
          : 500,
      result.code,
    );
  }

  return apiCreated({ id: result.id });
}
