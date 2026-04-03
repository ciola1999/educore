import { requirePermission } from "@/lib/api/authz";
import { apiCreated, apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  const guard = requirePermission(session, "academic:read");
  if (guard) {
    return guard;
  }

  const url = new URL(request.url);
  if (url.searchParams.get("view") === "schedule-options") {
    const { getTeachingAssignmentScheduleOptions } = await import(
      "@/lib/services/academic"
    );
    return apiOk(await getTeachingAssignmentScheduleOptions());
  }

  const { getTeachingAssignments } = await import("@/lib/services/academic");
  return apiOk(await getTeachingAssignments());
}

export async function POST(request: Request) {
  const session = await auth();
  const guard = requirePermission(session, "academic:write");
  if (guard) {
    return guard;
  }

  const { addTeachingAssignment } = await import("@/lib/services/academic");
  const result = await addTeachingAssignment(await request.json());
  if (!result.success) {
    return apiError(
      result.error,
      result.code === "TEACHING_ASSIGNMENT_EXISTS"
        ? 409
        : result.code === "VALIDATION_ERROR" ||
            result.code === "INVALID_TEACHER" ||
            result.code === "SUBJECT_NOT_FOUND" ||
            result.code === "CLASS_NOT_FOUND" ||
            result.code === "SEMESTER_NOT_FOUND"
          ? 400
          : 500,
      result.code,
    );
  }

  return apiCreated({ id: result.id });
}
