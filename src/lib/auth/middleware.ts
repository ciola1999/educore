import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { AUTH_ROLES, type AuthRole } from "@/core/auth/roles";
import { auth } from "@/lib/auth/web/auth";

/**
 * Role-based route protection middleware
 *
 * Usage:
 * - Add to middleware.ts in root or any route segment
 * - Use with protected() wrapper to check permissions
 */

type Role = AuthRole;

/**
 * Check if session carries a valid role.
 */
function getSessionRole(session: unknown): Role | null {
  if (!session || typeof session !== "object") return null;

  const sessionObj = session as Record<string, unknown>;
  const candidates = [
    sessionObj.role,
    typeof sessionObj.user === "object" && sessionObj.user
      ? (sessionObj.user as Record<string, unknown>).role
      : undefined,
  ];

  for (const candidate of candidates) {
    if (
      typeof candidate === "string" &&
      AUTH_ROLES.includes(candidate as Role)
    ) {
      return candidate as Role;
    }
  }

  return null;
}

async function checkRole(
  session: unknown,
  requiredRole: Role,
): Promise<boolean> {
  const role = getSessionRole(session);
  if (!role) return false;

  // Elevated roles have access to everything
  if (role === "admin" || role === "super_admin") return true;

  return role === requiredRole;
}

/**
 * Protected route handler
 * @param request - NextRequest
 * @param requiredRole - Role required to access the route
 * @param options - Additional options
 */
export async function protectedRoute(
  request: NextRequest,
  requiredRole: Role,
  options?: {
    redirectToLogin?: boolean;
  },
): Promise<NextResponse | null> {
  const session = await auth();

  if (!session?.user) {
    if (options?.redirectToLogin !== false) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hasAccess = await checkRole(session, requiredRole);

  if (!hasAccess) {
    return NextResponse.json(
      { error: "Forbidden - Anda tidak memiliki akses ke halaman ini" },
      { status: 403 },
    );
  }

  return null;
}

/**
 * Wrapper for role-based protection in middleware
 */
export function withRole(role: Role) {
  return async (request: NextRequest): Promise<NextResponse | null> =>
    protectedRoute(request, role);
}

/**
 * Multiple roles protection
 */
export function withAnyRole(roles: Role[]) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    const session = await auth();

    if (!session?.user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }

    const userRole = getSessionRole(session);

    // Elevated roles have access to everything
    if (userRole === "admin" || userRole === "super_admin") return null;

    // Check if user has any of the required roles
    const hasAccess = roles.includes(userRole as Role);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Forbidden - Anda tidak memiliki akses ke halaman ini" },
        { status: 403 },
      );
    }

    return null;
  };
}
