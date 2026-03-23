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
    return null;
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
