"use client";

import {
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LibraryBig,
  LogOut,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AuthRole } from "@/core/auth/roles";
import { useAuth } from "@/hooks/use-auth";
import { DASHBOARD_ROLE_ALLOWED_PATHS } from "@/lib/auth/dashboard-access";
import { cn } from "@/lib/utils";

type DashboardMenuItem = {
  label: string;
  icon: typeof LayoutDashboard;
  href: string;
  color: string;
  phaseTag: "P1" | "P2";
};

const menuItems: DashboardMenuItem[] = [
  {
    label: "Overview",
    icon: LayoutDashboard,
    href: "/dashboard",
    color: "text-sky-500",
    phaseTag: "P1",
  },
  {
    label: "Students",
    icon: Users,
    href: "/dashboard/students",
    color: "text-violet-500",
    phaseTag: "P1",
  },
  {
    label: "Attendance",
    icon: ClipboardList,
    href: "/dashboard/attendance",
    color: "text-emerald-500",
    phaseTag: "P1",
  },
  {
    label: "User Management",
    icon: GraduationCap,
    href: "/dashboard/teachers",
    color: "text-pink-500",
    phaseTag: "P1",
  },
  {
    label: "Classes",
    icon: LibraryBig,
    href: "/dashboard/courses",
    color: "text-orange-500",
    phaseTag: "P1",
  },
  {
    label: "Settings",
    icon: Settings,
    href: "/dashboard/settings",
    color: "text-gray-500",
    phaseTag: "P1",
  },
];

export function DashboardSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { logout, user, isLoading } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const currentRole = (user?.role as AuthRole | undefined) ?? null;
  const visibleMenuItems = menuItems.filter((item) =>
    currentRole
      ? DASHBOARD_ROLE_ALLOWED_PATHS[currentRole].includes(item.href)
      : false,
  );

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await logout();
      router.replace("/");
    } catch {
      toast.error("Gagal logout. Coba lagi.");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="h-full bg-zinc-900 border-r border-zinc-800 flex flex-col text-white w-64">
      {/* Header Sidebar */}
      <div className="border-b border-zinc-800/50 p-6">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center text-white text-xs">
            EC
          </div>
          Educore
        </div>
        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">
            Role Aktif
          </p>
          <p className="mt-1 text-sm font-semibold text-zinc-100">
            {isLoading
              ? "loading..."
              : currentRole
                ? currentRole.replace("_", " ")
                : "guest"}
          </p>
        </div>
      </div>

      {/* Menu Items */}
      <div className="flex-1 py-6 flex flex-col gap-1 px-3">
        {visibleMenuItems.map((item) => {
          const currentTab = searchParams.get("tab");
          const itemUrl = new URL(item.href, "http://localhost");
          const itemTab = itemUrl.searchParams.get("tab");
          const isActive =
            pathname === itemUrl.pathname &&
            (itemTab ? currentTab === itemTab : currentTab === null);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all hover:bg-zinc-800",
                isActive
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-white",
              )}
            >
              <item.icon className={cn("h-5 w-5", item.color)} />
              <span className="flex-1">{item.label}</span>
              <span
                className={cn(
                  "rounded-md border px-1.5 py-0.5 text-[10px] font-bold tracking-wide",
                  item.phaseTag === "P1"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-300",
                )}
              >
                {item.phaseTag}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Footer Sidebar */}
      <div className="p-4 border-t border-zinc-800/50">
        <Button
          variant="ghost"
          disabled={signingOut}
          className="w-full justify-start text-zinc-400 hover:text-red-400 hover:bg-red-900/10 gap-2"
          onClick={() => {
            void handleSignOut();
          }}
        >
          <LogOut className="h-4 w-4" />
          {signingOut ? "Signing out..." : "Sign Out"}
        </Button>
      </div>
    </div>
  );
}
