import type { AuthRole } from "@/core/auth/roles";
import { isTauri } from "@/core/env";

const DESKTOP_STATIC_SUPPORTED_PATHS = [
  "/dashboard/teachers",
  "/dashboard/courses",
  "/dashboard/settings",
] as const;

export function isDesktopDashboardConstrainedRuntime() {
  return isTauri();
}

export function isDesktopStaticRuntime() {
  if (!isTauri() || typeof window === "undefined") {
    return false;
  }

  const protocol = window.location.protocol;
  return protocol !== "http:" && protocol !== "https:";
}

export function isRuntimeSupportedDashboardPath(pathname: string) {
  if (!isDesktopDashboardConstrainedRuntime()) {
    return true;
  }

  return DESKTOP_STATIC_SUPPORTED_PATHS.includes(
    pathname as (typeof DESKTOP_STATIC_SUPPORTED_PATHS)[number],
  );
}

export function getRuntimeSupportedDashboardPaths(paths: string[]) {
  if (!isDesktopDashboardConstrainedRuntime()) {
    return paths;
  }

  return paths.filter((path) => isRuntimeSupportedDashboardPath(path));
}

export function getRuntimeDefaultDashboardPath(
  role: AuthRole,
  fallback: string,
) {
  const rolePaths = getRuntimeSupportedDashboardPaths(
    role === "student"
      ? []
      : [
          fallback,
          "/dashboard/courses",
          "/dashboard/teachers",
          "/dashboard/settings",
        ],
  );

  return rolePaths[0] ?? "/dashboard/settings";
}
