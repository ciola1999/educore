import { requireRole } from "@/lib/api/authz";
import { apiCreated, apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";
import { addTeacher, getTeachers } from "@/lib/services/teacher";

export async function GET(request: Request) {
  const session = await auth();
  const guard = requireRole(session, ["admin", "super_admin"]);
  if (guard) {
    return guard;
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || undefined;
  const roleFilter = searchParams.get("role") || undefined;
  const sortBy = searchParams.get("sortBy") || undefined;
  const sortOrder = searchParams.get("sortOrder") || undefined;

  const teachers = await getTeachers({
    search,
    role: roleFilter as
      | "admin"
      | "super_admin"
      | "teacher"
      | "staff"
      | undefined,
    sortBy: sortBy as "fullName" | "email" | "createdAt" | undefined,
    sortOrder: sortOrder as "asc" | "desc" | undefined,
  });

  return apiOk(teachers);
}

export async function POST(request: Request) {
  const session = await auth();
  const guard = requireRole(session, ["admin", "super_admin"]);
  if (guard) {
    return guard;
  }

  const body = await request.json();
  const result = await addTeacher(body);

  if (!result.success) {
    return apiError(
      result.error,
      result.code === "EMAIL_EXISTS" || result.code === "VALIDATION_ERROR"
        ? 400
        : 500,
      result.code,
    );
  }

  return apiCreated({ id: result.id });
}
