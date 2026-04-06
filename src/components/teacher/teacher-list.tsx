"use client";

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Filter,
  GraduationCap,
  IdCard,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { parseAsString, parseAsStringEnum, useQueryState } from "nuqs";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type Teacher, useTeacherList } from "@/hooks/use-teacher-list";
import { cn } from "@/lib/utils";
import { InlineState } from "../common/inline-state";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

const IDCardView = dynamic(
  () => import("../id-card/id-card-view").then((module) => module.IDCardView),
  {
    ssr: false,
    loading: () => (
      <div className="py-6 text-sm text-zinc-500">Menyiapkan kartu...</div>
    ),
  },
);

const EditTeacherDialog = dynamic(() =>
  import("./edit-teacher-dialog").then((module) => module.EditTeacherDialog),
);

const DeleteTeacherDialog = dynamic(() =>
  import("./delete-teacher-dialog").then(
    (module) => module.DeleteTeacherDialog,
  ),
);

export function TeacherList({ refreshToken = 0 }: { refreshToken?: number }) {
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
  const {
    teachers,
    loading,
    errorMessage,
    sortBy,
    sortOrder,
    toggleSort,
    deleteOpen,
    setDeleteOpen,
    deleteTeacher,
    handleDelete,
    fetchTeachers,
  } = useTeacherList({ refreshToken, search, roleFilter });

  const [idCardOpen, setIdCardOpen] = useState(false);
  const [selectedTeacherForCard, setSelectedTeacherForCard] =
    useState<Teacher | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const hasActiveFilter = Boolean(search.trim()) || Boolean(roleFilter);

  const totalPages = Math.max(1, Math.ceil(teachers.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const pagedTeachers = teachers.slice(startIndex, startIndex + pageSize);

  const roleColors: Record<string, string> = {
    super_admin: "bg-red-500/10 text-red-400 ring-red-500/20",
    teacher: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
    staff: "bg-orange-500/10 text-orange-400 ring-orange-500/20",
    admin: "bg-sky-500/10 text-sky-400 ring-sky-500/20",
  };

  const roleLabels: Record<Teacher["role"], string> = {
    super_admin: "Super Admin",
    admin: "Admin",
    teacher: "Guru",
    staff: "Staf",
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return null;
    return sortOrder === "asc" ? (
      <ChevronUp className="ml-1 h-4 w-4" />
    ) : (
      <ChevronDown className="ml-1 h-4 w-4" />
    );
  };

  if (loading && teachers.length === 0) {
    return (
      <div className="flex items-center justify-center py-24 text-zinc-500">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
      </div>
    );
  }

  if (errorMessage && teachers.length === 0) {
    return (
      <InlineState
        title="Data user tidak tersedia"
        description={errorMessage}
        actionLabel="Coba Lagi"
        onAction={() => {
          void fetchTeachers();
        }}
        variant={
          errorMessage.includes("izin") || errorMessage.includes("login")
            ? "warning"
            : "error"
        }
      />
    );
  }

  if (teachers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center space-y-6 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/50 p-16 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2">
        <div className="rounded-full bg-linear-to-b from-zinc-800 to-zinc-900 p-6 ring-1 ring-zinc-700 shadow-xl">
          <GraduationCap className="h-12 w-12 text-zinc-500" />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-semibold text-white">
            Belum ada data user
          </h3>
          <p className="mx-auto max-w-sm text-zinc-500">
            Tambahkan user baru atau ubah filter pencarian untuk melihat data.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            void fetchTeachers();
          }}
          className="mt-4 px-8"
        >
          Refresh Data
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
        {/* 🔍 Filter Hub */}
        <div className="rounded-[2rem] border border-zinc-800/80 bg-zinc-950/40 p-4 shadow-xl backdrop-blur-md md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            {/* Search Bar */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-zinc-500" />
              <Input
                placeholder="Cari nama, email, atau NIP..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setCurrentPage(1);
                }}
                className="h-12 w-full rounded-2xl border-zinc-800 bg-zinc-900/40 pl-12 pr-4 text-sm transition-all focus:border-emerald-500/50 focus:ring-emerald-500/10 placeholder:text-zinc-600"
              />
            </div>

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={roleFilter || "all"}
                onValueChange={(value) => {
                  setRoleFilter(
                    value === "all"
                      ? null
                      : (value as
                          | "super_admin"
                          | "admin"
                          | "teacher"
                          | "staff"),
                  );
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-12 w-[180px] rounded-2xl border-zinc-800 bg-zinc-900/40 text-sm focus:ring-emerald-500/10">
                  <div className="flex items-center gap-2.5">
                    <Filter className="h-4 w-4 text-emerald-400" />
                    <SelectValue placeholder="Semua Role" />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-zinc-800 bg-zinc-900 shadow-2xl">
                  <SelectItem value="all">Semua Role</SelectItem>
                  <SelectItem value="teacher">Guru</SelectItem>
                  <SelectItem value="staff">Staf</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-12 w-12 rounded-2xl border border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                  onClick={() => {
                    void fetchTeachers();
                  }}
                >
                  <RefreshCw
                    className={cn(
                      "h-4.5 w-4.5",
                      loading && "animate-spin text-emerald-400",
                    )}
                  />
                </Button>

                {hasActiveFilter && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSearch("");
                      setRoleFilter(null);
                      setCurrentPage(1);
                    }}
                    className="h-12 rounded-2xl border-zinc-800 bg-zinc-900/40 px-5 text-sm font-bold text-zinc-300 hover:bg-zinc-800"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Reset
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-4 border-t border-zinc-800/50 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
                <Users className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 leading-none mb-1">
                  Database Stats
                </p>
                <p className="text-sm font-medium text-zinc-300">
                  <span className="text-white font-bold">
                    {pagedTeachers.length}
                  </span>{" "}
                  Entitas Ditampilkan
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden h-8 w-px bg-zinc-800 sm:block" />
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-600">
                  Baris
                </span>
                <select
                  id="page-size"
                  value={String(pageSize)}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setCurrentPage(1);
                  }}
                  className="h-9 w-20 rounded-xl border border-zinc-800 bg-black/40 px-3 text-sm font-bold text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                >
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 shadow-2xl">
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader className="bg-zinc-900/50">
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead
                    className="cursor-pointer font-medium text-zinc-400 transition-colors hover:text-white"
                    onClick={() => toggleSort("fullName")}
                  >
                    <div className="flex items-center">
                      Nama <SortIcon column="fullName" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer font-medium text-zinc-400 transition-colors hover:text-white"
                    onClick={() => toggleSort("email")}
                  >
                    <div className="flex items-center">
                      Email <SortIcon column="email" />
                    </div>
                  </TableHead>
                  <TableHead className="font-medium text-zinc-400">
                    Role
                  </TableHead>
                  <TableHead className="font-medium text-zinc-400">
                    Status
                  </TableHead>
                  <TableHead className="font-medium text-zinc-400">
                    Wali Kelas
                  </TableHead>
                  <TableHead className="text-right font-medium text-zinc-400">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedTeachers.map((teacher, index) => (
                  <TableRow
                    key={teacher.id}
                    className="group border-b border-zinc-800 transition-all duration-200 hover:bg-white/5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <TableCell className="py-4 font-semibold text-white">
                      {teacher.fullName}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-zinc-400">
                      {teacher.email}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 shadow-xs",
                          roleColors[teacher.role] ||
                            "bg-zinc-800 text-zinc-400 ring-zinc-700",
                        )}
                      >
                        {roleLabels[teacher.role]}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          teacher.isActive
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-zinc-700/40 text-zinc-300",
                        )}
                      >
                        {teacher.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-zinc-300">
                      {teacher.isHomeroomTeacher ? "Ya" : "Tidak"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <EditTeacherDialog
                          teacher={teacher}
                          onSuccess={fetchTeachers}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 rounded-lg text-zinc-400 hover:bg-blue-400/10 hover:text-blue-400"
                          onClick={() => {
                            setSelectedTeacherForCard(teacher);
                            setIdCardOpen(true);
                          }}
                        >
                          <IdCard className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 rounded-lg text-zinc-400 hover:bg-red-400/10 hover:text-red-400"
                          onClick={() => handleDelete(teacher)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 p-3 md:hidden">
            {pagedTeachers.map((teacher) => (
              <div
                key={teacher.id}
                className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white">
                    {teacher.fullName}
                  </p>
                  <p className="break-all font-mono text-xs text-zinc-400">
                    {teacher.email}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1",
                      roleColors[teacher.role] ||
                        "bg-zinc-800 text-zinc-400 ring-zinc-700",
                    )}
                  >
                    {roleLabels[teacher.role]}
                  </span>
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
                      teacher.isActive
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-zinc-700/40 text-zinc-300",
                    )}
                  >
                    {teacher.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                  <span className="inline-flex rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                    Wali kelas: {teacher.isHomeroomTeacher ? "Ya" : "Tidak"}
                  </span>
                </div>
                <div className="flex items-center justify-end gap-1">
                  <EditTeacherDialog
                    teacher={teacher}
                    onSuccess={fetchTeachers}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 rounded-lg text-zinc-400 hover:bg-blue-400/10 hover:text-blue-400"
                    onClick={() => {
                      setSelectedTeacherForCard(teacher);
                      setIdCardOpen(true);
                    }}
                  >
                    <IdCard className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 rounded-lg text-zinc-400 hover:bg-red-400/10 hover:text-red-400"
                    onClick={() => handleDelete(teacher)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-zinc-400">
            Halaman{" "}
            <span className="font-semibold text-zinc-200">
              {safeCurrentPage}
            </span>{" "}
            dari{" "}
            <span className="font-semibold text-zinc-200">{totalPages}</span>
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage((value) => Math.max(1, value - 1))}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Sebelumnya
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
              disabled={safeCurrentPage >= totalPages}
              onClick={() =>
                setCurrentPage((value) => Math.min(totalPages, value + 1))
              }
            >
              Berikutnya
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={idCardOpen} onOpenChange={setIdCardOpen}>
        <DialogContent className="max-w-2xl border-zinc-900 bg-zinc-950 text-white">
          <DialogHeader>
            <DialogTitle>Preview ID Card</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center py-6">
            {selectedTeacherForCard ? (
              <IDCardView
                name={selectedTeacherForCard.fullName}
                id={selectedTeacherForCard.nip || selectedTeacherForCard.id}
                personRole={selectedTeacherForCard.role}
                address={selectedTeacherForCard.alamat || undefined}
                position={
                  selectedTeacherForCard.role === "teacher"
                    ? "Guru"
                    : selectedTeacherForCard.role === "admin"
                      ? "Administrator"
                      : selectedTeacherForCard.role === "super_admin"
                        ? "Super Admin"
                        : "Staf"
                }
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <DeleteTeacherDialog
        teacher={deleteTeacher}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onSuccess={fetchTeachers}
      />
    </>
  );
}
