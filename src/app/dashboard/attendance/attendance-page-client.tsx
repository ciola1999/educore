"use client";

import {
  CalendarCheck,
  ChevronDown,
  ClipboardList,
  QrCode,
  Settings2,
  ShieldCheck,
  ShieldMinus,
  Sparkles,
  SunMoon,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { isTauri } from "@/core/env";
import { useAppNavigation } from "@/hooks/use-app-navigation";
import { useAuth } from "@/hooks/use-auth";
import { checkPermission } from "@/lib/auth/rbac";
import { ensureAppWarmup } from "@/lib/runtime/app-bootstrap";
import { ensureAttendanceProjectionSync } from "@/lib/runtime/attendance-projection-sync";
import { cn } from "@/lib/utils";
import type { AttendanceSetting, Holiday } from "@/types/attendance";

type AttendanceSection = "qr" | "manual" | "log" | "schedule" | "holiday";

type AttendanceMenuItem = {
  id: AttendanceSection;
  label: string;
  description: string;
  icon: typeof QrCode;
};

type AttendanceSectionTheme = {
  eyebrow: string;
  accentClass: string;
  badgeClass: string;
};

type AttendanceBootstrapState = "idle" | "syncing" | "ready" | "failed";

const writeMenuItems: AttendanceMenuItem[] = [
  {
    id: "qr",
    label: "QR Attendance",
    description: "Scanner QR dan panel hasil scan.",
    icon: QrCode,
  },
  {
    id: "manual",
    label: "Input Manual",
    description: "Input kehadiran per kelas dan tanggal.",
    icon: ClipboardList,
  },
  {
    id: "log",
    label: "Log Absensi",
    description: "Hari ini, riwayat, export, analytics, dan insight.",
    icon: CalendarCheck,
  },
  {
    id: "schedule",
    label: "Pengaturan Jadwal",
    description: "Pengaturan jadwal check-in dan check-out.",
    icon: Settings2,
  },
  {
    id: "holiday",
    label: "Kelola Hari Libur",
    description: "Hari libur dan pengecualian kalender absensi.",
    icon: SunMoon,
  },
];

const readOnlyMenuItems: AttendanceMenuItem[] = [
  {
    id: "log",
    label: "Log Absensi",
    description: "Hari ini, riwayat, export, analytics, dan insight.",
    icon: CalendarCheck,
  },
];

const sectionThemes: Record<AttendanceSection, AttendanceSectionTheme> = {
  qr: {
    eyebrow: "Scanner Langsung",
    accentClass: "text-emerald-300",
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-100",
  },
  manual: {
    eyebrow: "Input Operator",
    accentClass: "text-sky-300",
    badgeClass: "border-sky-500/20 bg-sky-500/10 text-sky-100",
  },
  log: {
    eyebrow: "Lapisan Insight",
    accentClass: "text-amber-300",
    badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-100",
  },
  schedule: {
    eyebrow: "Jendela Waktu",
    accentClass: "text-cyan-300",
    badgeClass: "border-cyan-500/20 bg-cyan-500/10 text-cyan-100",
  },
  holiday: {
    eyebrow: "Kalender Akademik",
    accentClass: "text-emerald-300",
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-100",
  },
};

const sectionIcons: Record<AttendanceSection, AttendanceMenuItem["icon"]> = {
  qr: QrCode,
  manual: ClipboardList,
  log: CalendarCheck,
  schedule: Settings2,
  holiday: SunMoon,
};

function AttendanceSectionLoading() {
  return (
    <div className="rounded-[1.5rem] border border-zinc-800/70 bg-zinc-950/40 p-6">
      <div className="h-5 w-44 animate-pulse rounded bg-zinc-800/90" />
      <div className="mt-4 h-4 w-full animate-pulse rounded bg-zinc-800/70" />
      <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-zinc-800/70" />
      <div className="mt-6 h-28 animate-pulse rounded-2xl bg-zinc-800/60" />
    </div>
  );
}

const QRScannerView = dynamic(
  () =>
    import("@/components/attendance/qr-scanner-view").then(
      (module) => module.QRScannerView,
    ),
  {
    ssr: false,
    loading: AttendanceSectionLoading,
  },
);

const AttendanceForm = dynamic(
  () =>
    import("@/components/attendance/attendance-form").then(
      (module) => module.AttendanceForm,
    ),
  {
    ssr: false,
    loading: AttendanceSectionLoading,
  },
);

const DailyLogView = dynamic(
  () =>
    import("@/components/attendance/daily-log-view").then(
      (module) => module.DailyLogView,
    ),
  {
    ssr: false,
    loading: AttendanceSectionLoading,
  },
);

const ScheduleSettings = dynamic(
  () =>
    import("@/components/attendance/schedule-settings").then(
      (module) => module.ScheduleSettings,
    ),
  {
    ssr: false,
    loading: AttendanceSectionLoading,
  },
);

const HolidayManager = dynamic(
  () =>
    import("@/components/attendance/holiday-manager").then(
      (module) => module.HolidayManager,
    ),
  {
    ssr: false,
    loading: AttendanceSectionLoading,
  },
);

function getDefaultSection(options: {
  canWriteAttendance: boolean;
  requestedSection: string | null;
  hasManualPrefill: boolean;
  hasLogPrefill: boolean;
}): AttendanceSection {
  const availableSections = options.canWriteAttendance
    ? new Set<AttendanceSection>(["qr", "manual", "log", "schedule", "holiday"])
    : new Set<AttendanceSection>(["log"]);

  if (
    options.requestedSection &&
    availableSections.has(options.requestedSection as AttendanceSection)
  ) {
    return options.requestedSection as AttendanceSection;
  }

  if (!options.canWriteAttendance) {
    return "log";
  }

  if (options.hasManualPrefill) {
    return "manual";
  }

  if (options.hasLogPrefill) {
    return "log";
  }

  return "qr";
}

export function AttendancePageClient({
  initialSettings,
  initialHolidays,
}: {
  initialSettings?: AttendanceSetting[];
  initialHolidays?: Holiday[];
}) {
  const desktopRuntime = isTauri();
  const { pathname, router, searchParams } = useAppNavigation();
  const getParam = (key: string) => searchParams?.get(key) ?? null;
  const { user } = useAuth();
  const canWriteAttendance = checkPermission(user, "attendance:write");
  const canReadAttendance = checkPermission(user, "attendance:read");
  const tabParam = getParam("tab");
  const initialTab = tabParam === "history" ? "history" : "today";

  const studentIdParam = getParam("studentId");
  const initialStudentId = studentIdParam?.trim() || undefined;

  const dateParam = getParam("date");
  const initialDate =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : undefined;

  const classIdParam = getParam("classId");
  const initialClassId = classIdParam?.trim() || undefined;

  const classNameParam = getParam("className");
  const initialClassName = classNameParam?.trim() || undefined;

  const startDateParam = getParam("startDate");
  const initialStartDate =
    startDateParam && /^\d{4}-\d{2}-\d{2}$/.test(startDateParam)
      ? startDateParam
      : undefined;

  const endDateParam = getParam("endDate");
  const initialEndDate =
    endDateParam && /^\d{4}-\d{2}-\d{2}$/.test(endDateParam)
      ? endDateParam
      : undefined;
  const requestedSection = getParam("section");
  const menuItems = canWriteAttendance ? writeMenuItems : readOnlyMenuItems;
  const defaultSection = getDefaultSection({
    canWriteAttendance,
    requestedSection,
    hasManualPrefill: Boolean(
      initialClassId || initialClassName || initialDate,
    ),
    hasLogPrefill: Boolean(
      tabParam || initialStudentId || initialStartDate || initialEndDate,
    ),
  });
  const [activeSection, setActiveSection] =
    useState<AttendanceSection>(defaultSection);
  const [isMenuCollapsed, setIsMenuCollapsed] = useState(true);
  const [startupReady, setStartupReady] = useState(false);
  const [attendanceBootstrapState, setAttendanceBootstrapState] =
    useState<AttendanceBootstrapState>("idle");
  const [attendanceBootstrapError, setAttendanceBootstrapError] = useState<
    string | null
  >(null);
  const activeMenuItem = menuItems.find((item) => item.id === activeSection);
  const activeSectionTheme = sectionThemes[activeSection];
  const ActiveSectionIcon = sectionIcons[activeSection];
  const attendanceRuntimeReady =
    startupReady && attendanceBootstrapState !== "syncing";

  useEffect(() => {
    setActiveSection(defaultSection);
  }, [defaultSection]);

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

  const runAttendanceBootstrap = useCallback(
    async (options?: { force?: boolean }) => {
      if (typeof window === "undefined" || !canReadAttendance) {
        setAttendanceBootstrapState("ready");
        setAttendanceBootstrapError(null);
        return;
      }

      setAttendanceBootstrapState("syncing");
      setAttendanceBootstrapError(null);

      try {
        await ensureAttendanceProjectionSync({
          force: options?.force,
        });
        setAttendanceBootstrapState("ready");
      } catch (error) {
        setAttendanceBootstrapState("failed");
        setAttendanceBootstrapError(
          error instanceof Error
            ? error.message
            : "Sinkronisasi proyeksi attendance gagal",
        );
      }
    },
    [canReadAttendance],
  );

  useEffect(() => {
    void runAttendanceBootstrap();
  }, [runAttendanceBootstrap]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(min-width: 1280px)");
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsMenuCollapsed(!event.matches);
    };

    handleChange(mediaQuery);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  function handleSectionChange(section: string) {
    const nextSection = section as AttendanceSection;
    setActiveSection(nextSection);

    if (typeof window !== "undefined" && window.innerWidth < 1280) {
      setIsMenuCollapsed(true);
    }

    if (!pathname) {
      return;
    }

    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("section", nextSection);
    const nextUrl = params.toString()
      ? `${pathname}?${params.toString()}`
      : pathname;
    router.replace(nextUrl, { scroll: false });
  }

  return (
    <div className="min-h-full space-y-10 p-1 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* 🚀 Hero Section */}
      <section className="relative overflow-hidden rounded-[2.5rem] border border-zinc-800/80 bg-zinc-950/40 p-6 shadow-2xl backdrop-blur-md md:p-10 lg:p-12">
        {/* Animated Background Elements */}
        <div className="absolute inset-y-0 right-0 w-full lg:w-1/2">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.15),transparent_65%)]" />
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-[100px]" />
          <div className="absolute top-1/2 -right-48 h-96 w-96 rounded-full bg-cyan-500/5 blur-[120px]" />
        </div>
        
        <div className="relative flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Attendance Hub</span>
            </div>
            
            <div className="space-y-4">
              <h1 className="bg-linear-to-r from-white via-emerald-200 to-zinc-500 bg-clip-text text-5xl font-black tracking-tighter text-transparent sm:text-6xl lg:text-7xl">
                Absensi & Giat
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-zinc-400 md:text-lg">
                {canWriteAttendance
                  ? desktopRuntime
                    ? "Pusat kendali absensi terpadu dengan integrasi QR Scanner, input manual per kelas, dan analisis risiko kehadiran secara real-time melalui jalur runtime lokal."
                    : "Kelola kehadiran siswa secara cerdas. Scanner QR, input log harian, dan pemantauan absensi terintegrasi penuh dalam satu alur kerja yang intuitif."
                  : "Pantau riwayat dan perkembangan kehadiran siswa secara komprehensif. Dapatkan informasi detail mengenai log absensi dan tren harian dengan aman."}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-emerald-300">
                <ShieldCheck className="h-4 w-4" />
                {canWriteAttendance ? "Operasional Penuh" : "Mode Baca Saja"}
              </div>
              <div className="flex items-center gap-2.5 rounded-2xl border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
                {desktopRuntime ? "Desktop Active" : "Web Online"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-1 lg:w-[220px]">
            {[
              { label: "Section", value: activeMenuItem?.label || "-", icon: QrCode },
              { label: "Sinkronisasi", value: attendanceBootstrapState === "ready" ? "Sudah Siap" : "Sedang Proses", icon: ClipboardList },
              { label: "Scope", value: "Real-time", icon: Sparkles },
            ].map((item) => (
              <div 
                key={item.label}
                className="group relative overflow-hidden rounded-2xl border border-zinc-800/50 bg-zinc-900/30 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-900/50"
              >
                <div className="absolute inset-x-0 bottom-0 h-[2px] w-0 bg-emerald-500 transition-all duration-300 group-hover:w-full" />
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

      {/* 🧭 Section Navigation */}
      <section className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between px-2">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[1.25rem] border border-emerald-500/20 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
              <ActiveSectionIcon className={cn("h-6 w-6", activeSectionTheme.accentClass)} />
            </div>
            <div>
              <p className={cn("text-[10px] font-bold uppercase tracking-[0.2em]", activeSectionTheme.accentClass)}>
                {activeSectionTheme.eyebrow}
              </p>
              <h2 className="text-xl font-bold tracking-tight text-white">
                {activeMenuItem?.label}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsMenuCollapsed(!isMenuCollapsed)}
            className="inline-flex items-center gap-2.5 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-300 transition-all hover:border-zinc-700 hover:bg-zinc-900 xl:hidden"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", !isMenuCollapsed && "rotate-180")} />
            {isMenuCollapsed ? "Pilih Menu" : "Tutup Menu"}
          </button>
        </div>

        <div className={cn(
          "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 transition-all duration-500 ease-in-out",
          isMenuCollapsed && "hidden xl:grid"
        )}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            const theme = sectionThemes[item.id];

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSectionChange(item.id)}
                className={cn(
                  "group relative flex flex-col justify-between overflow-hidden rounded-[2rem] border p-6 transition-all duration-300 hover:-translate-y-1",
                  isActive 
                    ? "border-emerald-500/40 bg-emerald-500/10 shadow-emerald-950/20 shadow-2xl" 
                    : "border-zinc-800/60 bg-zinc-950/40 hover:border-emerald-500/30 hover:bg-zinc-900/40"
                )}
              >
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-500/5 blur-2xl transition-all group-hover:bg-emerald-500/10" />
                
                <div className="space-y-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/80 text-emerald-400 shadow-inner group-hover:border-emerald-500/20 group-hover:bg-emerald-500/5">
                    <Icon className="h-6 w-6" />
                  </div>
                  
                  <div className="text-left">
                    <p className={cn("text-[10px] font-bold uppercase tracking-[0.2em]", isActive ? theme.accentClass : "text-zinc-500 group-hover:text-zinc-400")}>
                      {theme.eyebrow}
                    </p>
                    <h3 className={cn("mt-1.5 text-base font-bold transition-colors", isActive ? "text-white" : "text-zinc-300 group-hover:text-white")}>
                      {item.label}
                    </h3>
                  </div>
                </div>

                {isActive && (
                  <div className="mt-4 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Aktif</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* 🧩 Active Content Area */}
      <section className="space-y-8">
        {attendanceBootstrapState === "failed" && attendanceBootstrapError && (
          <div className="rounded-[2rem] border border-rose-500/20 bg-rose-500/5 p-6 animate-in zoom-in-95 duration-300">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400">
                  <ShieldMinus className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-rose-200">Koneksi Database Terhambat</h3>
                  <p className="text-sm text-rose-100/70">{attendanceBootstrapError}</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => runAttendanceBootstrap({ force: true })}
                className="rounded-xl bg-rose-500/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-rose-400 hover:bg-rose-500/20"
              >
                Coba Sinkronkan Lagi
              </button>
            </div>
          </div>
        )}

        {!attendanceRuntimeReady ? (
          <div className="space-y-6">
            <div className="rounded-[2.5rem] border border-zinc-800/80 bg-zinc-950/40 p-1 shadow-2xl backdrop-blur-xl">
              <AttendanceSectionLoading />
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {activeSection === "qr" && <QRScannerView />}
            {activeSection === "manual" && (
              <AttendanceForm
                initialClassId={initialClassId}
                initialClassName={initialClassName}
                initialDate={initialDate}
              />
            )}
            {activeSection === "log" && (
              <DailyLogView
                initialTab={initialTab}
                initialStudentId={initialStudentId}
                initialStartDate={initialStartDate}
                initialEndDate={initialEndDate}
              />
            )}
            {activeSection === "schedule" && canWriteAttendance && (
              <ScheduleSettings initialSettings={initialSettings} />
            )}
            {activeSection === "holiday" && canWriteAttendance && (
              <HolidayManager initialHolidays={initialHolidays} />
            )}
          </div>
        )}
      </section>
    </div>
  );
}
