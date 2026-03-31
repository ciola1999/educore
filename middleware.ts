import { NextResponse } from "next/server";
import { AUTH_ROLES, type AuthRole } from "@/core/auth/roles";
import {
  DASHBOARD_ROLE_DEFAULT_PATH,
  isAllowedDashboardPath,
} from "@/lib/auth/dashboard-access";
import { auth } from "@/lib/auth/web/auth";
import {
  DESKTOP_LOOPBACK_ENV_TOKEN,
  DESKTOP_LOOPBACK_QUERY_TOKEN,
  DESKTOP_LOOPBACK_SESSION_COOKIE,
  hasDesktopLoopbackSessionToken,
  isLoopbackHostname,
} from "@/lib/runtime/desktop-loopback-request";

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
  const loopbackHost = isLoopbackHostname(request.headers.get("host"));
  const expectedDesktopToken =
    process.env[DESKTOP_LOOPBACK_ENV_TOKEN]?.trim() ?? "";
  const desktopLoopbackToken = loopbackHost
    ? nextUrl.searchParams.get(DESKTOP_LOOPBACK_QUERY_TOKEN)
    : null;
  const hasDesktopLoopbackSession = loopbackHost
    ? hasDesktopLoopbackSessionToken({
        cookieValue: request.cookies.get(DESKTOP_LOOPBACK_SESSION_COOKIE)
          ?.value,
        queryValue: desktopLoopbackToken,
        expectedToken: expectedDesktopToken,
      })
    : false;

  if (loopbackHost && desktopLoopbackToken && hasDesktopLoopbackSession) {
    const sanitizedUrl = nextUrl.clone();
    sanitizedUrl.searchParams.delete(DESKTOP_LOOPBACK_QUERY_TOKEN);
    const response = NextResponse.redirect(sanitizedUrl);
    response.cookies.set(
      DESKTOP_LOOPBACK_SESSION_COOKIE,
      expectedDesktopToken,
      {
        httpOnly: true,
        sameSite: "strict",
        secure: false,
        path: "/",
      },
    );
    return response;
  }

  if (loopbackHost && hasDesktopLoopbackSession) {
    return NextResponse.next();
  }

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
    const loginUrl = new URL("/login", nextUrl);
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
