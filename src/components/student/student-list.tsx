"use client";

import {
  ArrowDownAZ,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileSpreadsheet,
  IdCard,
  Layers3,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  UserRoundPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import type { StudentListItem } from "@/hooks/use-student-list";
import { useStudentList } from "@/hooks/use-student-list";
import { apiGet } from "@/lib/api/request";
import { exportRowsToXlsx } from "@/lib/export/xlsx";
import { outlineButtonStyles } from "@/lib/ui/outline-button-styles";
import { InlineState } from "../common/inline-state";
import { AddStudentDialog } from "./add-student-dialog";
import { BulkCreateStudentAccountsDialog } from "./bulk-create-student-accounts-dialog";
import { BulkRepairStudentClassesDialog } from "./bulk-repair-student-classes-dialog";
import { BulkResetStudentPasswordDialog } from "./bulk-reset-student-password-dialog";
import { CreateStudentAccountDialog } from "./create-student-account-dialog";
import { DeleteStudentDialog } from "./delete-student-dialog";
import { EditStudentDialog } from "./edit-student-dialog";
import { ImportStudentsExcelDialog } from "./import-students-excel-dialog";
import { StudentIdDialog } from "./student-id-dialog";
import { StudentStats } from "./student-stats";

function formatBirthInfo(
  tempatLahir?: string | null,
  tanggalLahir?: string | Date | null,
) {
  const place = tempatLahir?.trim();
  const date = tanggalLahir
    ? new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(tanggalLahir))
    : null;

  if (place && date) return `${place}, ${date}`;
  if (place) return place;
  if (date) return date;
  return "-";
}

function getTodayDateString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

const attendanceBadgeStyle: Record<
  NonNullable<StudentListItem["attendanceToday"]>["status"],
  string
> = {
  present: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  late: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  sick: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300",
  permission: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  alpha: "border-red-500/40 bg-red-500/10 text-red-300",
};

const attendanceLabel: Record<
  NonNullable<StudentListItem["attendanceToday"]>["status"],
  string
> = {
  present: "Hadir",
  late: "Terlambat",
  sick: "Sakit",
  permission: "Izin",
  alpha: "Alpha",
};
const statsSkeletonKeys = [
  "stats-skeleton-1",
  "stats-skeleton-2",
  "stats-skeleton-3",
  "stats-skeleton-4",
];
const cardSkeletonKeys = [
  "card-skeleton-1",
  "card-skeleton-2",
  "card-skeleton-3",
  "card-skeleton-4",
  "card-skeleton-5",
  "card-skeleton-6",
];
const studentOutlineButtonClass = outlineButtonStyles.neutral;
const studentSkyOutlineButtonClass = outlineButtonStyles.sky;
const studentEmeraldOutlineButtonClass = outlineButtonStyles.emerald;
const studentAmberOutlineButtonClass = outlineButtonStyles.amber;
const studentBlueOutlineButtonClass = outlineButtonStyles.blue;
const studentRedOutlineButtonClass = outlineButtonStyles.red;

type StudentListResponse = {
  data: StudentListItem[];
  total: number;
  page: number;
  totalPages: number;
};

function matchesAccountFilter(
  student: StudentListItem,
  accountFilter: "all" | "with_account" | "without_account",
) {
  if (accountFilter === "with_account") {
    return student.hasAccount;
  }
  if (accountFilter === "without_account") {
    return !student.hasAccount;
  }
  return true;
}

function buildStudentExportRows(students: StudentListItem[]) {
  return students.map((student, index) => ({
    No: index + 1,
    NIS: student.nis,
    NISN: student.nisn ?? "",
    "Nama Lengkap": student.fullName,
    "Jenis Kelamin": student.gender === "L" ? "Laki-laki" : "Perempuan",
    Kelas: student.grade,
    "Nama Wali": student.parentName ?? "",
    "No. HP Wali": student.parentPhone ?? "",
    "Tempat, Tanggal Lahir": formatBirthInfo(
      student.tempatLahir,
      student.tanggalLahir,
    ),
    Alamat: student.alamat ?? "",
    "Email Akun": student.accountEmail ?? "",
    "Status Akun": student.hasAccount ? "Aktif" : "Belum Ada Akun",
    "Absensi Hari Ini": student.attendanceToday
      ? `${attendanceLabel[student.attendanceToday.status]} (${student.attendanceToday.source === "qr" ? "QR" : "Manual"})`
      : "Belum Absen",
  }));
}

