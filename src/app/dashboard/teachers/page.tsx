"use client";

import { Lock, ShieldCheck, Sparkles, Users } from "lucide-react";
import dynamic from "next/dynamic";
import { Suspense, useState } from "react";
import { InlineState } from "@/components/common/inline-state";
import { AddTeacherDialog } from "@/components/teacher/add-teacher-dialog";
import { ImportTeachersExcelDialog } from "@/components/teacher/import-teachers-excel-dialog";
import { useAuth } from "@/hooks/use-auth";

const TeacherList = dynamic(
  () =>
    import("@/components/teacher/teacher-list").then(
      (module) => module.TeacherList,
    ),
  {
    ssr: false,
    loading: () => <div>Memuat daftar user...</div>,
  },
);

function TeachersContent() {
  const { user } = useAuth();
  const [refreshToken, setRefreshToken] = useState(0);
  const currentUserRole = (user?.role as string | undefined) ?? null;
  const canManageUsers =
    currentUserRole === "admin" || currentUserRole === "super_admin";

  if (!canManageUsers) {
    return (
      <InlineState
        title="Akses dibatasi"
        description="Halaman Teachers & Staff hanya tersedia untuk admin/super admin. Guru dan staf tidak dapat mengubah data akun dari modul ini."
        variant="warning"
      />
    );
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
              <span>Human Resources</span>
            </div>

            <div className="space-y-4">
              <h1 className="bg-linear-to-r from-white via-emerald-200 to-zinc-500 bg-clip-text text-5xl font-black tracking-tighter text-transparent sm:text-6xl lg:text-7xl">
                Teachers & Staff
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-zinc-400 md:text-lg">
                Pusat manajemen sumber daya manusia EDUCORE. Kelola profil
                pengajar, staf administratif, dan hak akses sistem secara
                terpusat dengan standar keamanan tingkat tinggi.
              </p>
            </div>

            <div className="flex flex-wrap gap-4 pt-2">
              <ImportTeachersExcelDialog
                onSuccess={() => setRefreshToken((value) => value + 1)}
              />
              <AddTeacherDialog
                onSuccess={() => setRefreshToken((value) => value + 1)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-1 lg:w-[240px]">
            {[
              { label: "Total Entitas", value: "Aktif", icon: Users },
              { label: "Otoritas", value: "Admin Access", icon: ShieldCheck },
              { label: "Keamanan", value: "Verified", icon: Lock },
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

      {/* 📊 Content Section */}
      <section className="space-y-6">
        <TeacherList refreshToken={refreshToken} />
      </section>
    </div>
  );
}

export default function TeachersPage() {
  return (
    <Suspense fallback={<div>Memuat...</div>}>
      <TeachersContent />
    </Suspense>
  );
}
