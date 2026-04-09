"use client";

import {
  ArrowRight,
  Banknote,
  ClipboardList,
  LayoutDashboard,
  LibraryBig,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { AuthRole } from "@/core/auth/roles";
import { useAuth } from "@/hooks/use-auth";
import { DASHBOARD_ROLE_ALLOWED_PATHS } from "@/lib/auth/dashboard-access";
import { ensureAppWarmup } from "@/lib/runtime/app-bootstrap";
import {
  getRuntimeSupportedDashboardPaths,
  isDesktopDashboardConstrainedRuntime,
} from "@/lib/runtime/desktop-dashboard";

const DashboardStatsCards = dynamic(
  () =>
    import("@/components/dashboard/dashboard-stats").then(
      (module) => module.DashboardStatsCards,
    ),
  {
    ssr: false,
  },
);

const AttendanceRiskInsights = dynamic(
  () =>
    import("@/components/dashboard/attendance-risk-insights").then(
      (module) => module.AttendanceRiskInsights,
    ),
  {
    ssr: false,
  },
);

type QuickLink = {
  href: string;
  label: string;
  description: string;
  icon: typeof LayoutDashboard;
};

const quickLinks: QuickLink[] = [
  {
    href: "/dashboard",
    label: "Overview",
    description: "Ringkasan dashboard utama sesuai role aktif.",
    icon: LayoutDashboard,
  },
  {
    href: "/dashboard/attendance",
    label: "Attendance",
    description: "Log absensi, history, analytics, dan follow-up.",
    icon: ClipboardList,
  },
  {
    href: "/dashboard/students",
    label: "Students",
    description: "Roster siswa, akun, dan shortcut attendance.",
    icon: Users,
  },
  {
    href: "/dashboard/courses",
    label: "Academic",
    description: "Kelas dan mata pelajaran yang bisa dibaca role aktif.",
    icon: LibraryBig,
  },
  {
    href: "/dashboard/finance",
    label: "Finance",
    description: "Billing, payment allocation, audit log, dan general ledger.",
    icon: Banknote,
  },
  {
    href: "/dashboard/teachers",
    label: "Teachers & Staff",
    description: "Manajemen akun guru, staf, dan admin sesuai akses aktif.",
    icon: UserCog,
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    description: "Status sync, akun aktif, dan konfigurasi runtime.",
    icon: Settings,
  },
];

const focusPoints = [
  "Dashboard utama sekarang hanya menampilkan widget yang benar-benar aktif.",
  "Role non-operasional tetap dapat workspace yang bersih tanpa noise analytics.",
  "Navigasi cepat diprioritaskan untuk alur yang paling sering dibuka.",
];

function toRoleLabel(role: AuthRole | null) {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "admin":
      return "Admin";
    case "teacher":
      return "Guru";
    case "staff":
      return "Staf";
    case "student":
      return "Siswa";
    case "parent":
      return "Orang Tua";
    default:
      return "Pengguna";
  }
}

