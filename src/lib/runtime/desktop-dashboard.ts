import type { AuthRole } from "@/core/auth/roles";
import { isTauri } from "@/core/env";
import { DASHBOARD_ROLE_ALLOWED_PATHS } from "@/lib/auth/dashboard-access";

const DESKTOP_CONSTRAINED_DASHBOARD_ROUTES = [
  {
    href: "/dashboard",
    label: "Overview",
  },
  {
    href: "/dashboard/attendance",
    label: "Attendance",
  },
  {
    href: "/dashboard/teachers",
    label: "User Management",
  },
  {
    href: "/dashboard/courses",
    label: "Academic",
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
  },
] as const;

type DesktopConstrainedDashboardPath =
  (typeof DESKTOP_CONSTRAINED_DASHBOARD_ROUTES)[number]["href"];

const DESKTOP_CONSTRAINED_DASHBOARD_PATHS =
  DESKTOP_CONSTRAINED_DASHBOARD_ROUTES.map((route) => route.href);

const DESKTOP_CONSTRAINED_DASHBOARD_LABELS = Object.fromEntries(
  DESKTOP_CONSTRAINED_DASHBOARD_ROUTES.map((route) => [
    route.href,
    route.label,
  ]),
) as Record<DesktopConstrainedDashboardPath, string>;

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

  return DESKTOP_CONSTRAINED_DASHBOARD_PATHS.includes(
    pathname as DesktopConstrainedDashboardPath,
  );
}

export function getRuntimeSupportedDashboardPaths(paths: string[]) {
  if (!isDesktopDashboardConstrainedRuntime()) {
    return paths;
  }

  return paths.filter((path) => isRuntimeSupportedDashboardPath(path));
}

export function getRuntimeSupportedDashboardLabels(paths?: string[]) {
  const supportedPaths = paths
    ? getRuntimeSupportedDashboardPaths(paths)
    : DESKTOP_CONSTRAINED_DASHBOARD_PATHS;

  return supportedPaths
    .map(
      (path) =>
        DESKTOP_CONSTRAINED_DASHBOARD_LABELS[
          path as DesktopConstrainedDashboardPath
        ],
    )
    .filter((label): label is string => Boolean(label));
}

export function getRuntimeDefaultDashboardPath(
  role: AuthRole,
  fallback: string,
) {
  const orderedPaths = [
    fallback,
    ...DASHBOARD_ROLE_ALLOWED_PATHS[role],
    ...DESKTOP_CONSTRAINED_DASHBOARD_PATHS,
  ].filter((path, index, values) => values.indexOf(path) === index);
  const rolePaths = getRuntimeSupportedDashboardPaths(orderedPaths);

  return rolePaths[0] ?? "/dashboard/settings";
}
