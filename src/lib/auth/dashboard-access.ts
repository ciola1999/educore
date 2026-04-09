import type { AuthRole } from "@/core/auth/roles";

export const DASHBOARD_ROLE_ALLOWED_PATHS: Record<AuthRole, string[]> = {
  admin: [
    "/dashboard",
    "/dashboard/students",
    "/dashboard/attendance",
    "/dashboard/finance",
    "/dashboard/teachers",
    "/dashboard/courses",
    "/dashboard/settings",
  ],
  super_admin: [
    "/dashboard",
    "/dashboard/students",
    "/dashboard/attendance",
    "/dashboard/finance",
    "/dashboard/teachers",
    "/dashboard/courses",
    "/dashboard/settings",
  ],
  teacher: [
    "/dashboard",
    "/dashboard/attendance",
    "/dashboard/courses",
    "/dashboard/settings",
  ],
  staff: [
    "/dashboard",
    "/dashboard/attendance",
    "/dashboard/finance",
    "/dashboard/courses",
    "/dashboard/settings",
  ],
  parent: [
    "/dashboard",
    "/dashboard/attendance",
    "/dashboard/courses",
    "/dashboard/settings",
  ],
  headmaster: [
    "/dashboard",
    "/dashboard/students",
    "/dashboard/attendance",
    "/dashboard/finance",
    "/dashboard/teachers",
    "/dashboard/courses",
    "/dashboard/settings",
  ],
  auditor: [
    "/dashboard",
    "/dashboard/attendance",
    "/dashboard/finance",
    "/dashboard/courses",
    "/dashboard/settings",
  ],
  student: ["/dashboard/students", "/dashboard/attendance"],
};

export const DASHBOARD_ROLE_DEFAULT_PATH: Record<AuthRole, string> = {
  admin: "/dashboard",
  super_admin: "/dashboard",
  teacher: "/dashboard",
  staff: "/dashboard",
  parent: "/dashboard",
  headmaster: "/dashboard",
  auditor: "/dashboard",
  student: "/dashboard/students",
};

export function isAllowedDashboardPath(
  role: AuthRole,
  pathname: string,
): boolean {
  const allowedPaths = DASHBOARD_ROLE_ALLOWED_PATHS[role];
  return allowedPaths.some((allowedPath) => {
    if (pathname === allowedPath) {
      return true;
    }

    if (allowedPath === "/dashboard") {
      return false;
    }

    return pathname.startsWith(`${allowedPath}/`);
  });
}