export function DashboardHomeClient() {
  const { user } = useAuth();
  const [startupReady, setStartupReady] = useState(false);
  const currentRole = (user?.role as AuthRole | undefined) ?? null;
  const canOperateDashboard =
    currentRole === "admin" ||
    currentRole === "super_admin" ||
    currentRole === "teacher" ||
    currentRole === "staff";
  const allowedPaths = currentRole
    ? getRuntimeSupportedDashboardPaths(
        DASHBOARD_ROLE_ALLOWED_PATHS[currentRole],
      )
    : [];
  const desktopConstrainedRuntime = isDesktopDashboardConstrainedRuntime();
  const visibleQuickLinks = quickLinks.filter((item) =>
    allowedPaths.includes(item.href),
  );
  const primaryLinks = visibleQuickLinks.slice(0, 3);

  useEffect(() => {
    let active = true;

    void ensureAppWarmup().finally(() => {
      if (active) {
        setStartupReady(true);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-full space-y-10 p-1 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* 🚀 Hero Section */}
      <section className="relative overflow-hidden rounded-[2.5rem] border border-zinc-800/80 bg-zinc-950/40 p-6 shadow-2xl backdrop-blur-md md:p-10 lg:p-12">
        <div className="absolute inset-y-0 right-0 w-full lg:w-1/2">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.15),transparent_65%)]" />
          <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-sky-500/10 blur-[100px]" />
          <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-indigo-500/5 blur-[120px]" />
        </div>

        <div className="relative flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.25em] text-sky-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Dashboard Overview</span>
            </div>

            <div className="space-y-4">
              <h1 className="bg-linear-to-r from-white via-sky-200 to-zinc-500 bg-clip-text text-5xl font-black tracking-tighter text-transparent sm:text-6xl lg:text-7xl">
                Halo, {toRoleLabel(currentRole)}
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-zinc-400 md:text-lg">
                {canOperateDashboard
                  ? "Selamat datang kembali. Pantau seluruh metrik operasional, analisis kehadiran, dan manajemen roster dalam satu pusat kendali yang terintegrasi."
                  : "Workspace personal Anda telah siap. Akses seluruh fitur dan informasi sesuai dengan hak akses role aktif Anda dengan aman dan efisien."}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {primaryLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center gap-2.5 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-300 transition-all hover:border-sky-500/40 hover:bg-zinc-900 hover:text-sky-300"
                >
                  <item.icon className="h-4 w-4 transition-transform group-hover:scale-110" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1 lg:w-[240px]">
            {[
              {
                label: "Role Aktif",
                value: toRoleLabel(currentRole),
                icon: ShieldCheck,
              },
              { label: "App Runtime", value: "Web + Tauri", icon: Settings },
              { label: "Security", value: "Verified", icon: ShieldCheck },
            ].map((item) => (
              <div
                key={item.label}
                className="group relative overflow-hidden rounded-2xl border border-zinc-800/50 bg-zinc-900/30 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-900/50"
              >
                <div className="absolute inset-x-0 bottom-0 h-[2px] w-0 bg-sky-500 transition-all duration-300 group-hover:w-full" />
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">
                  {item.label}
                </p>
                <p className="mt-1 text-sm font-semibold text-zinc-200">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 🧭 Quick Navigation */}
      <section className="space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between px-2">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[1.25rem] border border-sky-500/20 bg-sky-500/10 shadow-[0_0_20px_rgba(14,165,233,0.1)]">
              <LayoutDashboard className="h-6 w-6 text-sky-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">
                Navigasi Cepat
              </h2>
              <p className="text-sm text-zinc-500">
                Akses instan ke workspace yang paling sering digunakan.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleQuickLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group relative flex flex-col justify-between overflow-hidden rounded-[2rem] border border-zinc-800/60 bg-zinc-950/40 p-6 transition-all hover:border-sky-500/30 hover:bg-zinc-900/40 hover:shadow-2xl"
            >
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-sky-500/5 blur-2xl transition-all group-hover:bg-sky-500/10" />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/80 text-sky-400 shadow-inner group-hover:border-sky-500/20 group-hover:bg-sky-500/5">
                    <item.icon className="h-6 w-6" />
                  </div>
                  <div className="rounded-full bg-zinc-900 p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <ArrowRight className="h-4 w-4 text-sky-400" />
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white group-hover:text-sky-300 transition-colors">
                    {item.label}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-500 group-hover:text-zinc-400">
                    {item.description}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 📊 Intelligence & Stats */}
      {canOperateDashboard && (
        <section className="space-y-8 pt-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between px-2">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-[1.25rem] border border-emerald-500/20 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                <ClipboardList className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white">
                  KPI & Real-time Analytics
                </h2>
                <p className="text-sm text-zinc-500">
                  Ringkasan status roster dan kehadiran hari ini.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[2.5rem] border border-zinc-800/80 bg-zinc-950/40 p-2 shadow-2xl backdrop-blur-xl transition-all">
            <div className="p-4 md:p-6">
              {startupReady ? (
                <DashboardStatsCards />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {[1, 2, 3, 4].map((key) => (
                    <div
                      key={key}
                      className="h-44 animate-pulse rounded-[1.75rem] border border-zinc-800 bg-zinc-900/40"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {startupReady ? (
            <div className="motion-safe:animate-in motion-safe:fade-in duration-1000">
              <AttendanceRiskInsights />
            </div>
          ) : (
            <div className="h-64 animate-pulse rounded-[2.5rem] border border-zinc-800 bg-zinc-900/40" />
          )}
        </section>
      )}

      {/* ℹ️ Additional Info / Constraints */}
      {!canOperateDashboard && !desktopConstrainedRuntime && (
        <section className="rounded-[2.5rem] border border-zinc-800/80 bg-linear-to-br from-zinc-950/60 to-zinc-900/40 p-8 shadow-xl">
          <div className="max-w-2xl space-y-4">
            <h3 className="text-xl font-bold text-white">
              Informasi Workspace
            </h3>
            <p className="text-base text-zinc-400">
              Dashboard Anda telah disesuaikan untuk peran{" "}
              <span className="font-semibold text-sky-400">
                {toRoleLabel(currentRole)}
              </span>
              . Kami menyederhanakan antarmuka dengan menyembunyikan data
              analitik yang tidak relevan agar Anda tetap fokus pada tugas
              utama.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              {focusPoints.map((point) => (
                <div
                  key={point}
                  className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-4 py-2 text-xs text-zinc-500"
                >
                  <div className="h-1 w-1 rounded-full bg-sky-500" />
                  {point}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
