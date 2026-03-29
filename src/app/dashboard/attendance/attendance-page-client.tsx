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
import { InlineState } from "@/components/common/inline-state";
import { useAppNavigation } from "@/hooks/use-app-navigation";
import { useAuth } from "@/hooks/use-auth";
import { apiPost } from "@/lib/api/request";
import { checkPermission } from "@/lib/auth/rbac";
import type { AttendanceSetting, Holiday } from "@/lib/db/schema";
import { ensureAppWarmup } from "@/lib/runtime/app-bootstrap";
import { cn } from "@/lib/utils";

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

type AttendanceProjectionSyncResult = {
  classCreated: number;
  studentUpserted: number;
  settingsSeeded: number;
};

type AttendanceBootstrapState = "idle" | "syncing" | "ready" | "failed";

const ATTENDANCE_PROJECTION_LAST_SYNC_KEY = "attendance_projection_last_sync";
const ATTENDANCE_PROJECTION_SYNC_COOLDOWN_MS = 5 * 60 * 1000;

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

const sectionSurfaceClass =
  "relative overflow-hidden rounded-[2rem] border border-zinc-800/90 bg-linear-to-br from-zinc-950/80 via-zinc-950/68 to-zinc-900/48 p-6 shadow-2xl shadow-black/20 backdrop-blur-md before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-linear-to-r before:from-transparent before:via-white/12 before:to-transparent";
const overviewCardClass =
  "rounded-[1.6rem] border p-5 shadow-sm shadow-black/10";
const sectionTransitionClass =
  "animate-in fade-in slide-in-from-bottom-4 duration-300";
const attendanceStackClass = "space-y-6 lg:space-y-7";
const sectionHeaderShellClass =
  "rounded-[1.6rem] border border-zinc-800/80 bg-linear-to-r from-zinc-950/88 via-zinc-950/72 to-zinc-900/52 px-5 py-4 shadow-sm shadow-black/10";
const sectionHeaderIconShellClass =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-sm shadow-black/10";
const sectionHeaderEyebrowClass =
  "text-[11px] font-medium uppercase tracking-[0.22em]";
