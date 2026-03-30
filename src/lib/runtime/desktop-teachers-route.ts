import {
  addTeacher,
  deleteTeacher,
  getTeacherOptions,
  getTeachers,
  updateTeacher,
} from "@/lib/services/teacher";
import {
  handleDesktopTeacherImportRequest,
  toDesktopRouteErrorResponse,
} from "./desktop-import-handlers";
import {
  apiError,
  apiOk,
  type DesktopApiResponse,
} from "./desktop-route-response";

type DesktopTeachersRouteDeps = {
  ensureRole: (roles: Array<"admin" | "super_admin">) => DesktopApiResponse;
  ensurePermission: (permission: "academic:write") => DesktopApiResponse;
};

export async function handleDesktopTeachersRoute(
  url: URL,
  method: string,
  pathSegments: string[],
  body: unknown,
  deps: DesktopTeachersRouteDeps,
): Promise<DesktopApiResponse> {
  if (
    pathSegments.length === 3 &&
    pathSegments[2] === "import" &&
    method === "POST"
  ) {
    const guard = deps.ensureRole(["admin", "super_admin"]);
    if (guard) return guard;
    try {
      return apiOk(await handleDesktopTeacherImportRequest(body));
    } catch (error) {
      const routeError = toDesktopRouteErrorResponse(error);
      return apiError(routeError.message, routeError.status, routeError.code);
    }
  }

  if (pathSegments.length === 2) {
    if (method === "GET") {
      if (url.searchParams.get("view") === "options") {
        const guard = deps.ensurePermission("academic:write");
        if (guard) return guard;
        return apiOk(await getTeacherOptions());
      }

      const guard = deps.ensureRole(["admin", "super_admin"]);
      if (guard) return guard;

      const teachers = await getTeachers({
        search: url.searchParams.get("search") || undefined,
        role:
          (url.searchParams.get("role") as
            | "admin"
            | "super_admin"
            | "teacher"
            | "staff"
            | undefined) || undefined,
        sortBy:
          (url.searchParams.get("sortBy") as
            | "fullName"
            | "email"
            | "createdAt"
            | undefined) || undefined,
        sortOrder:
          (url.searchParams.get("sortOrder") as "asc" | "desc" | undefined) ||
          undefined,
      });

      return apiOk(teachers);
    }

    if (method === "POST") {
      const guard = deps.ensureRole(["admin", "super_admin"]);
      if (guard) return guard;
      const result = await addTeacher(body as never);

      if (!result.success) {
        return apiError(
          result.error,
          result.code === "VALIDATION_ERROR"
            ? 400
            : result.code === "EMAIL_EXISTS"
              ? 409
              : 500,
          result.code,
        );
      }

      return apiOk({ id: result.id }, 201);
    }
  }

  if (pathSegments.length === 3) {
    const guard = deps.ensureRole(["admin", "super_admin"]);
    if (guard) return guard;
    const id = pathSegments[2];

    if (method === "PATCH") {
      const result = await updateTeacher(id, body as never);

      if (!result.success) {
        return apiError(
          result.error,
          result.code === "VALIDATION_ERROR"
            ? 400
            : result.code === "EMAIL_EXISTS"
              ? 409
              : result.code === "TEACHER_IN_USE"
                ? 409
                : result.code === "NOT_FOUND"
                  ? 404
                  : 500,
          result.code,
        );
      }

      return apiOk({ updated: true });
    }

    if (method === "DELETE") {
      const result = await deleteTeacher(id);
      if (!result.success) {
        return apiError(
          result.error,
          result.code === "NOT_FOUND"
            ? 404
            : result.code === "TEACHER_IN_USE"
              ? 409
              : 500,
          result.code,
        );
      }

      return apiOk({ deleted: true });
    }
  }

  return null;
}
