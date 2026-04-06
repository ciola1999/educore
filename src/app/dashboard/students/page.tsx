"use client";

import { Users } from "lucide-react";
import dynamic from "next/dynamic";
import { isTauri } from "@/core/env";

const StudentList = dynamic(
  () =>
    import("@/components/student/student-list").then(
      (module) => module.StudentList,
    ),
  {
    ssr: false,
    loading: () => <div>Memuat roster siswa...</div>,
  },
);

export default function StudentsPage() {
  const desktopRuntime = isTauri();

  return (
    <div className="min-h-full space-y-8 p-4 md:p-1 md:pt-4 animate-in fade-in duration-700">
      <section className="relative overflow-hidden rounded-[2.5rem] border border-zinc-800/80 bg-zinc-950/40 p-6 shadow-2xl backdrop-blur-md md:p-10 lg:p-12">
        {/* Animated Background Elements */}
        <div className="absolute inset-y-0 right-0 w-full lg:w-1/2">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.15),transparent_60%)]" />
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-sky-500/10 blur-[100px]" />
          <div className="absolute top-1/2 -right-48 h-96 w-96 rounded-full bg-indigo-500/5 blur-[120px]" />
        </div>

        <div className="relative flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.25em] text-sky-300">
              <Users className="h-3.5 w-3.5" />
              <span>Students Workspace</span>
            </div>

            <div className="space-y-4">
              <h1 className="bg-linear-to-r from-white via-sky-200 to-zinc-500 bg-clip-text text-5xl font-black tracking-tighter text-transparent sm:text-6xl lg:text-7xl">
                Data Siswa
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-zinc-400 md:text-lg">
                {desktopRuntime
                  ? "Akses jalur runtime lokal untuk manajemen roster siswa secara full-depth. Kelola identitas, akun login, pemeliharaan massal, hingga pencetakan kartu ID dengan performa tinggi."
                  : "Workspace komprehensif untuk pengolahan data siswa. Pantau kehadiran, kelola akun, dan navigasi roster aktif dalam satu antarmuka yang intuitif dan responsif."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-1 lg:w-[220px]">
            {[
              { label: "Fokus", value: "Students" },
              {
                label: "Runtime",
                value: desktopRuntime ? "Tauri App" : "Web Hub",
              },
              { label: "Mode", value: "Core CRUD" },
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

      <section className="space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between px-4 sm:px-2">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[1.25rem] border border-sky-500/20 bg-sky-500/10 shadow-[0_0_20px_rgba(14,165,233,0.1)]">
              <Users className="h-6 w-6 text-sky-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">
                Roster & Manajemen Siswa
              </h2>
              <p className="text-sm text-zinc-500">
                Data real-time untuk seluruh profil siswa di database.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[2.5rem] border border-zinc-800/80 bg-zinc-950/40 p-1 shadow-2xl backdrop-blur-xl transition-all md:p-2">
          <div className="p-4 md:p-6">
            <StudentList />
          </div>
        </div>
      </section>
    </div>
  );
}