const sectionHeaderTitleClass = "mt-1 text-lg font-semibold tracking-tight";
const sectionHeaderCopyClass = "mt-1 text-sm text-zinc-400";

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

      const now = Date.now();
      const lastSyncAt = Number(
        window.sessionStorage.getItem(ATTENDANCE_PROJECTION_LAST_SYNC_KEY),
      );
      const hasRecentSync =
        !options?.force &&
        Number.isFinite(lastSyncAt) &&
        now - lastSyncAt <= ATTENDANCE_PROJECTION_SYNC_COOLDOWN_MS;

      if (hasRecentSync) {
        setAttendanceBootstrapState("ready");
        setAttendanceBootstrapError(null);
        return;
      }

      setAttendanceBootstrapState("syncing");
      setAttendanceBootstrapError(null);
      window.sessionStorage.setItem(
        ATTENDANCE_PROJECTION_LAST_SYNC_KEY,
        now.toString(),
      );

      try {
        await apiPost<AttendanceProjectionSyncResult>(
          "/api/attendance/projection-sync",
        );
        setAttendanceBootstrapState("ready");
      } catch (error) {
        window.sessionStorage.removeItem(ATTENDANCE_PROJECTION_LAST_SYNC_KEY);
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
    <div className="space-y-6 animate-in fade-in duration-500 lg:space-y-8">
      <div
        className={cn(
          sectionSurfaceClass,
          "px-5 py-5 sm:px-6 sm:py-6 before:via-emerald-200/15",
        )}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-10 top-0 h-32 w-32 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="absolute right-0 top-8 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-24 w-24 rounded-full bg-teal-400/8 blur-2xl" />
        </div>
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
              <Sparkles className="h-3.5 w-3.5" />
              Pusat Kendali Attendance
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-[2.7rem]">
              <span className="bg-linear-to-r from-emerald-300 via-teal-200 to-cyan-400 bg-clip-text text-transparent">
                Manajemen Absensi
              </span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-300 sm:text-base lg:text-lg">
              {canWriteAttendance
                ? "Absensi manual, scanner QR, dan insight kehadiran berjalan di atas route backend yang tervalidasi untuk web serta desktop."
                : "Riwayat dan insight attendance tersedia sesuai permission role aktif tanpa membuka jalur tulis yang tidak diizinkan."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
                {canWriteAttendance ? "Operasional Penuh" : "Analitik Aman"}
              </span>
              <span className="rounded-full border border-zinc-800 bg-zinc-950/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
                Siap Web + Desktop
              </span>
              <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
                Sinkron Siswa ke Attendance
              </span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                label: "Mode Peran",
                value: canWriteAttendance ? "Operator Penuh" : "Baca Saja",
              },
              {
                label: "Section Aktif",
                value: activeMenuItem?.label || "-",
              },
              {
                label: "Alur Runtime",
                value: canWriteAttendance
                  ? "QR + Manual + Analitik"
                  : "Analitik Saja",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[1.4rem] border border-zinc-800/80 bg-zinc-950/60 px-4 py-3 text-xs text-zinc-500 shadow-lg shadow-black/10 backdrop-blur-sm"
              >
                <p className="uppercase tracking-[0.16em] text-zinc-500/90">
                  {item.label}
                </p>
                <p className="mt-2 text-sm font-semibold text-zinc-100">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
      {canReadAttendance ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div
            className={cn(
              overviewCardClass,
              "border-emerald-500/20 bg-emerald-500/5",
            )}
          >
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-300" />
              <div>
                <p className="text-sm font-semibold text-emerald-200">
                  Akses Baca Aktif
                </p>
                <p className="text-sm text-emerald-100/80">
                  Log hari ini dan riwayat absensi tersedia untuk role{" "}
                  <span className="font-semibold">{user?.role || "-"}</span>.
                </p>
              </div>
            </div>
          </div>

          <div
            className={cn(overviewCardClass, "border-sky-500/20 bg-sky-500/5")}
          >
            <div className="flex items-center gap-3">
              {canWriteAttendance ? (
                <ShieldCheck className="h-5 w-5 text-sky-300" />
              ) : (
                <ShieldMinus className="h-5 w-5 text-sky-300" />
              )}
              <div>
                <p className="text-sm font-semibold text-sky-200">
                  {canWriteAttendance ? "Akses Tulis Aktif" : "Mode Baca Saja"}
                </p>
                <p className="text-sm text-sky-100/80">
                  {canWriteAttendance
                    ? "QR scan dan input manual tersedia untuk operasi absensi harian."
                    : "Aksi scan QR dan simpan absensi manual disembunyikan karena role ini tidak punya permission attendance:write."}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <InlineState
          title="Akses absensi tidak tersedia"
          description="Role aktif tidak memiliki permission untuk membuka data absensi."
          variant="warning"
        />
      )}

      {canReadAttendance ? (
        <section className={attendanceStackClass}>
          {attendanceBootstrapState === "failed" && attendanceBootstrapError ? (
            <InlineState
              title="Bootstrap attendance perlu perhatian"
              description={attendanceBootstrapError}
              actionLabel="Sinkronkan Ulang"
              onAction={() => {
                void runAttendanceBootstrap({ force: true });
              }}
              variant={
                attendanceBootstrapError.includes("izin") ||
                attendanceBootstrapError.includes("login")
                  ? "warning"
                  : "error"
              }
            />
          ) : null}

          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">
                Menu Attendance
              </h2>
              <p className="text-sm text-zinc-400">
                Setiap fitur dipisah ke menu sendiri agar alur lebih ringkas di
                desktop maupun web.
              </p>
            </div>
            <button
              type="button"
              aria-expanded={!isMenuCollapsed}
              aria-controls="attendance-section-menu"
              onClick={() => setIsMenuCollapsed((current) => !current)}
              className="inline-flex items-center gap-3 self-start rounded-[1.2rem] border border-zinc-800 bg-linear-to-r from-zinc-950/90 via-zinc-950/75 to-zinc-900/60 px-3.5 py-2.5 text-left text-zinc-300 shadow-sm shadow-black/10 transition hover:border-zinc-700 hover:bg-zinc-900/80 hover:text-zinc-100 xl:hidden"
            >
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-sm shadow-black/10",
                  activeSectionTheme.badgeClass,
                )}
              >
                <ActiveSectionIcon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Section Aktif
                </span>
                <span className="mt-1 block truncate text-sm font-semibold text-zinc-100">
                  {activeMenuItem?.label || "Attendance"}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="rounded-full border border-zinc-800 bg-zinc-950/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
                  {isMenuCollapsed ? "Buka" : "Tutup"}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    isMenuCollapsed ? "rotate-0" : "rotate-180",
                  )}
                />
              </span>
            </button>
          </div>

          <div className="rounded-[1.6rem] border border-zinc-800/80 bg-linear-to-r from-zinc-950/85 via-zinc-950/70 to-zinc-900/45 px-5 py-4 shadow-sm shadow-black/10">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-sm shadow-black/10 sm:inline-flex",
                    activeSectionTheme.badgeClass,
                  )}
                >
                  <ActiveSectionIcon className="h-4.5 w-4.5" />
                </span>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">
                    Section Aktif
                  </p>
                  <h3 className="mt-2 text-lg font-semibold tracking-tight text-zinc-100">
                    {activeMenuItem?.label || "Attendance"}
                  </h3>
                  <p className="mt-1 text-sm text-zinc-400">
                    {activeMenuItem?.description ||
                      "Pilih section untuk mulai mengelola attendance."}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em]",
                    activeSectionTheme.badgeClass,
                  )}
                >
                  {activeSectionTheme.eyebrow}
                </span>
                <span className="rounded-full border border-zinc-800 bg-zinc-950/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
                  {canWriteAttendance ? "Tulis Aktif" : "Baca Saja"}
                </span>
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
                  Web + Desktop
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-[1.4rem] border border-zinc-800/70 bg-zinc-950/45 px-4 py-3 shadow-sm shadow-black/10 xl:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">
                  Section Aktif
                </p>
                <h3 className="mt-1 truncate text-sm font-semibold tracking-tight text-zinc-100">
                  {activeMenuItem?.label || "Attendance"}
                </h3>
              </div>
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                  activeSectionTheme.badgeClass,
                )}
              >
                {activeSectionTheme.eyebrow}
              </span>
            </div>
          </div>

          <div
            id="attendance-section-menu"
            role="tablist"
            aria-label="Section attendance"
            className={cn(
              "grid grid-cols-1 gap-3 overflow-hidden transition-all duration-300 ease-out sm:grid-cols-2 xl:grid-cols-5",
              isMenuCollapsed
                ? "pointer-events-none max-h-0 -translate-y-2 opacity-0 xl:pointer-events-auto xl:max-h-none xl:translate-y-0 xl:opacity-100"
                : "pointer-events-auto max-h-[120rem] translate-y-0 opacity-100",
            )}
          >
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => handleSectionChange(item.id)}
                  className={cn(
                    "min-h-28 overflow-hidden rounded-[1.6rem] border px-4 py-4 text-left transition-all duration-300 ease-out",
                    isActive
                      ? "border-emerald-500/40 bg-linear-to-br from-emerald-500/12 to-cyan-500/8 text-zinc-50 shadow-lg shadow-emerald-950/15"
                      : "border-zinc-800 bg-zinc-950/50 text-zinc-300 hover:-translate-y-1 hover:border-zinc-700 hover:bg-zinc-900/70 hover:text-zinc-100 hover:shadow-md hover:shadow-black/20",
                  )}
                  style={{
                    transitionDelay: isMenuCollapsed
                      ? "0ms"
                      : `${menuItems.indexOf(item) * 35}ms`,
                  }}
                >
                  <div className="flex w-full items-start gap-4">
                    <div className="flex w-16 shrink-0 flex-col items-start gap-2">
                      <span
                        className={cn(
                          "rounded-xl border p-2 shadow-sm shadow-black/10",
                          isActive
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                            : "border-zinc-800 bg-zinc-900/80 text-emerald-300",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      {isActive ? (
                        <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
                          Aktif
                        </span>
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <p
                        className={cn(
                          "text-[11px] font-medium uppercase tracking-[0.22em]",
                          isActive
                            ? activeSectionTheme.accentClass
                            : "text-zinc-500",
                        )}
                      >
                        {sectionThemes[item.id].eyebrow}
                      </p>
                      <div className="flex items-start">
                        <p className="min-w-0 flex-1 text-sm font-semibold leading-snug break-words">
                          {item.label}
                        </p>
                      </div>
                      <p
                        className={
                          isActive
                            ? "text-xs leading-relaxed text-zinc-200"
                            : "text-xs leading-relaxed text-zinc-400"
                        }
                      >
                        {item.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {!attendanceRuntimeReady ? (
            <section
              className={cn(attendanceStackClass, sectionTransitionClass)}
            >
              <div className={sectionHeaderShellClass}>
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      sectionHeaderIconShellClass,
                      "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
                    )}
                  >
                    <ActiveSectionIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <p
                      className={cn(
                        sectionHeaderEyebrowClass,
                        activeSectionTheme.accentClass,
                      )}
                    >
                      Menyiapkan Runtime Attendance
                    </p>
                    <h2 className={sectionHeaderTitleClass}>
                      {activeMenuItem?.label || "Attendance"}
                    </h2>
                    <p className={sectionHeaderCopyClass}>
                      {attendanceBootstrapState === "syncing"
                        ? "Projection attendance sedang diselaraskan agar QR, log, dan input manual membaca data turunan yang sama."
                        : "Runtime lokal/web sedang menyelesaikan bootstrap database agar section aktif tidak timeout saat cold start pertama."}
                    </p>
                  </div>
                </div>
              </div>

              <div className={sectionSurfaceClass}>
                <AttendanceSectionLoading />
              </div>
            </section>
          ) : null}

          {attendanceRuntimeReady && activeSection === "qr" ? (
            <section
              className={cn(attendanceStackClass, sectionTransitionClass)}
            >
              <div className={sectionHeaderShellClass}>
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      sectionHeaderIconShellClass,
                      "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
                    )}
                  >
                    <QrCode className="h-5 w-5 text-emerald-300" />
                  </span>
                  <div>
                    <p
                      className={cn(
                        sectionHeaderEyebrowClass,
                        activeSectionTheme.accentClass,
                      )}
                    >
                      {activeSectionTheme.eyebrow}
                    </p>
                    <h2 className={sectionHeaderTitleClass}>QR Attendance</h2>
                    <p className={sectionHeaderCopyClass}>
                      {activeMenuItem?.description}
                    </p>
                  </div>
                </div>
              </div>

              <div className={sectionSurfaceClass}>
                <QRScannerView />
              </div>
            </section>
          ) : null}

          {attendanceRuntimeReady && activeSection === "manual" ? (
            <section
              className={cn(attendanceStackClass, sectionTransitionClass)}
            >
              <div className={sectionHeaderShellClass}>
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      sectionHeaderIconShellClass,
                      "border-sky-500/20 bg-sky-500/10 text-sky-200",
                    )}
                  >
                    <ClipboardList className="h-5 w-5 text-sky-300" />
                  </span>
                  <div>
                    <p
                      className={cn(
                        sectionHeaderEyebrowClass,
                        activeSectionTheme.accentClass,
                      )}
                    >
                      {activeSectionTheme.eyebrow}
                    </p>
                    <h2 className={sectionHeaderTitleClass}>Input Manual</h2>
                    <p className={sectionHeaderCopyClass}>
                      {activeMenuItem?.description}
                    </p>
                  </div>
                </div>
              </div>

              <div className={sectionSurfaceClass}>
                <AttendanceForm
                  initialClassId={initialClassId}
                  initialClassName={initialClassName}
                  initialDate={initialDate}
                />
              </div>
            </section>
          ) : null}

          {attendanceRuntimeReady && activeSection === "log" ? (
            <section
              className={cn(attendanceStackClass, sectionTransitionClass)}
            >
              <div className={sectionHeaderShellClass}>
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      sectionHeaderIconShellClass,
                      "border-amber-500/20 bg-amber-500/10 text-amber-200",
                    )}
                  >
                    <CalendarCheck className="h-5 w-5 text-amber-300" />
                  </span>
                  <div>
                    <p
                      className={cn(
                        sectionHeaderEyebrowClass,
                        activeSectionTheme.accentClass,
                      )}
                    >
                      {activeSectionTheme.eyebrow}
                    </p>
                    <h2 className={sectionHeaderTitleClass}>Log Absensi</h2>
                    <p className={sectionHeaderCopyClass}>
                      {activeMenuItem?.description}
                    </p>
                  </div>
                </div>
              </div>

              <div className={sectionSurfaceClass}>
                <DailyLogView
                  initialTab={initialTab}
                  initialStudentId={initialStudentId}
                  initialStartDate={initialStartDate}
                  initialEndDate={initialEndDate}
                />
              </div>
            </section>
          ) : null}

          {attendanceRuntimeReady &&
          canWriteAttendance &&
          activeSection === "schedule" ? (
            <section
              className={cn(attendanceStackClass, sectionTransitionClass)}
            >
              <div className={sectionHeaderShellClass}>
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      sectionHeaderIconShellClass,
                      "border-cyan-500/20 bg-cyan-500/10 text-cyan-200",
                    )}
                  >
                    <Settings2 className="h-5 w-5 text-cyan-300" />
                  </span>
                  <div>
                    <p
                      className={cn(
                        sectionHeaderEyebrowClass,
                        activeSectionTheme.accentClass,
                      )}
                    >
                      {activeSectionTheme.eyebrow}
                    </p>
                    <h2 className={sectionHeaderTitleClass}>
                      Pengaturan Jadwal
                    </h2>
                    <p className={sectionHeaderCopyClass}>
                      {activeMenuItem?.description}
                    </p>
                  </div>
                </div>
              </div>

              <div className={sectionSurfaceClass}>
                <ScheduleSettings initialSettings={initialSettings} />
              </div>
            </section>
          ) : null}

          {attendanceRuntimeReady &&
          canWriteAttendance &&
          activeSection === "holiday" ? (
            <section
              className={cn(attendanceStackClass, sectionTransitionClass)}
            >
              <div className={sectionHeaderShellClass}>
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      sectionHeaderIconShellClass,
                      "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
                    )}
                  >
                    <SunMoon className="h-5 w-5 text-emerald-300" />
                  </span>
                  <div>
                    <p
                      className={cn(
                        sectionHeaderEyebrowClass,
                        activeSectionTheme.accentClass,
                      )}
                    >
                      {activeSectionTheme.eyebrow}
                    </p>
                    <h2 className={sectionHeaderTitleClass}>
                      Kelola Hari Libur
                    </h2>
                    <p className={sectionHeaderCopyClass}>
                      {activeMenuItem?.description}
                    </p>
                  </div>
                </div>
              </div>

              <div className={sectionSurfaceClass}>
                <HolidayManager initialHolidays={initialHolidays} />
              </div>
            </section>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
