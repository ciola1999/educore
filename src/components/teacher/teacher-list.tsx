"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  GraduationCap,
  IdCard,
  Loader2,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { IDCardView } from "../id-card/id-card-view";
import { DeleteTeacherDialog } from "./delete-teacher-dialog";
import { EditTeacherDialog } from "./edit-teacher-dialog";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

export function TeacherList({ refreshToken = 0 }: { refreshToken?: number }) {
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
  } = useTeacherList(refreshToken);

  const [idCardOpen, setIdCardOpen] = useState(false);
  const [selectedTeacherForCard, setSelectedTeacherForCard] =
    useState<Teacher | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);

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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center space-y-6 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/50 p-16 text-center"
      >
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
      </motion.div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-sm text-zinc-300">
            <div className="rounded-lg bg-zinc-900 p-2">
              <Users className="h-4 w-4 text-sky-400" />
            </div>
            <p>
              Menampilkan{" "}
              <span className="font-semibold text-white">
                {pagedTeachers.length}
              </span>{" "}
              dari{" "}
              <span className="font-semibold text-white">
                {teachers.length}
              </span>{" "}
              user
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <label htmlFor="page-size" className="text-zinc-400">
              Baris
            </label>
            <select
              id="page-size"
              value={String(pageSize)}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setCurrentPage(1);
              }}
              className="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-zinc-200"
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void fetchTeachers();
              }}
              className="gap-2 text-zinc-400 hover:text-white"
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4",
                  loading && "animate-spin text-blue-500",
                )}
              />
              Refresh
            </Button>
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
                <AnimatePresence mode="popLayout">
                  {pagedTeachers.map((teacher, index) => (
                    <motion.tr
                      key={teacher.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ delay: index * 0.03 }}
                      className="group border-b border-zinc-800 transition-colors hover:bg-white/5"
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
                    </motion.tr>
                  ))}
                </AnimatePresence>
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
