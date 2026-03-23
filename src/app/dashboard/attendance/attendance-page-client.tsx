"use client";

import {
  CalendarCheck,
  ClipboardList,
  QrCode,
  Settings2,
  ShieldCheck,
  ShieldMinus,
  SunMoon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AttendanceForm } from "@/components/attendance/attendance-form";
import { DailyLogView } from "@/components/attendance/daily-log-view";
import { HolidayManager } from "@/components/attendance/holiday-manager";
import { QRScannerView } from "@/components/attendance/qr-scanner-view";
import { ScheduleSettings } from "@/components/attendance/schedule-settings";
import { InlineState } from "@/components/common/inline-state";
import { useAppNavigation } from "@/hooks/use-app-navigation";
import { useAuth } from "@/hooks/use-auth";
import { checkPermission } from "@/lib/auth/rbac";
import type { AttendanceSetting, Holiday } from "@/lib/db/schema";

type AttendanceSection = "qr" | "manual" | "log" | "schedule" | "holiday";

type AttendanceMenuItem = {
  id: AttendanceSection;
  label: string;
  description: string;
  icon: typeof QrCode;
};

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
    label: "Schedule Settings",
    description: "Pengaturan jadwal check-in dan check-out.",
    icon: Settings2,
  },
  {
    id: "holiday",
    label: "Holiday Manager",
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

  useEffect(() => {
    setActiveSection(defaultSection);
  }, [defaultSection]);

  function handleSectionChange(section: string) {
    const nextSection = section as AttendanceSection;
    setActiveSection(nextSection);

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
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-linear-to-r from-emerald-400 via-teal-400 to-cyan-500 bg-clip-text text-transparent">
            Manajemen Absensi
          </h1>
          <p className="text-zinc-400 mt-2 text-lg">
            {canWriteAttendance
              ? "Absensi manual dan QR yang berjalan di atas route backend yang tervalidasi."
              : "Riwayat dan log absensi yang mengikuti permission role aktif tanpa membuka jalur tulis yang tidak diizinkan."}
          </p>
        </div>
      </div>
      {canReadAttendance ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
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

          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-5">
            <div className="flex items-center gap-3">
              {canWriteAttendance ? (
                <ShieldCheck className="h-5 w-5 text-sky-300" />
              ) : (
                <ShieldMinus className="h-5 w-5 text-sky-300" />
              )}
              <div>
                <p className="text-sm font-semibold text-sky-200">
                  {canWriteAttendance ? "Akses Tulis Aktif" : "Mode Read Only"}
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
        <section className="space-y-4">
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
          </div>

          <div
            role="tablist"
            aria-label="Attendance sections"
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5"
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
                  className={`min-h-24 rounded-2xl border px-4 py-4 text-left transition-colors ${
                    isActive
                      ? "border-emerald-500/40 bg-emerald-500/10 text-zinc-50"
                      : "border-zinc-800 bg-zinc-950/50 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900/70 hover:text-zinc-100"
                  }`}
                >
                  <div className="flex w-full items-start gap-3">
                    <span
                      className={`rounded-xl border p-2 ${
                        isActive
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                          : "border-zinc-800 bg-zinc-900/80 text-emerald-300"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="space-y-1">
                      <p className="font-semibold">{item.label}</p>
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

          {activeSection === "qr" ? (
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-zinc-300">
                <QrCode className="h-5 w-5 text-emerald-400" />
                <h2 className="text-lg font-semibold">QR Attendance</h2>
              </div>

              <div className="rounded-3xl border border-zinc-900 border-t-zinc-800 bg-zinc-950/50 p-6 shadow-2xl backdrop-blur-md">
                <QRScannerView />
              </div>
            </section>
          ) : null}

          {activeSection === "manual" ? (
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-zinc-300">
                <ClipboardList className="h-5 w-5 text-blue-400" />
                <h2 className="text-lg font-semibold">Input Manual</h2>
              </div>

              <div className="rounded-3xl border border-zinc-900 border-t-zinc-800 bg-zinc-950/50 p-6 shadow-2xl backdrop-blur-md">
                <AttendanceForm
                  initialClassId={initialClassId}
                  initialClassName={initialClassName}
                  initialDate={initialDate}
                />
              </div>
            </section>
          ) : null}

          {activeSection === "log" ? (
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-zinc-300">
                <CalendarCheck className="h-5 w-5 text-amber-400" />
                <h2 className="text-lg font-semibold">Log Absensi</h2>
              </div>

              <div className="rounded-3xl border border-zinc-900 border-t-zinc-800 bg-zinc-950/50 p-6 shadow-2xl backdrop-blur-md">
                <DailyLogView
                  initialTab={initialTab}
                  initialStudentId={initialStudentId}
                  initialStartDate={initialStartDate}
                  initialEndDate={initialEndDate}
                />
              </div>
            </section>
          ) : null}

          {canWriteAttendance && activeSection === "schedule" ? (
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-zinc-300">
                <Settings2 className="h-5 w-5 text-cyan-400" />
                <h2 className="text-lg font-semibold">Schedule Settings</h2>
              </div>

              <div className="rounded-3xl border border-zinc-900 border-t-zinc-800 bg-zinc-950/50 p-6 shadow-2xl backdrop-blur-md">
                <ScheduleSettings initialSettings={initialSettings} />
              </div>
            </section>
          ) : null}

          {canWriteAttendance && activeSection === "holiday" ? (
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-zinc-300">
                <SunMoon className="h-5 w-5 text-emerald-400" />
                <h2 className="text-lg font-semibold">Holiday Manager</h2>
              </div>

              <div className="rounded-3xl border border-zinc-900 border-t-zinc-800 bg-zinc-950/50 p-6 shadow-2xl backdrop-blur-md">
                <HolidayManager initialHolidays={initialHolidays} />
              </div>
            </section>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
