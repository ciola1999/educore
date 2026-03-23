"use client";

import { Filter, Search } from "lucide-react";
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
import { useAuth } from "@/hooks/use-auth";

function TeachersContent() {
  const { user } = useAuth();
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
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
          <ImportTeachersExcelDialog
            onSuccess={() => setRefreshToken((value) => value + 1)}
          />
          <AddTeacherDialog
            onSuccess={() => setRefreshToken((value) => value + 1)}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 px-4 py-3 text-sm text-zinc-400">
        Fase 1 saat ini mendukung CRUD akun user (lihat, tambah, edit, hapus)
        dengan kontrak API yang sama antara web dan desktop.
      </div>

      {/* Filters Section */}
      <div className="flex flex-col sm:flex-row gap-4 p-1">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Cari berdasarkan nama atau email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 bg-zinc-900/50 border-zinc-800 focus:ring-blue-500/20 transition-all rounded-xl"
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
            <SelectTrigger className="h-11 w-[160px] bg-zinc-900/50 border-zinc-800 rounded-xl">
              <Filter className="h-4 w-4 mr-2 text-zinc-500" />
              <SelectValue placeholder="Semua Role" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800 text-white rounded-xl">
              <SelectItem value="all">Semua Role</SelectItem>
              <SelectItem value="teacher">Guru</SelectItem>
              <SelectItem value="staff">Staf</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="super_admin">Super Admin</SelectItem>
            </SelectContent>
          </Select>
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
