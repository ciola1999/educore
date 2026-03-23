"use client";

import { CalendarCheck, ShieldCheck, ShieldMinus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { AttendanceForm } from "@/components/attendance/attendance-form";
import { DailyLogView } from "@/components/attendance/daily-log-view";
import { HolidayManager } from "@/components/attendance/holiday-manager";
import { QRScannerView } from "@/components/attendance/qr-scanner-view";
import { ScheduleSettings } from "@/components/attendance/schedule-settings";
import { InlineState } from "@/components/common/inline-state";
import { useAuth } from "@/hooks/use-auth";
import { checkPermission } from "@/lib/auth/rbac";
import type { AttendanceSetting, Holiday } from "@/lib/db/schema";

export function AttendancePageClient({
  initialSettings,
  initialHolidays,
}: {
  initialSettings?: AttendanceSetting[];
  initialHolidays?: Holiday[];
}) {
  const searchParams = useSearchParams();
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

      {canWriteAttendance ? (
        <>
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-zinc-300">
              <CalendarCheck className="h-5 w-5 text-emerald-400" />
              <h2 className="text-lg font-semibold">QR Attendance</h2>
            </div>

            <div className="p-6 rounded-3xl bg-zinc-950/50 border border-zinc-900 border-t-zinc-800 shadow-2xl backdrop-blur-md">
              <QRScannerView />
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2 text-zinc-300">
              <CalendarCheck className="h-5 w-5 text-blue-400" />
              <h2 className="text-lg font-semibold">Input Manual</h2>
            </div>

            <div className="p-6 rounded-3xl bg-zinc-950/50 border border-zinc-900 border-t-zinc-800 shadow-2xl backdrop-blur-md">
              <AttendanceForm
                initialClassId={initialClassId}
                initialClassName={initialClassName}
                initialDate={initialDate}
              />
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2 text-zinc-300">
              <CalendarCheck className="h-5 w-5 text-cyan-400" />
              <h2 className="text-lg font-semibold">Schedule Settings</h2>
            </div>

            <div className="rounded-3xl border border-zinc-900 border-t-zinc-800 bg-zinc-950/50 p-6 shadow-2xl backdrop-blur-md">
              <ScheduleSettings initialSettings={initialSettings} />
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2 text-zinc-300">
              <CalendarCheck className="h-5 w-5 text-emerald-400" />
              <h2 className="text-lg font-semibold">Holiday Manager</h2>
            </div>

            <div className="rounded-3xl border border-zinc-900 border-t-zinc-800 bg-zinc-950/50 p-6 shadow-2xl backdrop-blur-md">
              <HolidayManager initialHolidays={initialHolidays} />
            </div>
          </section>
        </>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-zinc-300">
          <CalendarCheck className="h-5 w-5 text-amber-400" />
          <h2 className="text-lg font-semibold">Log Absensi</h2>
        </div>

        <div className="p-6 rounded-3xl bg-zinc-950/50 border border-zinc-900 border-t-zinc-800 shadow-2xl backdrop-blur-md">
          <DailyLogView
            initialTab={initialTab}
            initialStudentId={initialStudentId}
            initialStartDate={initialStartDate}
            initialEndDate={initialEndDate}
          />
        </div>
      </section>
    </div>
  );
}
