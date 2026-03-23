import { NextResponse } from "next/server";
import { AUTH_ROLES, type AuthRole } from "@/core/auth/roles";
import {
  DASHBOARD_ROLE_DEFAULT_PATH,
  isAllowedDashboardPath,
} from "@/lib/auth/dashboard-access";
import { auth } from "@/lib/auth/web/auth";

function toAuthRole(role: unknown): AuthRole | null {
  if (typeof role !== "string") {
    return null;
  }

  return AUTH_ROLES.includes(role as AuthRole) ? (role as AuthRole) : null;
}

export default auth((request) => {
  const { nextUrl, auth: session } = request;
  const pathname = nextUrl.pathname;
  const currentRole = toAuthRole(
    (session?.user as { role?: AuthRole } | undefined)?.role,
  );

  if (pathname === "/") {
    if (!currentRole) {
      return NextResponse.next();
    }

    return NextResponse.redirect(
      new URL(DASHBOARD_ROLE_DEFAULT_PATH[currentRole], nextUrl),
    );
  }

  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  if (!currentRole) {
    const loginUrl = new URL("/", nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!isAllowedDashboardPath(currentRole, pathname)) {
    return NextResponse.redirect(
      new URL(DASHBOARD_ROLE_DEFAULT_PATH[currentRole], nextUrl),
    );
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/", "/dashboard/:path*"],
};
