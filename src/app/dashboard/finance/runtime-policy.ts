import { cookies, headers } from "next/headers";
import type { AuthRole } from "@/core/auth/roles";
import {
  DESKTOP_LOOPBACK_QUERY_TOKEN,
  DESKTOP_LOOPBACK_RUNTIME_COOKIE,
  isDesktopLoopbackRequest,
} from "@/lib/runtime/desktop-loopback-request";

export const FINANCE_VIEWER_ROLES: AuthRole[] = [
  "super_admin",
  "admin",
  "staff",
  "headmaster",
  "auditor",
];

export function isFinanceDesktopEmbeddedRuntime() {
  return process.env.EDUCORE_DESKTOP_RUNTIME === "embedded-local-web-server";
}

export async function isFinanceDesktopRequestRuntime() {
  if (isFinanceDesktopEmbeddedRuntime()) {
    return true;
  }

  const [requestHeaders, requestCookies] = await Promise.all([
    headers(),
    cookies(),
  ]);
  const hostHeader = requestHeaders.get("host");
  const userAgent = requestHeaders.get("user-agent");
  const queryToken = requestHeaders.get(DESKTOP_LOOPBACK_QUERY_TOKEN);
  const hasRuntimeCookie =
    requestCookies.get(DESKTOP_LOOPBACK_RUNTIME_COOKIE)?.value === "1";

  return (
    hasRuntimeCookie ||
    Boolean(queryToken) ||
    isDesktopLoopbackRequest({
      hostHeader,
      userAgent,
    })
  );
}

export function getFinanceDesktopGuardMessage() {
  return "Aksi Finance ini belum tersedia untuk sesi ini. Coba muat ulang aplikasi atau hubungi admin jika masalah berlanjut.";
}

export function assertFinanceWebServerOnlyRuntime() {
  if (isFinanceDesktopEmbeddedRuntime()) {
    throw new Error(getFinanceDesktopGuardMessage());
  }
}
