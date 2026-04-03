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
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AuthRole } from "@/core/auth/roles";
import { isTauri } from "@/core/env";
import { useAuth } from "@/hooks/use-auth";
import { DASHBOARD_ROLE_ALLOWED_PATHS } from "@/lib/auth/dashboard-access";
import { getRuntimeSupportedDashboardPaths } from "@/lib/runtime/desktop-dashboard";
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
    label: "Teachers & Staff",
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
      ? getRuntimeSupportedDashboardPaths(
          DASHBOARD_ROLE_ALLOWED_PATHS[currentRole],
        ).includes(item.href)
      : false,
  );

  useEffect(() => {
    setIsMobileOpen(false);
  }, [routeKey]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await logout();
      if (isTauri()) {
        router.replace("/");
      }
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
      <div className="flex h-full flex-col text-zinc-100">
        {/* ✨ Logo Section */}
        <div className="relative border-zinc-800/50 p-6">
          {/* 🔘 Toggle Button (Expanded State) */}
          {!collapsed && !mobile && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-4 top-4 h-8 w-8 rounded-lg border border-zinc-800 bg-zinc-900/50 text-zinc-500 hover:text-white transition-all duration-300"
              onClick={() => setIsCollapsed(true)}
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          )}

          <div className="flex items-center gap-4">
            <div className={cn("flex flex-1 items-center gap-3", collapsed && !mobile && "justify-center")}>
              <div className="relative group/logo">
                <div className="absolute -inset-2 bg-indigo-500/20 rounded-2xl blur-lg opacity-0 group-hover/logo:opacity-100 transition-opacity duration-500" />
                <div className="relative flex h-10 w-10 items-center justify-center rounded-[0.85rem] bg-indigo-600 font-black text-white shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
                  <span className="text-sm">EC</span>
                </div>
              </div>
              
              {(!collapsed || mobile) && (
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg font-black tracking-tighter text-white uppercase">
                    EDUCORE
                  </h1>
                  <p className="truncate text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">
                    Academic Hub
                  </p>
                </div>
              )}
            </div>
          </div>

          {(!collapsed || mobile) && (
            <div className="mt-8 relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3 ring-1 ring-white/5">
              <div className="absolute top-0 right-0 -mr-2 -mt-2 h-12 w-12 rounded-full bg-indigo-500/5 blur-xl" />
              <div className="relative flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-950/50 border border-zinc-800 text-zinc-400">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Active Identity</p>
                  <p className="truncate text-xs font-bold text-zinc-200">
                    {isLoading ? "Synchronizing..." : formatRoleLabel(currentRole)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 🔘 Sidebar Control Area (Collapsed/Mobile) */}
          <div className={cn("mt-4 flex", collapsed && !mobile ? "justify-center" : "hidden")}>
            {mobile ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl border border-zinc-800 bg-zinc-950/50 text-zinc-400 hover:text-white"
                onClick={() => setIsMobileOpen(false)}
              >
                <PanelLeftClose className="h-4.5 w-4.5" />
              </Button>
            ) : collapsed && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-xl border border-zinc-800 bg-zinc-950/50 text-zinc-400 hover:text-white hover:border-indigo-500/30"
                onClick={() => setIsCollapsed(false)}
              >
                <PanelLeftOpen className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>

        {/* 🧭 Navigation Menu */}
        <div className="flex-1 space-y-1.5 px-4 py-8 overflow-y-auto scrollbar-hide">
          {(!collapsed || mobile) && (
            <p className="px-3 mb-4 text-[10px] font-black uppercase tracking-[0.25em] text-zinc-700">
              Main Management
            </p>
          )}

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
                  "group relative flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition-all duration-300",
                  collapsed && !mobile ? "justify-center" : "justify-start",
                  isActive
                    ? "bg-indigo-600/10 text-indigo-300 ring-1 ring-indigo-500/20 shadow-[0_0_20px_rgba(79,70,229,0.1)]"
                    : "text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-200"
                )}
              >
                {isActive && (
                  <div className="absolute inset-y-2 left-0 w-1 rounded-full bg-indigo-500" />
                )}
                
                <item.icon className={cn(
                  "h-5 w-5 transition-transform duration-300 group-hover:scale-110",
                  isActive ? "text-indigo-400" : "text-zinc-600 group-hover:text-zinc-400"
                )} />
                
                {(!collapsed || mobile) && (
                  <span className="flex-1 tracking-tight">{item.label}</span>
                )}
                
                {(!collapsed || mobile) && isActive && (
                  <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(79,70,229,0.8)]" />
                )}
              </Link>
            );
          })}
        </div>

        {/* 🚪 Sidebar Footer */}
        <div className="mt-auto p-4 space-y-3">
          {(!collapsed || mobile) && (
            <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800 p-3 ring-1 ring-white/5">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Runtime Guard</span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed font-medium">
                {visibleMenuItems.length} modules active for this instance.
              </p>
            </div>
          )}

          <Button
            variant="ghost"
            disabled={signingOut}
            onClick={() => {
              void handleSignOut();
            }}
            className={cn(
              "w-full h-12 rounded-2xl transition-all duration-300",
              collapsed && !mobile
                ? "justify-center border border-zinc-800 bg-zinc-950/40"
                : "justify-start gap-4 border border-zinc-800 bg-zinc-950/40 px-4",
              "text-zinc-500 hover:text-rose-400 hover:border-rose-500/20 hover:bg-rose-500/5 group"
            )}
          >
            <LogOut className={cn(
              "h-4 w-4 transition-transform group-hover:-translate-x-1",
              signingOut && "animate-pulse"
            )} />
            {(!collapsed || mobile) && (
              <span className="font-bold text-xs uppercase tracking-widest">
                {signingOut ? "Signing out..." : "Log Out"}
              </span>
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
        className="fixed left-4 top-4 z-50 h-11 w-11 rounded-2xl border border-zinc-800 bg-zinc-900/40 shadow-2xl backdrop-blur-md text-white transition-all hover:bg-zinc-800 md:hidden"
        onClick={() => setIsMobileOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-300 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile Aside */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[280px] border-r border-zinc-800 bg-zinc-950/80 backdrop-blur-xl shadow-2xl transition-transform duration-300 md:hidden",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {renderSidebarContent({ collapsed: false, mobile: true })}
      </aside>

      {/* Desktop Aside */}
      <aside
        className={cn(
          "hidden h-full border-r border-zinc-800 bg-zinc-950/40 backdrop-blur-md md:flex md:flex-col transition-all duration-500 ease-in-out",
          isCollapsed ? "md:w-24" : "md:w-72"
        )}
      >
        {renderSidebarContent({ collapsed: isCollapsed, mobile: false })}
      </aside>
    </>
  );
}
