"use client";

import dynamic from "next/dynamic";
import { Suspense, useState } from "react";
import { InlineState } from "@/components/common/inline-state";
import { AddTeacherDialog } from "@/components/teacher/add-teacher-dialog";
import { ImportTeachersExcelDialog } from "@/components/teacher/import-teachers-excel-dialog";
import { isTauri } from "@/core/env";
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
  const desktopRuntime = isTauri();
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
    <div className="animate-in fade-in space-y-6 duration-500">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight bg-linear-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
            Teachers & Staff
          </h2>
          <p className="text-zinc-400 mt-2 text-lg">
            Kelola akun admin, guru, dan staf menggunakan jalur web dan
            desktop-safe yang sekarang sudah sinkron untuk retest inti.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ImportTeachersExcelDialog
            onSuccess={() => setRefreshToken((value) => value + 1)}
          />
          <AddTeacherDialog
            onSuccess={() => setRefreshToken((value) => value + 1)}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 px-4 py-3 text-sm text-zinc-400">
        Kelola akun admin, guru, dan staf secara konsisten di web maupun desktop
        tanpa lompat ke flow web-only untuk CRUD dan import inti.
      </div>

      {desktopRuntime ? (
        <InlineState
          title="Desktop runtime aktif"
          description="CRUD user, import Excel, dan opsi wali kelas sekarang memakai local desktop path yang sama. Jalur ini tetap dibatasi untuk admin/super_admin."
          variant="info"
          className="text-sm"
        />
      ) : null}

      <TeacherList refreshToken={refreshToken} />
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
