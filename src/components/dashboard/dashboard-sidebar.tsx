"use client";

import {
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LibraryBig,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
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

function formatRoleLabel(role: AuthRole | null) {
  if (!role) {
    return "Guest";
  }

  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function DashboardSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { logout, user, isLoading } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const currentRole = (user?.role as AuthRole | undefined) ?? null;
  const routeKey = `${pathname ?? ""}?${searchParams?.toString() ?? ""}`;
  const visibleMenuItems = menuItems.filter((item) =>
    currentRole
      ? DASHBOARD_ROLE_ALLOWED_PATHS[currentRole].includes(item.href)
      : false,
  );

  useEffect(() => {
    void routeKey;
    setIsMobileOpen(false);
  }, [routeKey]);

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

  function renderSidebarContent({
    collapsed,
    mobile,
  }: {
    collapsed: boolean;
    mobile: boolean;
  }) {
    return (
      <div className="flex h-full flex-col text-white">
        <div className="border-b border-zinc-800/50 bg-linear-to-b from-zinc-900 to-zinc-900/70 p-4 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className={cn("min-w-0", collapsed && !mobile && "w-full")}>
              <div
                className={cn(
                  "flex items-center gap-2 font-bold tracking-tight",
                  collapsed && !mobile ? "justify-center text-lg" : "text-xl",
                )}
              >
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-teal-400 text-xs text-white shadow-lg shadow-cyan-950/30 ring-1 ring-white/10",
                    collapsed && !mobile && "mx-auto h-10 w-10",
                  )}
                >
                  EC
                </div>
                {collapsed && !mobile ? null : <span>EduCore</span>}
              </div>
              {collapsed && !mobile ? null : (
                <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 px-3 py-2 shadow-sm shadow-black/10">
                  <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                    Role Aktif
                  </p>
                  <p className="mt-1 text-sm font-semibold text-zinc-100">
                    {isLoading ? "loading..." : formatRoleLabel(currentRole)}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {mobile ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-xl border border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                  onClick={() => setIsMobileOpen(false)}
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="hidden h-10 w-10 rounded-xl border border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:bg-zinc-800 hover:text-white md:inline-flex"
                  onClick={() => setIsCollapsed((value) => !value)}
                >
                  {collapsed ? (
                    <PanelLeftOpen className="h-4 w-4" />
                  ) : (
                    <PanelLeftClose className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-1 px-3 py-6">
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
                title={item.label}
                aria-label={item.label}
                className={cn(
                  "group relative flex items-center rounded-2xl text-sm font-medium transition-all",
                  collapsed && !mobile
                    ? "justify-center px-2 py-3.5"
                    : "gap-3 px-3 py-3",
                  isActive
                    ? "bg-linear-to-r from-zinc-800 to-zinc-800/80 text-white shadow-sm shadow-black/20 ring-1 ring-white/5"
                    : "text-zinc-400 hover:bg-zinc-800/80 hover:text-white",
                )}
              >
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all",
                    isActive
                      ? "border-zinc-700 bg-zinc-900/80 shadow-inner shadow-black/20"
                      : "border-transparent bg-transparent group-hover:border-zinc-800 group-hover:bg-zinc-900/70",
                  )}
                >
                  <item.icon className={cn("h-5 w-5 shrink-0", item.color)} />
                </span>
                {collapsed && !mobile ? null : (
                  <>
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
                  </>
                )}
              </Link>
            );
          })}
        </div>

        <div className="border-t border-zinc-800/50 p-4">
          {collapsed && !mobile ? null : (
            <div className="mb-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                Workspace
              </p>
              <p className="mt-1 text-sm font-medium text-zinc-200">
                {visibleMenuItems.length} menu aktif untuk{" "}
                {formatRoleLabel(currentRole)}
              </p>
            </div>
          )}
          <Button
            variant="ghost"
            disabled={signingOut}
            className={cn(
              "w-full rounded-2xl",
              collapsed && !mobile
                ? "justify-center border border-zinc-800 bg-zinc-950/60 px-0 text-zinc-400 hover:border-red-500/30 hover:bg-red-900/10 hover:text-red-400"
                : "justify-start gap-2 border border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-red-500/30 hover:bg-red-900/10 hover:text-red-400",
            )}
            onClick={() => {
              void handleSignOut();
            }}
          >
            <LogOut className="h-4 w-4" />
            {collapsed && !mobile ? null : (
              <span>{signingOut ? "Signing out..." : "Sign Out"}</span>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="fixed left-4 top-4 z-50 h-11 w-11 rounded-2xl border border-zinc-800 bg-zinc-900/95 text-zinc-100 shadow-lg shadow-black/30 backdrop-blur-sm hover:bg-zinc-800 md:hidden"
        onClick={() => setIsMobileOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {isMobileOpen ? (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px] md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[min(82vw,20rem)] border-r border-zinc-800 bg-zinc-900/98 shadow-2xl shadow-black/40 transition-transform duration-300 md:hidden",
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {renderSidebarContent({ collapsed: false, mobile: true })}
      </aside>

      <aside
        className={cn(
          "hidden h-full border-r border-zinc-800 bg-zinc-900 md:flex md:flex-col md:transition-all md:duration-300",
          isCollapsed ? "md:w-20" : "md:w-64",
        )}
      >
        {renderSidebarContent({ collapsed: isCollapsed, mobile: false })}
      </aside>
    </>
  );
}
