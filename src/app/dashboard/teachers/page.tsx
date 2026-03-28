"use client";

import { Filter, Search, X } from "lucide-react";
import { parseAsString, parseAsStringEnum, useQueryState } from "nuqs";
import { Suspense, useState } from "react";
import { InlineState } from "@/components/common/inline-state";
import { AddTeacherDialog } from "@/components/teacher/add-teacher-dialog";
import { ImportTeachersExcelDialog } from "@/components/teacher/import-teachers-excel-dialog";
import { TeacherList } from "@/components/teacher/teacher-list";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isTauri } from "@/core/env";
import { useAuth } from "@/hooks/use-auth";
import { outlineButtonStyles } from "@/lib/ui/outline-button-styles";

function TeachersContent() {
  const teacherOutlineButtonClass = `inline-flex h-11 items-center gap-1 rounded-xl px-3 text-sm transition ${outlineButtonStyles.neutral}`;
  const { user } = useAuth();
  const desktopRuntime = isTauri();
  const [refreshToken, setRefreshToken] = useState(0);
  const [search, setSearch] = useQueryState(
    "q",
    parseAsString.withDefault("").withOptions({ shallow: false }),
  );

  const [roleFilter, setRoleFilter] = useQueryState(
    "role",
    parseAsStringEnum(["super_admin", "admin", "teacher", "staff"]).withOptions(
      {
        shallow: false,
      },
    ),
  );
  const currentUserRole = (user?.role as string | undefined) ?? null;
  const canManageUsers =
    currentUserRole === "admin" || currentUserRole === "super_admin";
  const hasActiveFilter = Boolean(search.trim()) || Boolean(roleFilter);

  if (!canManageUsers) {
    return (
      <InlineState
        title="Akses dibatasi"
        description="Halaman Manajemen User hanya tersedia untuk admin/super admin. Guru dan staf tidak dapat mengubah data akun dari modul ini."
        variant="warning"
      />
    );
  }

  return (
    <div className="animate-in fade-in space-y-6 duration-500">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight bg-linear-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
            Manajemen User
          </h2>
          <p className="text-zinc-400 mt-2 text-lg">
            Kelola akun admin, guru, dan staf menggunakan kontrak API fase 1
            yang sudah stabil.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!desktopRuntime ? (
            <ImportTeachersExcelDialog
              onSuccess={() => setRefreshToken((value) => value + 1)}
            />
          ) : null}
          <AddTeacherDialog
            onSuccess={() => setRefreshToken((value) => value + 1)}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 px-4 py-3 text-sm text-zinc-400">
        Kelola akun admin, guru, dan staf secara konsisten di web maupun
        desktop.
      </div>

      {desktopRuntime ? (
        <InlineState
          title="Desktop runtime aktif"
          description="CRUD user dan opsi wali kelas memakai local desktop path. Import Excel tetap dibatasi ke runtime web karena masih memakai upload route server."
          variant="info"
          className="text-sm"
        />
      ) : null}

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/30 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              placeholder="Cari berdasarkan nama atau email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 rounded-xl border-zinc-800 bg-zinc-900/50 pl-10 transition-all focus:ring-blue-500/20"
            />
          </div>
          <div className="flex gap-2">
            <Select
              value={roleFilter || "all"}
              onValueChange={(val) =>
                setRoleFilter(
                  val === "all"
                    ? null
                    : (val as "super_admin" | "admin" | "teacher" | "staff"),
                )
              }
            >
              <SelectTrigger className="h-11 w-[170px] rounded-xl border-zinc-800 bg-zinc-900/50">
                <Filter className="mr-2 h-4 w-4 text-zinc-500" />
                <SelectValue placeholder="Semua Role" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-zinc-800 bg-zinc-900 text-white">
                <SelectItem value="all">Semua Role</SelectItem>
                <SelectItem value="teacher">Guru</SelectItem>
                <SelectItem value="staff">Staf</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
            {hasActiveFilter ? (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setRoleFilter(null);
                }}
                className={teacherOutlineButtonClass}
              >
                <X className="h-4 w-4" />
                Reset
              </button>
            ) : null}
          </div>
        </div>
      </div>

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
