import type { AuthRole } from "@/core/auth/roles";

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

export function getFinanceDesktopGuardMessage() {
  return "Finance phase 2.4 belum desktop-safe. Gunakan runtime web sampai jalur lokal finance selesai diaudit.";
}