export function StudentList() {
  const today = getTodayDateString();
  const [selectedStudent, setSelectedStudent] =
    useState<StudentListItem | null>(null);
  const [selectedStudentForCard, setSelectedStudentForCard] =
    useState<StudentListItem | null>(null);
  const [selectedStudentForEdit, setSelectedStudentForEdit] =
    useState<StudentListItem | null>(null);
  const [selectedStudentForDelete, setSelectedStudentForDelete] =
    useState<StudentListItem | null>(null);
  const [selectedStudentForAccount, setSelectedStudentForAccount] =
    useState<StudentListItem | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [idCardOpen, setIdCardOpen] = useState(false);
  const [bulkActionsOpen, setBulkActionsOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [accountFilter, setAccountFilter] = useState<
    "all" | "with_account" | "without_account"
  >("all");
  const { user } = useAuth();
  const isStudentView = user?.role === "student";
  const canManageStudents =
    user?.role === "admin" || user?.role === "super_admin";
  const {
    loading,
    statsLoading,
    searchQuery,
    setSearchQuery,
    currentPage,
    setCurrentPage,
    students,
    totalPages,
    totalCount,
    stats,
    error,
    listError,
    statsError,
    sortBy,
    setSortBy,
    sortDir,
    setSortDir,
    refreshList,
    refreshAll,
  } = useStudentList();

  const visibleStudents = students.filter((student) => {
    if (accountFilter === "with_account") {
      return student.hasAccount;
    }
    if (accountFilter === "without_account") {
      return !student.hasAccount;
    }
    return true;
  });
  const accountSummary = students.reduce(
    (accumulator, student) => {
      if (student.hasAccount) {
        accumulator.withAccount += 1;
      } else {
        accumulator.withoutAccount += 1;
      }
      return accumulator;
    },
    { withAccount: 0, withoutAccount: 0 },
  );

  async function handleExportStudents(scope: "current_page" | "all_filtered") {
    const todayLabel = new Date().toISOString().slice(0, 10);

    if (scope === "current_page" && visibleStudents.length === 0) {
      toast.error("Tidak ada data siswa pada list aktif untuk diexport.");
      return;
    }

    setExporting(true);
    try {
      let exportStudents = visibleStudents;

      if (scope === "all_filtered") {
        const baseParams = new URLSearchParams({
          limit: "50",
          sortBy,
          sortDir,
          includeAttendanceToday: "1",
          date: today,
        });
        if (searchQuery.trim()) {
          baseParams.set("search", searchQuery.trim());
        }

        const firstPage = await apiGet<StudentListResponse>(
          `/api/students?${baseParams.toString()}&page=1`,
        );
        const collected = [...firstPage.data];

        for (let page = 2; page <= firstPage.totalPages; page += 1) {
          const pageResult = await apiGet<StudentListResponse>(
            `/api/students?${baseParams.toString()}&page=${page}`,
          );
          collected.push(...pageResult.data);
        }

        exportStudents = collected.filter((student) =>
          matchesAccountFilter(student, accountFilter),
        );
      }

      if (exportStudents.length === 0) {
        toast.error("Tidak ada data siswa pada scope export yang dipilih.");
        return;
      }

      const exportRows = buildStudentExportRows(exportStudents);
      await exportRowsToXlsx({
        fileName:
          scope === "all_filtered"
            ? `students-${todayLabel}-filtered.xlsx`
            : `students-${todayLabel}-page-${currentPage}.xlsx`,
        sheetName: "Students",
        rows: exportRows,
      });
      setExportDialogOpen(false);
      toast.success(
        scope === "all_filtered"
          ? `${exportRows.length} siswa dari semua hasil filter berhasil diexport ke Excel.`
          : `${exportRows.length} siswa dari halaman aktif berhasil diexport ke Excel.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal export data siswa",
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      {!isStudentView && stats ? (
        <StudentStats
          total={stats.total}
          male={stats.male}
          female={stats.female}
          activeGrades={stats.activeGrades}
        />
      ) : !isStudentView && statsLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statsSkeletonKeys.map((key) => (
            <div
              key={key}
              className="h-28 rounded-2xl border border-zinc-800 bg-zinc-900/40 animate-pulse"
            />
          ))}
        </div>
      ) : null}

      {error ? (
        <InlineState
          title="Data siswa tidak tersedia"
          description={listError ?? statsError ?? error}
          actionLabel="Coba Lagi"
          onAction={() => {
            void refreshAll();
          }}
          variant="error"
        />
      ) : null}

      {isStudentView ? (
        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-5">
          <p className="text-sm font-semibold text-sky-200">Profil Siswa</p>
          <p className="mt-1 text-sm text-sky-100/80">
            Halaman ini menampilkan data identitas siswa yang sedang login dalam
            mode read-only.
          </p>
        </div>
      ) : null}

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
        <div className="flex flex-col gap-6">
          {!isStudentView ? (
            <div className="space-y-3">
              <div className="rounded-[1.75rem] border border-zinc-800/80 bg-zinc-950/50 p-4 md:p-5">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        Filter & Navigasi
                      </p>
                      <h3 className="text-lg font-semibold text-zinc-100">
                        Workspace roster aktif
                      </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <span className="rounded-full border border-zinc-800 bg-zinc-900/70 px-3 py-1">
                        Total list: {totalCount}
                      </span>
                      <span className="rounded-full border border-zinc-800 bg-zinc-900/70 px-3 py-1">
                        Halaman {currentPage}/{totalPages}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
                    <div className="space-y-4">
                      <div className="relative w-full xl:max-w-xl">
                        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(event) => {
                            setSearchQuery(event.target.value);
                            setCurrentPage(1);
                          }}
                          placeholder="Cari nama, NIS, kelas..."
                          className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 py-3 pl-11 pr-4 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-all shadow-inner focus:ring-2 focus:ring-sky-500/20"
                        />
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:justify-between">
                        <Select
                          value={accountFilter}
                          onValueChange={(value) =>
                            setAccountFilter(
                              value as
                                | "all"
                                | "with_account"
                                | "without_account",
                            )
                          }
                        >
                          <SelectTrigger className="w-full rounded-2xl border-zinc-800 bg-zinc-950 text-zinc-200 sm:flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                            <SelectItem value="all">Semua Akun</SelectItem>
                            <SelectItem value="with_account">
                              Sudah Punya Akun
                            </SelectItem>
                            <SelectItem value="without_account">
                              Belum Punya Akun
                            </SelectItem>
                          </SelectContent>
                        </Select>

                        <Select
                          value={sortBy}
                          onValueChange={(value) => {
                            setSortBy(value);
                            setCurrentPage(1);
                          }}
                        >
                          <SelectTrigger className="w-full rounded-2xl border-zinc-800 bg-zinc-950 text-zinc-200 sm:flex-1">
                            <ArrowDownAZ className="mr-2 h-4 w-4 text-zinc-500" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                            <SelectItem value="createdAt">Terbaru</SelectItem>
                            <SelectItem value="fullName">Nama</SelectItem>
                            <SelectItem value="nis">NIS</SelectItem>
                            <SelectItem value="grade">Kelas</SelectItem>
                          </SelectContent>
                        </Select>

                        <Select
                          value={sortDir}
                          onValueChange={(value) => {
                            setSortDir(value as "asc" | "desc");
                            setCurrentPage(1);
                          }}
                        >
                          <SelectTrigger className="w-full rounded-2xl border-zinc-800 bg-zinc-950 text-zinc-200 sm:flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                            <SelectItem value="desc">Desc</SelectItem>
                            <SelectItem value="asc">Asc</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex w-full flex-wrap items-center gap-3 xl:w-auto xl:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          void refreshAll();
                        }}
                        className={`flex-1 transition-colors sm:flex-none ${studentOutlineButtonClass}`}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                      </Button>
                      {canManageStudents ? (
                        <div className="flex-1 sm:flex-none">
                          <AddStudentDialog
                            onSuccess={() => {
                              void refreshAll();
                            }}
                          />
                        </div>
                      ) : null}
                      {canManageStudents ? (
                        <div className="flex-1 sm:flex-none">
                          <ImportStudentsExcelDialog
                            onSuccess={() => {
                              void refreshAll();
                            }}
                          />
                        </div>
                      ) : null}
                      {!isStudentView ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setExportDialogOpen(true);
                          }}
                          className={`flex-1 sm:flex-none ${studentEmeraldOutlineButtonClass}`}
                        >
                          <FileSpreadsheet className="mr-2 h-4 w-4" />
                          Export Excel
                        </Button>
                      ) : null}
                      {canManageStudents ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setBulkActionsOpen((open) => !open)}
                          className={`flex-1 transition-colors sm:flex-none ${studentOutlineButtonClass}`}
                        >
                          <Layers3 className="mr-2 h-4 w-4" />
                          {bulkActionsOpen
                            ? "Tutup Aksi Massal"
                            : "Aksi Massal"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              {canManageStudents && bulkActionsOpen ? (
                <div className="border-t border-zinc-800 pt-4">
                  <div className="mx-auto grid max-w-[660px] gap-3 rounded-[1.5rem] border border-zinc-800 bg-zinc-950/40 p-3 sm:grid-cols-2 xl:grid-cols-3">
                    <div className="w-full min-w-0 [&_button]:w-full">
                      <BulkCreateStudentAccountsDialog
                        students={students}
                        visibleStudents={visibleStudents}
                        onSuccess={() => {
                          void refreshList();
                        }}
                      />
                    </div>
                    <div className="w-full min-w-0 [&_button]:w-full">
                      <BulkRepairStudentClassesDialog
                        students={students}
                        onSuccess={() => {
                          void refreshAll();
                        }}
                      />
                    </div>
                    <div className="w-full min-w-0 [&_button]:w-full">
                      <BulkResetStudentPasswordDialog
                        students={students}
                        visibleStudents={visibleStudents}
                        onSuccess={() => {
                          void refreshList();
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-[1.5rem] border border-zinc-800/80 bg-zinc-950/50 p-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void refreshAll();
                }}
                className={`transition-colors ${studentOutlineButtonClass}`}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-[1.5rem] border border-zinc-800/70 bg-zinc-950/40 p-4 text-sm text-zinc-500 md:flex-row md:items-center md:justify-between">
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {totalCount} {isStudentView ? "profil" : "siswa"}
          </span>
          {!isStudentView ? (
            <span className="inline-flex items-center gap-2">
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                Akun Aktif: {accountSummary.withAccount}
              </span>
              <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-300">
                Belum Ada Akun: {accountSummary.withoutAccount}
              </span>
            </span>
          ) : null}
          {!isStudentView ? (
            <span>
              Halaman {currentPage} dari {totalPages}
            </span>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cardSkeletonKeys.map((key) => (
            <div
              key={key}
              className="h-48 rounded-2xl border border-zinc-800 bg-zinc-900/40 animate-pulse"
            />
          ))}
        </div>
      ) : visibleStudents.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleStudents.map((student) => (
            <article
              key={student.id}
              className="group rounded-[1.75rem] border border-zinc-800 bg-linear-to-br from-zinc-900/60 via-zinc-900/40 to-zinc-950/70 p-5 transition-all hover:-translate-y-0.5 hover:border-zinc-700 hover:shadow-[0_25px_60px_-40px_rgba(14,165,233,0.45)]"
            >
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="font-mono text-xs font-semibold text-sky-300">
                    {student.nis}
                    {student.nisn ? ` • NISN ${student.nisn}` : ""}
                  </p>
                  <h3 className="text-lg font-semibold text-zinc-100">
                    {student.fullName}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-400">
                    <span>{student.grade}</span>
                    {student.accountEmail ? (
                      <span className="rounded-full border border-zinc-700 bg-zinc-800/50 px-2.5 py-0.5 text-[11px] text-zinc-200">
                        {student.accountEmail}
                      </span>
                    ) : null}
                    <span
                      className={
                        student.hasAccount
                          ? "inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300"
                          : "inline-flex items-center rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-red-300"
                      }
                    >
                      {student.hasAccount ? "Akun Aktif" : "Belum Ada Akun"}
                    </span>
                    {student.attendanceToday ? (
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${attendanceBadgeStyle[student.attendanceToday.status]}`}
                      >
                        {attendanceLabel[student.attendanceToday.status]}
                        {" • "}
                        {student.attendanceToday.source === "qr"
                          ? "QR"
                          : "Manual"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-800/40 px-2.5 py-0.5 text-[11px] text-zinc-300">
                        Belum Absen Hari Ini
                      </span>
                    )}
                  </div>
                </div>

                <dl className="space-y-2 rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">Gender</dt>
                    <dd className="text-zinc-200">
                      {student.gender === "L" ? "Laki-laki" : "Perempuan"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">TTL</dt>
                    <dd className="text-right text-zinc-200">
                      {formatBirthInfo(
                        student.tempatLahir,
                        student.tanggalLahir,
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">Wali</dt>
                    <dd className="text-right text-zinc-200">
                      {student.parentName || "-"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">No. Wali</dt>
                    <dd className="text-right text-zinc-200">
                      {student.parentPhone || "-"}
                    </dd>
                  </div>
                </dl>

                {student.alamat ? (
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3 text-sm text-zinc-400">
                    {student.alamat}
                  </div>
                ) : null}

                <div className="border-t border-zinc-800/80 pt-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setSelectedStudentForCard(student);
                        setIdCardOpen(true);
                      }}
                      className={studentBlueOutlineButtonClass}
                    >
                      <IdCard className="mr-2 h-4 w-4" />
                      Cetak Kartu
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSelectedStudent(student)}
                      className={studentOutlineButtonClass}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Detail
                    </Button>
                    <Button
                      asChild
                      type="button"
                      variant="outline"
                      className={studentSkyOutlineButtonClass}
                    >
                      <Link
                        href={`/dashboard/attendance?tab=history&studentId=${encodeURIComponent(student.id)}&className=${encodeURIComponent(student.grade)}&startDate=${today}&endDate=${today}`}
                      >
                        Lihat Absensi
                      </Link>
                    </Button>
                    {canManageStudents ? (
                      <Button
                        type="button"
                        variant="outline"
                        className={studentAmberOutlineButtonClass}
                        onClick={() => {
                          setSelectedStudentForEdit(student);
                          setEditOpen(true);
                        }}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                    ) : null}
                    {canManageStudents && !student.hasAccount ? (
                      <Button
                        type="button"
                        variant="outline"
                        className={studentEmeraldOutlineButtonClass}
                        onClick={() => {
                          setSelectedStudentForAccount(student);
                          setAccountOpen(true);
                        }}
                      >
                        <UserRoundPlus className="mr-2 h-4 w-4" />
                        Buat Akun
                      </Button>
                    ) : null}
                    {canManageStudents ? (
                      <Button
                        type="button"
                        variant="outline"
                        className={studentRedOutlineButtonClass}
                        onClick={() => {
                          setSelectedStudentForDelete(student);
                          setDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Hapus
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <InlineState
          title="Belum ada data siswa"
          description="Data roster siswa belum tersedia untuk filter saat ini."
          variant="info"
        />
      )}

      {!isStudentView && totalPages > 1 ? (
        <div className="flex flex-col gap-3 rounded-[1.5rem] border border-zinc-800 bg-zinc-900/40 p-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-zinc-500">
            Menampilkan halaman {currentPage} dari {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={currentPage === 1}
              onClick={() => {
                const nextPage = Math.max(1, currentPage - 1);
                setCurrentPage(nextPage);
              }}
              className={studentOutlineButtonClass}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={currentPage === totalPages}
              onClick={() => {
                const nextPage = Math.min(totalPages, currentPage + 1);
                setCurrentPage(nextPage);
              }}
              className={studentOutlineButtonClass}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog
        open={selectedStudent !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedStudent(null);
          }
        }}
      >
        <DialogContent className="flex max-h-[min(42rem,calc(100dvh-4rem))] w-[calc(100vw-1rem)] flex-col overflow-hidden border-zinc-800 bg-zinc-950 p-0 text-zinc-100 sm:max-w-xl">
          <DialogHeader className="shrink-0 px-6 pt-6">
            <DialogTitle>
              {selectedStudent?.fullName || "Detail Siswa"}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Detail data diri siswa.
            </DialogDescription>
          </DialogHeader>

          {selectedStudent ? (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  ["NIS", selectedStudent.nis],
                  ["NISN", selectedStudent.nisn || "-"],
                  ["Kelas", selectedStudent.grade],
                  ["Email Login", selectedStudent.accountEmail || "-"],
                  [
                    "Password Login",
                    selectedStudent.hasAccount
                      ? "Tersimpan aman (hash), gunakan reset password untuk mengganti."
                      : "-",
                  ],
                  [
                    "Gender",
                    selectedStudent.gender === "L" ? "Laki-laki" : "Perempuan",
                  ],
                  [
                    "TTL",
                    formatBirthInfo(
                      selectedStudent.tempatLahir,
                      selectedStudent.tanggalLahir,
                    ),
                  ],
                  ["Nama Wali", selectedStudent.parentName || "-"],
                  ["No. Wali", selectedStudent.parentPhone || "-"],
                  [
                    "Status Akun",
                    selectedStudent.hasAccount
                      ? "Sudah ada akun"
                      : "Belum ada akun",
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4"
                  >
                    <p className="text-xs uppercase tracking-wide text-zinc-500">
                      {label}
                    </p>
                    <p className="mt-2 text-sm text-zinc-100">{value}</p>
                  </div>
                ))}

                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 md:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    Alamat
                  </p>
                  <p className="mt-2 text-sm text-zinc-300">
                    {selectedStudent.alamat || "-"}
                  </p>
                </div>
              </div>

              <div className="flex justify-end border-t border-zinc-800 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSelectedStudentForCard(selectedStudent);
                    setIdCardOpen(true);
                  }}
                  className={studentBlueOutlineButtonClass}
                >
                  <IdCard className="mr-2 h-4 w-4" />
                  Cetak Kartu
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <StudentIdDialog
        open={idCardOpen}
        onOpenChange={setIdCardOpen}
        student={selectedStudentForCard}
      />

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="border-zinc-800 bg-zinc-950 text-zinc-100 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Export Excel Students</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Pilih scope export yang ingin dipakai untuk data siswa.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-300">
              <p className="font-medium text-zinc-100">Halaman aktif</p>
              <p className="mt-1 text-zinc-400">
                Export hanya data yang sedang tampil di halaman ini.
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                Estimasi: {visibleStudents.length} siswa
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-300">
              <p className="font-medium text-zinc-100">Semua hasil filter</p>
              <p className="mt-1 text-zinc-400">
                Export semua data yang cocok dengan search, sort, dan filter
                akun aktif saat ini lintas halaman.
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                Estimasi awal: hingga {totalCount} siswa sebelum filter akun
                lokal diterapkan
              </p>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setExportDialogOpen(false)}
              className={studentOutlineButtonClass}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={exporting}
              onClick={() => {
                void handleExportStudents("current_page");
              }}
              className={studentEmeraldOutlineButtonClass}
            >
              {exporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-2 h-4 w-4" />
              )}
              Export Halaman Aktif
            </Button>
            <Button
              type="button"
              disabled={exporting}
              onClick={() => {
                void handleExportStudents("all_filtered");
              }}
            >
              {exporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-2 h-4 w-4" />
              )}
              Export Semua Filter
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <EditStudentDialog
        student={selectedStudentForEdit}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={() => {
          void refreshAll();
        }}
      />

      <DeleteStudentDialog
        student={selectedStudentForDelete}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onSuccess={() => {
          void refreshAll();
        }}
      />

      <CreateStudentAccountDialog
        student={selectedStudentForAccount}
        open={accountOpen}
        onOpenChange={setAccountOpen}
        onSuccess={() => {
          void refreshList();
        }}
      />
    </div>
  );
}
