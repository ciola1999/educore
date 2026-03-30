"use client";

import {
  ArrowRight,
  ClipboardList,
  LayoutDashboard,
  LibraryBig,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AttendanceRiskInsights } from "@/components/dashboard/attendance-risk-insights";
import { DashboardStatsCards } from "@/components/dashboard/dashboard-stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AuthRole } from "@/core/auth/roles";
import { useAuth } from "@/hooks/use-auth";
import {
  DASHBOARD_ROLE_ALLOWED_PATHS,
  DASHBOARD_ROLE_DEFAULT_PATH,
} from "@/lib/auth/dashboard-access";
import { checkPermission } from "@/lib/auth/rbac";
import { ensureAppWarmup } from "@/lib/runtime/app-bootstrap";
import {
  getRuntimeDefaultDashboardPath,
  getRuntimeSupportedDashboardLabels,
  getRuntimeSupportedDashboardPaths,
  isDesktopDashboardConstrainedRuntime,
  isDesktopStaticRuntime,
} from "@/lib/runtime/desktop-dashboard";

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
  const canReadAttendance = checkPermission(user, "attendance:read");
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
  const runtimeSupportedLabels = currentRole
    ? getRuntimeSupportedDashboardLabels(
        DASHBOARD_ROLE_ALLOWED_PATHS[currentRole],
      )
    : [];
  const desktopConstrainedRuntime = isDesktopDashboardConstrainedRuntime();
  const runtimeSafeModeTitle = isDesktopStaticRuntime()
    ? "Desktop Production Safe Mode"
    : "Desktop Runtime Safe Mode";
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
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[1.75rem] border border-zinc-800/80 bg-linear-to-br from-zinc-950 via-zinc-950 to-sky-950/35 p-5 shadow-[0_30px_80px_-55px_rgba(56,189,248,0.4)] motion-safe:transition-shadow motion-safe:duration-300 md:rounded-[2rem] md:p-8">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_62%)]" />
        <div className="absolute -left-16 bottom-0 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-4 md:space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              Dashboard Aktif
            </div>
            <div className="space-y-3">
              <h1 className="bg-linear-to-r from-white via-sky-100 to-zinc-400 bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl md:text-5xl">
                Dashboard {toRoleLabel(currentRole)}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-zinc-300 md:text-base">
                {canOperateDashboard
                  ? "Ringkasan operasional attendance dan akses cepat memakai data dashboard yang aktif, bukan placeholder."
                  : "Halaman ini menampilkan jalur dashboard yang aman untuk role aktif tanpa membuka analytics internal yang sensitif."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {primaryLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-700/80 bg-zinc-950/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-200 transition hover:border-sky-500/40 hover:text-white"
                >
                  <item.icon className="h-3.5 w-3.5 text-sky-300" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[420px]">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3.5 shadow-lg shadow-black/10 motion-safe:transition motion-safe:duration-300 motion-safe:hover:-translate-y-0.5 hover:border-zinc-700 hover:bg-zinc-950 md:p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Role
              </p>
              <p className="mt-2 text-sm font-medium text-zinc-100">
                {toRoleLabel(currentRole)}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3.5 shadow-lg shadow-black/10 motion-safe:transition motion-safe:duration-300 motion-safe:hover:-translate-y-0.5 hover:border-zinc-700 hover:bg-zinc-950 md:p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Runtime
              </p>
              <p className="mt-2 text-sm font-medium text-zinc-100">
                Web + Tauri
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3.5 shadow-lg shadow-black/10 motion-safe:transition motion-safe:duration-300 motion-safe:hover:-translate-y-0.5 hover:border-zinc-700 hover:bg-zinc-950 md:p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Redirect Default
              </p>
              <p className="mt-2 truncate text-sm font-medium text-zinc-100">
                {currentRole
                  ? getRuntimeDefaultDashboardPath(
                      currentRole,
                      DASHBOARD_ROLE_DEFAULT_PATH[currentRole],
                    )
                  : "/"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {desktopConstrainedRuntime ? (
        <Card className="border-zinc-800 bg-zinc-900 text-white shadow-[0_24px_60px_-48px_rgba(15,23,42,0.85)]">
          <CardHeader>
            <CardTitle className="text-zinc-100">
              {runtimeSafeModeTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-zinc-400">
            <p>
              Overview desktop hanya membuka alur yang sudah local-runtime-safe.
              Insight attendance lanjutan tetap ditahan sampai local path
              analytics/follow-up-nya siap. Students roster, CRUD inti, dan
              import Excel sekarang sudah memakai runtime desktop yang sama.
            </p>
            <p>
              Menu yang aktif di runtime ini:{" "}
              {runtimeSupportedLabels.join(", ")}.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card className="border-zinc-800 bg-zinc-900 text-white shadow-[0_24px_60px_-50px_rgba(56,189,248,0.45)]">
          <CardHeader>
            <CardTitle className="text-zinc-100">Navigasi Cepat</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {visibleQuickLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-2xl border border-zinc-800 bg-linear-to-br from-zinc-950/80 to-zinc-900/60 p-3.5 motion-safe:transition motion-safe:duration-300 motion-safe:hover:-translate-y-1 hover:border-zinc-700 hover:bg-zinc-950 hover:shadow-[0_24px_60px_-45px_rgba(56,189,248,0.45)] md:p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/80 text-sky-300 shadow-inner shadow-black/20">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <ArrowRight className="h-4 w-4 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-zinc-300" />
                </div>
                <p className="mt-3 text-sm font-semibold text-zinc-100 md:mt-4">
                  {item.label}
                </p>
                <p className="mt-1 text-sm leading-6 text-zinc-400">
                  {item.description}
                </p>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900 text-white shadow-[0_24px_60px_-50px_rgba(15,23,42,0.85)]">
          <CardHeader>
            <CardTitle className="text-zinc-100">Fokus Dashboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-zinc-400">
            {focusPoints.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3.5 motion-safe:transition motion-safe:duration-300 motion-safe:hover:-translate-y-0.5 hover:border-zinc-700 hover:bg-zinc-950 md:p-4"
              >
                {item}
              </div>
            ))}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3.5 motion-safe:transition motion-safe:duration-300 motion-safe:hover:-translate-y-0.5 hover:border-zinc-700 hover:bg-zinc-950 md:p-4">
                {canReadAttendance
                  ? "Role aktif punya akses baca attendance."
                  : "Role aktif tidak punya akses baca attendance."}
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3.5 motion-safe:transition motion-safe:duration-300 motion-safe:hover:-translate-y-0.5 hover:border-zinc-700 hover:bg-zinc-950 md:p-4">
                {canOperateDashboard
                  ? "Analytics internal attendance aktif untuk role operasional."
                  : "Analytics internal attendance disembunyikan untuk boundary data."}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {canOperateDashboard ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Snapshot Hari Ini
              </p>
              <h2 className="text-xl font-semibold text-zinc-100">
                KPI Dashboard
              </h2>
            </div>
            <p className="max-w-xl text-sm text-zinc-500">
              Kartu ringkas untuk membaca kondisi siswa, operator, attendance,
              dan risiko harian lebih cepat.
            </p>
          </div>
          {startupReady ? (
            <DashboardStatsCards />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-4">
              {["kpi-1", "kpi-2", "kpi-3", "kpi-4"].map((key) => (
                <div
                  key={key}
                  className="h-44 animate-pulse rounded-3xl border border-zinc-800 bg-zinc-900/70"
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {canOperateDashboard && !desktopConstrainedRuntime ? (
        startupReady ? (
          <AttendanceRiskInsights />
        ) : (
          <Card className="border-zinc-800 bg-zinc-900 text-white shadow-[0_24px_60px_-48px_rgba(15,23,42,0.85)]">
            <CardHeader>
              <CardTitle className="text-zinc-100">
                Menyiapkan Insight Attendance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-zinc-400">
              <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-800" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-zinc-800/80" />
              <div className="grid gap-3 md:grid-cols-3">
                {["risk-1", "risk-2", "risk-3"].map((key) => (
                  <div
                    key={key}
                    className="h-28 animate-pulse rounded-3xl border border-zinc-800 bg-zinc-950/70"
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )
      ) : !desktopConstrainedRuntime ? (
        <Card className="overflow-hidden border-zinc-800 bg-zinc-900 text-white shadow-[0_24px_60px_-48px_rgba(15,23,42,0.85)]">
          <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-zinc-800 via-sky-500/20 to-zinc-800" />
          <CardHeader>
            <CardTitle className="text-zinc-100">
              Workspace Role Aktif
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-zinc-400">
            <p>
              Role ini diarahkan ke modul yang diizinkan melalui sidebar dan
              access gate. Insight attendance internal tidak ditampilkan pada
              dashboard utama untuk menjaga boundary data.
            </p>
            <div className="flex flex-wrap gap-2">
              {visibleQuickLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full border border-zinc-700 bg-zinc-950/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-300 transition hover:border-zinc-600 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                Gunakan shortcut di atas untuk masuk ke workspace yang memang
                diizinkan role aktif.
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                Dashboard utama tetap ringkas agar boundary data lebih aman dan
                tidak membingungkan pengguna non-operasional.
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
