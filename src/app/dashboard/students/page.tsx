"use client";

import { Users } from "lucide-react";
import { PhaseBoundary } from "@/components/common/phase-boundary";
import { StudentList } from "@/components/student/student-list";

export default function StudentsPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-linear-to-r from-sky-300 via-cyan-200 to-zinc-400 bg-clip-text text-transparent">
            Data Siswa
          </h1>
          <p className="text-zinc-400 mt-2 text-lg">
            Roster siswa phase 1 dengan status absensi harian yang terhubung
            langsung ke halaman attendance.
          </p>
        </div>
      </div>

      <PhaseBoundary
        bannerDescription="Halaman siswa tetap fokus pada identitas dan monitoring. Status absensi harian sekarang aktif dan setiap kartu siswa punya shortcut ke riwayat attendance."
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
        <div className="flex items-center gap-2 text-zinc-300">
          <Users className="h-5 w-5 text-sky-400" />
          <h2 className="text-lg font-semibold">Roster & CRUD Siswa</h2>
        </div>

        <div className="rounded-3xl border border-zinc-900 border-t-zinc-800 bg-zinc-950/50 p-6 shadow-2xl backdrop-blur-md">
          <StudentList />
        </div>
      </section>
    </div>
  );
}
