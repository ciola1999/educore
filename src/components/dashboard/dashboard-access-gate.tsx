"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { InlineState } from "@/components/common/inline-state";
import { AUTH_ROLES, type AuthRole } from "@/core/auth/roles";
import { useAuth } from "@/hooks/use-auth";
import {
  DASHBOARD_ROLE_DEFAULT_PATH,
  isAllowedDashboardPath,
} from "@/lib/auth/dashboard-access";

function toAuthRole(role: unknown): AuthRole | null {
  if (typeof role !== "string") return null;
  return AUTH_ROLES.includes(role as AuthRole) ? (role as AuthRole) : null;
}

export function DashboardAccessGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || isLoading) {
    return (
      <div className="pt-8">
        <div className="rounded-[1.75rem] border border-zinc-800 bg-zinc-900/80 p-5 shadow-[0_24px_60px_-48px_rgba(15,23,42,0.85)]">
          <div className="h-3 w-28 animate-pulse rounded-full bg-zinc-800" />
          <div className="mt-4 h-7 w-64 animate-pulse rounded bg-zinc-800/90" />
          <div className="mt-3 h-3 w-full animate-pulse rounded bg-zinc-800/70" />
          <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-zinc-800/70" />
          <div className="mt-5 h-10 w-48 animate-pulse rounded-2xl bg-zinc-800/80" />
        </div>
      </div>
    );
  }

  const currentRole = toAuthRole(user?.role);
  const defaultPath = currentRole
    ? DASHBOARD_ROLE_DEFAULT_PATH[currentRole]
    : "/";
  const hasAccess = currentRole
    ? isAllowedDashboardPath(currentRole, pathname)
    : false;

  if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <div className="pt-8">
      <InlineState
        title="Akses halaman dibatasi"
        description="Role akun ini tidak memiliki izin untuk membuka halaman tersebut."
        actionLabel={
          currentRole ? "Buka Halaman yang Diizinkan" : "Kembali ke Login"
        }
        onAction={() => {
          router.replace(defaultPath || "/");
        }}
        variant="warning"
      />
    </div>
  );
}
