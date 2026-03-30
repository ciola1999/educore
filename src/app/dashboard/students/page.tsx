"use client";

import { Users } from "lucide-react";
import { PhaseBoundary } from "@/components/common/phase-boundary";
import { StudentList } from "@/components/student/student-list";
import { isTauri } from "@/core/env";

export default function StudentsPage() {
  const desktopRuntime = isTauri();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <section className="relative overflow-hidden rounded-[2rem] border border-zinc-800/80 bg-linear-to-br from-zinc-950 via-zinc-950 to-sky-950/40 p-6 shadow-[0_30px_80px_-50px_rgba(14,165,233,0.35)] md:p-8">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.2),transparent_58%)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-200">
              <Users className="h-3.5 w-3.5" />
              Students Workspace
            </div>
            <div className="space-y-3">
              <h1 className="bg-linear-to-r from-white via-sky-100 to-zinc-400 bg-clip-text text-4xl font-black tracking-tight text-transparent md:text-5xl">
                Data Siswa
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-zinc-300 md:text-base">
                {desktopRuntime
                  ? "Desktop membuka roster siswa, detail identitas, core CRUD, create account per siswa, bulk maintenance inti, shortcut attendance, export, dan cetak kartu lewat jalur local-safe."
                  : "Workspace siswa untuk monitoring roster, absensi harian, identitas, akun, import, dan export dalam satu alur yang lebih rapi."}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[360px]">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Fokus
              </p>
              <p className="mt-2 text-sm font-medium text-zinc-100">
                Front-end Students
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Runtime
              </p>
              <p className="mt-2 text-sm font-medium text-zinc-100">
                Web + Tauri
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Mode
              </p>
              <p className="mt-2 text-sm font-medium text-zinc-100">
                {desktopRuntime ? "Roster & Core CRUD" : "Roster & CRUD"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <PhaseBoundary
        bannerDescription={
          desktopRuntime
            ? "Desktop saat ini sudah membuka roster, identitas, core CRUD siswa, import Excel, account creation per siswa, bulk account ops, repair kelas legacy, status absensi harian, export, dan shortcut attendance lewat local runtime yang sama."
            : "Halaman siswa tetap fokus pada identitas dan monitoring. Status absensi harian sekarang aktif dan setiap kartu siswa punya shortcut ke riwayat attendance."
        }
        actions={[
          {
            href: "/dashboard/attendance",
            label: "Buka Attendance",
          },
          {
            href: "/dashboard/courses",
            label: "Buka Data Akademik",
            variant: "outline",
          },
        ]}
      />

      <section className="space-y-4">
        <div className="flex items-center gap-3 text-zinc-300">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-sky-500/20 bg-sky-500/10">
            <Users className="h-5 w-5 text-sky-300" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">
              Roster & CRUD Siswa
            </h2>
            <p className="text-sm text-zinc-500">
              Kelola roster aktif, akun siswa, dan shortcut attendance.
            </p>
          </div>
        </div>

        <div className="rounded-[2rem] border border-zinc-800/80 bg-zinc-950/60 p-5 shadow-[0_30px_70px_-50px_rgba(15,23,42,0.9)] backdrop-blur-xl md:p-6">
          <StudentList />
        </div>
      </section>
    </div>
  );
}
