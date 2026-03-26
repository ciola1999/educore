"use client";

import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  LayoutList,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isTauri } from "@/core/env";
import { useAttendanceForm } from "@/hooks/use-attendance-form";
import type { AttendanceStatus } from "@/lib/validations/schemas";
import { InlineState } from "../common/inline-state";

type AttendanceFormProps = {
  initialClassId?: string;
  initialClassName?: string;
  initialDate?: string;
};

function AttendanceStudentSkeleton() {
  const skeletonItems = ["alpha", "beta", "gamma"] as const;

  return (
    <div className="grid gap-3" aria-hidden="true">
      {skeletonItems.map((item) => (
        <div
          key={item}
          className="rounded-2xl border border-zinc-800/60 bg-linear-to-br from-zinc-900/55 to-zinc-950/75 p-4 shadow-sm shadow-black/10"
        >
          <div className="animate-pulse space-y-4">
            <div className="flex items-start gap-4">
              <div className="h-8 w-8 rounded-full bg-zinc-800/90" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 rounded-full bg-sky-500/20" />
                <div className="h-4 w-40 rounded-full bg-zinc-800/90" />
                <div className="h-3 w-52 rounded-full bg-zinc-900" />
              </div>
              <div className="h-10 w-36 rounded-xl bg-zinc-900" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div className="h-9 rounded-lg bg-zinc-900" />
              <div className="h-9 rounded-lg bg-zinc-900" />
              <div className="h-9 rounded-lg bg-zinc-900" />
              <div className="h-9 rounded-lg bg-zinc-900" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const attendanceStatusOptions = [
  { id: "present", shortLabel: "P", label: "Hadir", tone: "emerald" },
  { id: "sick", shortLabel: "S", label: "Sakit", tone: "amber" },
  { id: "permission", shortLabel: "I", label: "Izin", tone: "sky" },
  { id: "alpha", shortLabel: "A", label: "Alpha", tone: "red" },
] as const satisfies ReadonlyArray<{
  id: AttendanceStatus;
  shortLabel: string;
  label: string;
  tone: "emerald" | "amber" | "sky" | "red";
}>;

export function AttendanceForm({
  initialClassId,
  initialClassName,
  initialDate,
}: AttendanceFormProps) {
  const [viewMode, setViewMode] = useState<"compact" | "detailed">("detailed");
  const [exportFilter, setExportFilter] = useState<AttendanceStatus | "all">(
    "all",
  );
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const attendance = useAttendanceForm({
    initialClassId,
    initialClassName,
    initialDate,
  });
  const {
    isMounted,
    loading,
    submitting,
    classLoadError,
    studentLoadError,
    submitSummary,
    studentList,
    paginatedStudentList,
    currentPage,
    setCurrentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    searchQuery,
    setSearchQuery,
    selectedDate,
    setSelectedDate,
    selectedClass,
    setSelectedClass,
    classList,
    updateStatus,
    setAllPresent,
    handleSubmit,
    loadClasses,
    refreshStudents,
  } = attendance;

  if (!isMounted) return null;

  if (loading && classList.length === 0) {
    return (
      <div className="flex justify-center items-center py-20 text-zinc-500">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const statusColors: Record<AttendanceStatus, string> = {
    present: "bg-emerald-600 hover:bg-emerald-500",
    sick: "bg-yellow-600 hover:bg-yellow-500",
    permission: "bg-blue-600 hover:bg-blue-500",
    alpha: "bg-red-600 hover:bg-red-500",
  };

  const statusFullLabels: Record<AttendanceStatus, string> = {
    present: "Hadir",
    sick: "Sakit",
    permission: "Izin",
    alpha: "Alpha",
  };

  const formatBirthInfo = (
    tempatLahir?: string | null,
    tanggalLahir?: Date | null,
  ) => {
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
  };

  const getFilteredStudentsForExport = () => {
    if (exportFilter === "all") {
      return studentList;
    }

    return studentList.filter((student) => student.status === exportFilter);
  };

  const getExportRows = () => {
    const className =
      classList.find((classItem) => classItem.id === selectedClass)?.name ||
      "unknown-class";

    const filteredStudents = getFilteredStudentsForExport();

    return {
      className,
      rows: filteredStudents.map((student) => ({
        Tanggal: selectedDate,
        Kelas: className,
        NIS: student.nis,
        NISN: student.nisn || "",
        Nama: student.fullName,
        "Tempat/Tgl Lahir": formatBirthInfo(
          student.tempatLahir,
          student.tanggalLahir,
        ),
        "Nama Wali": student.parentName || "",
        "No HP Wali": student.parentPhone || "",
        Alamat: student.alamat || "",
        Status: student.status,
        Catatan: student.notes || "",
      })),
    };
  };

  const handleExportXlsx = async () => {
    if (!selectedClass || studentList.length === 0) {
      toast.error("Belum ada data siswa untuk diekspor");
      return;
    }

    const { className, rows } = getExportRows();
    if (rows.length === 0) {
      toast.error("Tidak ada data sesuai filter export");
      return;
    }

    setIsExporting(true);
    try {
      const XLSX = await import("xlsx");
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");

      const filterLabel = exportFilter === "all" ? "all" : exportFilter;
      const fileName = `attendance-${className}-${selectedDate}-${filterLabel}.xlsx`;

      // Check for Tauri
      if (isTauri()) {
        try {
          const { save } = await import("@tauri-apps/plugin-dialog");
          const { writeFile } = await import("@tauri-apps/plugin-fs");

          // Convert to buffer
          const excelBuffer = XLSX.write(workbook, {
            bookType: "xlsx",
            type: "array",
          });

          const filePath = await save({
            filters: [{ name: "Excel", extensions: ["xlsx"] }],
            defaultPath: fileName,
          });

          if (filePath) {
            await writeFile(
              filePath,
              new Uint8Array(excelBuffer as ArrayBuffer),
            );
            toast.success("Laporan Excel berhasil disimpan!");
            setShowExportDialog(false);
            return;
          }
          return;
        } catch (tauriError) {
          console.error("❌ Tauri export error:", tauriError);
          // Gunakan unduhan browser jika jalur khusus Tauri gagal
        }
      }

      // Jalur unduhan browser untuk mode web atau fallback runtime
      XLSX.writeFile(workbook, fileName);
      toast.success("Laporan Excel berhasil diekspor");
      setShowExportDialog(false);
    } catch (error) {
      console.error("❌ Export XLSX gagal:", error);
      toast.error("Gagal export Excel");
    } finally {
      setIsExporting(false);
    }
  };

  const attendanceSummary = studentList.reduce(
    (accumulator, student) => {
      if (student.status === "present") accumulator.present += 1;
      if (student.status === "sick") accumulator.sick += 1;
      if (student.status === "permission") accumulator.permission += 1;
      if (student.status === "alpha") accumulator.alpha += 1;
      if (student.isLocked) accumulator.locked += 1;
      return accumulator;
    },
    {
      present: 0,
      sick: 0,
      permission: 0,
      alpha: 0,
      locked: 0,
    },
  );

  const selectedClassName =
    classList.find((classItem) => classItem.id === selectedClass)?.name || "-";
  const actionButtonBase =
    "group h-11 rounded-xl px-4 !text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:!text-white hover:shadow-md disabled:border-zinc-700 disabled:!from-zinc-800 disabled:!to-zinc-800 disabled:!text-zinc-300";
  const panelShellClass =
    "relative overflow-hidden rounded-[1.75rem] border border-zinc-800/90 bg-linear-to-br from-zinc-950/78 via-zinc-950/66 to-zinc-900/42 p-5 shadow-xl shadow-black/15 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-linear-to-r before:from-transparent before:via-white/12 before:to-transparent";
  const softPanelClass =
    "rounded-2xl border border-zinc-800 bg-linear-to-br from-zinc-900/65 to-zinc-950/75 shadow-sm shadow-black/10";
  const filteredStudentCount = paginatedStudentList.length;
  const hasSearchQuery = searchQuery.trim().length > 0;
  const submitSummaryVariant =
    submitSummary?.tone === "success" ? "info" : submitSummary?.tone;

  return (
    <div className="space-y-6">
      {classLoadError ? (
        <InlineState
          title="Kelas attendance tidak tersedia"
          description={classLoadError}
          actionLabel="Coba Lagi"
          onAction={() => {
            void loadClasses();
          }}
          variant={
            classLoadError.includes("izin") || classLoadError.includes("login")
              ? "warning"
              : "error"
          }
        />
      ) : null}

      {studentLoadError && selectedClass ? (
        <InlineState
          title="Data siswa attendance tidak tersedia"
          description={studentLoadError}
          actionLabel="Coba Lagi"
          onAction={refreshStudents}
          variant={
            studentLoadError.includes("izin") ||
            studentLoadError.includes("login")
              ? "warning"
              : "error"
          }
        />
      ) : null}

      {/* Controls */}
      <div className={`flex flex-col gap-4 ${panelShellClass}`}>
        <div className="flex flex-col gap-3 border-b border-zinc-800/60 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">
              Kontrol Manual
            </p>
            <h3 className="mt-2 text-lg font-semibold tracking-tight text-zinc-100">
              Input Attendance per Kelas
            </h3>
            <p className="mt-1 text-sm text-zinc-400">
              Sinkronkan filter, aksi massal, dan ekspor dari satu toolbar yang
              konsisten.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { label: "Tanggal Aktif", value: selectedDate },
              { label: "Kelas", value: selectedClassName },
              { label: "Total Siswa", value: String(studentList.length) },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-zinc-800/80 bg-zinc-950/65 px-4 py-3 text-xs text-zinc-500 shadow-sm shadow-black/10"
              >
                <p className="uppercase tracking-[0.16em]">{item.label}</p>
                <p className="mt-2 text-sm font-semibold text-zinc-100">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
        {/* Row 1: Primary Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-xl border border-sky-500/20 bg-linear-to-br from-sky-500/12 to-sky-500/5 p-2.5 shadow-sm shadow-sky-950/20">
              <CalendarDays className="h-5 w-5 text-sky-300" />
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full rounded-xl border border-zinc-700/80 bg-zinc-950/90 px-4 py-2.5 text-sm font-medium text-zinc-100 shadow-sm shadow-black/10 transition-all duration-200 hover:border-sky-500/30 focus:border-sky-400/60 focus:ring-2 focus:ring-sky-500/25"
            />
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full cursor-pointer rounded-xl border border-zinc-700/80 bg-zinc-950/90 px-4 py-2.5 text-sm font-medium text-zinc-100 shadow-sm shadow-black/10 transition-all duration-200 hover:border-sky-500/30 focus:border-sky-400/60 focus:ring-2 focus:ring-sky-500/25"
            >
              <option value="" disabled>
                Pilih Kelas
              </option>
              {classList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-zinc-500 transition-colors duration-200" />
            <input
              type="text"
              placeholder="Cari siswa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-zinc-700/80 bg-zinc-950/90 py-2.5 pr-4 pl-11 text-sm text-zinc-100 shadow-sm shadow-black/10 transition-all duration-200 placeholder:text-zinc-600 hover:border-sky-500/30 focus:border-sky-400/60 focus:ring-2 focus:ring-sky-500/25"
            />
          </div>
        </div>

        {/* Row 2: Actions */}
        <div className="flex flex-col gap-3 border-t border-zinc-800/50 pt-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:flex xl:w-auto xl:flex-wrap xl:items-center">
            <Button
              onClick={refreshStudents}
              variant="default"
              className={`${actionButtonBase} w-full border border-sky-400/60 !bg-linear-to-br !from-sky-700 !to-cyan-600 shadow-sky-950/35 hover:border-sky-300/80 hover:!from-sky-600 hover:!to-cyan-500 hover:shadow-sky-950/45 sm:w-auto`}
              title="Muat ulang siswa"
            >
              <RefreshCw className="mr-2 h-4 w-4 !text-sky-100 transition-transform duration-500 group-hover:rotate-90 group-active:rotate-180" />
              <span className="!text-white">Muat Ulang</span>
            </Button>

            <Button
              onClick={() => setShowExportDialog(true)}
              variant="default"
              className={`${actionButtonBase} w-full border border-emerald-400/60 !bg-linear-to-br !from-emerald-700 !to-emerald-600 shadow-emerald-950/35 hover:border-emerald-300/80 hover:!from-emerald-600 hover:!to-emerald-500 hover:shadow-emerald-950/45 sm:w-auto`}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4 !text-emerald-100 transition-transform duration-200 group-hover:scale-110" />{" "}
              <span className="!text-white">Ekspor XLSX</span>
            </Button>

            <Button
              onClick={() =>
                setViewMode((prevMode) =>
                  prevMode === "detailed" ? "compact" : "detailed",
                )
              }
              aria-pressed={viewMode === "compact"}
              variant="default"
              className={`${actionButtonBase} w-full border border-violet-400/60 !bg-linear-to-br !from-violet-700 !to-fuchsia-600 shadow-violet-950/35 hover:border-violet-300/80 hover:!from-violet-600 hover:!to-fuchsia-500 hover:shadow-violet-950/45 sm:w-auto`}
            >
              <LayoutList className="mr-2 h-4 w-4 !text-violet-100 transition-transform duration-200 group-hover:scale-110" />
              <span className="!text-white">
                {viewMode === "detailed" ? "Mode Ringkas" : "Mode Detail"}
              </span>
            </Button>
          </div>

          <Button
            onClick={setAllPresent}
            variant="default"
            className={`${actionButtonBase} w-full border border-blue-400/60 !bg-linear-to-br !from-blue-700 !to-cyan-600 px-5 font-semibold shadow-blue-950/35 hover:border-blue-300/80 hover:!from-blue-600 hover:!to-cyan-500 hover:shadow-blue-950/45 sm:w-auto`}
          >
            <Check className="mr-2 h-4 w-4 !text-blue-50 transition-transform duration-200 group-hover:scale-110" />{" "}
            <span className="!text-white">Tandai Semua Hadir</span>
          </Button>
        </div>
      </div>

      {classList.length === 0 && (
        <div className="text-center py-20 text-zinc-500 bg-zinc-900/30 rounded-2xl border border-dashed border-zinc-800">
          <p className="mb-2 italic">Belum ada kelas yang tersedia.</p>
          <p className="text-sm">
            Tambahkan kelas terlebih dahulu di menu{" "}
            <span className="text-blue-400 hover:underline cursor-pointer">
              Courses
            </span>{" "}
            .
          </p>
        </div>
      )}

      {classList.length > 0 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              {
                label: "Kelas Aktif",
                value: selectedClassName,
                tone: "text-sky-300 border-sky-500/20 bg-sky-500/5",
              },
              {
                label: "Hadir",
                value: attendanceSummary.present,
                tone: "text-emerald-300 border-emerald-500/20 bg-emerald-500/5",
              },
              {
                label: "Sakit / Izin",
                value: attendanceSummary.sick + attendanceSummary.permission,
                tone: "text-amber-300 border-amber-500/20 bg-amber-500/5",
              },
              {
                label: "Alpha",
                value: attendanceSummary.alpha,
                tone: "text-red-300 border-red-500/20 bg-red-500/5",
              },
              {
                label: "QR Terkunci",
                value: attendanceSummary.locked,
                tone: "text-indigo-300 border-indigo-500/20 bg-indigo-500/5",
              },
            ].map((item) => (
              <div
                key={item.label}
                className={`${softPanelClass} p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${item.tone}`}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">
                  {item.label}
                </p>
                <p className="mt-3 text-2xl font-semibold tracking-tight">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 px-1">
            <span className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.35)]"></span>
              Hadir
            </span>
            <span className="flex items-center gap-2 rounded-full border border-yellow-500/20 bg-yellow-500/8 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-yellow-100">
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.35)]"></span>
              Sakit
            </span>
            <span className="flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/8 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-100">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.35)]"></span>
              Izin
            </span>
            <span className="flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/8 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-red-100">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.35)]"></span>
              Alpha
            </span>
          </div>

          {/* Student List */}
          <div className={`${panelShellClass} gap-4`}>
            <div className="flex flex-col gap-3 border-b border-zinc-800/60 pb-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">
                  Antrean Siswa
                </p>
                <h3 className="mt-2 text-lg font-semibold tracking-tight text-zinc-100">
                  Daftar Siswa untuk Input Manual
                </h3>
                <p className="mt-1 text-sm text-zinc-400">
                  Review status, verifikasi QR lock, lalu simpan attendance per
                  kelas.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  {
                    label: "Halaman",
                    value: `${currentPage}/${totalPages || 1}`,
                  },
                  { label: "Tampil", value: String(filteredStudentCount) },
                  {
                    label: "Cari",
                    value: hasSearchQuery ? "Filter aktif" : "Semua siswa",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-zinc-800/80 bg-zinc-950/65 px-4 py-3 text-xs text-zinc-500 shadow-sm shadow-black/10"
                  >
                    <p className="uppercase tracking-[0.16em]">{item.label}</p>
                    <p className="mt-2 text-sm font-semibold text-zinc-100">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="rounded-3xl border border-dashed border-zinc-800/80 bg-zinc-950/35 p-3">
                <AttendanceStudentSkeleton />
              </div>
            ) : (
              <div className="grid gap-3">
                {paginatedStudentList.map((student, idx) => {
                  const globalIdx = (currentPage - 1) * itemsPerPage + idx;
                  return (
                    <div
                      key={student.id}
                      className="group flex flex-col gap-4 rounded-2xl border border-zinc-800/60 bg-linear-to-br from-zinc-900/55 to-zinc-950/75 p-4 shadow-sm shadow-black/10 transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-700 hover:from-zinc-800/65 hover:to-zinc-900/80 hover:shadow-md hover:shadow-black/20 sm:flex-row sm:items-center"
                    >
                      <div className="flex shrink-0 items-center gap-4 px-1">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950/70 text-center font-mono text-[10px] font-bold text-zinc-500">
                          {(globalIdx + 1).toString().padStart(2, "0")}
                        </span>
                      </div>
                      <div className="flex flex-col flex-1">
                        <span className="mb-1 font-mono text-xs font-semibold tracking-wide text-sky-300">
                          {student.nis}
                          {student.nisn ? ` • NISN ${student.nisn}` : ""}
                        </span>
                        <span className="font-medium tracking-tight text-zinc-50">
                          {student.fullName}
                        </span>
                        {viewMode === "detailed" ? (
                          <>
                            <span className="text-[11px] text-zinc-400">
                              {formatBirthInfo(
                                student.tempatLahir,
                                student.tanggalLahir,
                              )}
                            </span>
                            <span className="text-[11px] text-zinc-400">
                              {student.parentName || "-"}
                              {student.parentPhone
                                ? ` • ${student.parentPhone}`
                                : ""}
                            </span>
                            {student.alamat ? (
                              <span className="line-clamp-1 max-w-[300px] text-[11px] text-zinc-500">
                                {student.alamat}
                              </span>
                            ) : null}
                          </>
                        ) : null}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        {student.isLocked && (
                          <div className="flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-blue-500/20 bg-linear-to-br from-blue-500/10 to-cyan-500/5 px-3 py-2 shadow-sm shadow-blue-950/20">
                            <span className="rounded-full border border-blue-400/20 bg-blue-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-200">
                              QR Tersinkron Otomatis
                            </span>
                            <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                              {student.checkInTime && (
                                <span title="Masuk">
                                  In:{" "}
                                  {new Date(
                                    student.checkInTime,
                                  ).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              )}
                              {student.checkOutTime && (
                                <span title="Pulang">
                                  Out:{" "}
                                  {new Date(
                                    student.checkOutTime,
                                  ).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center justify-between sm:justify-end gap-2 border-t sm:border-t-0 border-zinc-800/50 pt-3 sm:pt-0">
                          <span className="sm:hidden text-xs text-zinc-500 font-medium">
                            Status:
                          </span>
                          <div className="flex flex-col items-end gap-2">
                            <div className="rounded-full border border-zinc-800 bg-zinc-950/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400 shadow-sm shadow-black/10">
                              Status aktif: {statusFullLabels[student.status]}
                            </div>
                            <div
                              className={`grid grid-cols-2 gap-1.5 rounded-2xl border border-zinc-800 bg-zinc-950/65 p-1.5 shadow-inner sm:grid-cols-4 ${student.isLocked ? "opacity-60 grayscale" : ""}`}
                            >
                              {attendanceStatusOptions.map((statusOption) => {
                                const isActive =
                                  student.status === statusOption.id;

                                return (
                                  <button
                                    key={statusOption.id}
                                    type="button"
                                    disabled={student.isLocked}
                                    onClick={() =>
                                      updateStatus(student.id, statusOption.id)
                                    }
                                    title={statusOption.label}
                                    aria-pressed={isActive}
                                    className={`min-w-[72px] rounded-xl px-3 py-2 text-left text-xs font-semibold transition-all duration-200 sm:min-w-[66px] ${
                                      isActive
                                        ? `${statusColors[statusOption.id]} scale-[1.02] text-white shadow-lg ring-1 ring-white/10`
                                        : "bg-transparent text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                                    } ${student.isLocked ? "cursor-not-allowed" : ""}`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[11px] font-bold">
                                        {statusOption.shortLabel}
                                      </span>
                                      {isActive ? (
                                        <span className="h-2 w-2 rounded-full bg-white/90 shadow-[0_0_10px_rgba(255,255,255,0.45)]" />
                                      ) : null}
                                    </div>
                                    <p className="mt-1 text-[10px] uppercase tracking-[0.14em] opacity-80">
                                      {statusOption.label}
                                    </p>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="rounded-[1.6rem] border border-zinc-800/80 bg-linear-to-br from-zinc-950/70 to-zinc-900/35 p-4 shadow-sm shadow-black/10">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">
                    Kontrol Halaman
                  </p>
                  <div className="rounded-full border border-zinc-800 bg-zinc-950/60 px-4 py-2 text-sm text-zinc-400 shadow-sm shadow-black/10">
                    Menampilkan{" "}
                    <span className="font-medium text-zinc-200">
                      {(currentPage - 1) * itemsPerPage + 1}
                    </span>{" "}
                    sampai{" "}
                    <span className="font-medium text-zinc-200">
                      {Math.min(currentPage * itemsPerPage, totalItems)}
                    </span>{" "}
                    dari{" "}
                    <span className="font-medium text-zinc-200">
                      {totalItems}
                    </span>{" "}
                    siswa
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-xl border-zinc-800 bg-zinc-900/90 text-zinc-300 shadow-sm shadow-black/10 transition-all hover:-translate-y-0.5 hover:border-zinc-700 hover:bg-zinc-800 hover:text-white disabled:opacity-30"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(
                      (p) =>
                        p === 1 ||
                        p === totalPages ||
                        Math.abs(p - currentPage) <= 1,
                    )
                    .map((p, i, arr) => (
                      <div key={p} className="flex items-center">
                        {i > 0 && arr[i - 1] !== p - 1 && (
                          <span className="px-2 text-zinc-600">...</span>
                        )}
                        <Button
                          variant={currentPage === p ? "default" : "outline"}
                          size="sm"
                          className={`h-9 w-9 rounded-md transition-all ${
                            currentPage === p
                              ? "border border-sky-400/45 bg-linear-to-br from-sky-500 to-cyan-500 text-white shadow-lg shadow-sky-950/35"
                              : "rounded-xl border-zinc-800 bg-zinc-900/90 text-zinc-300 shadow-sm shadow-black/10 hover:-translate-y-0.5 hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
                          }`}
                          onClick={() => setCurrentPage(p)}
                        >
                          {p}
                        </Button>
                      </div>
                    ))}

                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-xl border-zinc-800 bg-zinc-900/90 text-zinc-300 shadow-sm shadow-black/10 transition-all hover:-translate-y-0.5 hover:border-zinc-700 hover:bg-zinc-800 hover:text-white disabled:opacity-30"
                    onClick={() =>
                      setCurrentPage(Math.min(totalPages, currentPage + 1))
                    }
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {studentList.length === 0 && !loading && (
            <div className="rounded-3xl border border-dashed border-zinc-800/70 bg-linear-to-br from-zinc-900/35 to-zinc-950/35 py-20 text-center text-zinc-500">
              <p className="text-base font-medium italic text-zinc-300">
                Tidak ada siswa yang tampil pada filter ini.
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                {selectedClass
                  ? "Periksa mapping kelas siswa, atau ubah pencarian/filter yang sedang aktif."
                  : "Pilih satu kelas terlebih dahulu untuk memuat daftar siswa."}
              </p>
              <div className="mt-4 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={refreshStudents}
                  className="border-zinc-700 bg-zinc-900/80 text-zinc-100 hover:bg-zinc-800"
                >
                  Muat Ulang Daftar Siswa
                </Button>
              </div>
            </div>
          )}

          {/* Submit Button */}
          {studentList.length > 0 && (
            <div className="mt-4 space-y-4 border-t border-zinc-800/50 pt-6">
              {submitSummary ? (
                <div className="space-y-3">
                  <InlineState
                    title={submitSummary.title}
                    description={submitSummary.description}
                    variant={submitSummaryVariant}
                    actionLabel={
                      submitSummary.tone === "warning"
                        ? "Muat Ulang Siswa"
                        : undefined
                    }
                    onAction={
                      submitSummary.tone === "warning"
                        ? refreshStudents
                        : undefined
                    }
                    className="text-sm"
                  />
                  {submitSummary.failedStudents.length > 0 ? (
                    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/55 p-3 text-xs text-zinc-300">
                      <p className="font-semibold uppercase tracking-[0.16em] text-zinc-400">
                        Siswa yang perlu dicek ulang
                      </p>
                      <ul className="mt-2 space-y-1">
                        {submitSummary.failedStudents
                          .slice(0, 5)
                          .map((student) => (
                            <li key={student.studentId}>
                              • {student.studentName}: {student.message}
                            </li>
                          ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {selectedClass === "all" ? (
                <InlineState
                  title="Mode baca semua kelas"
                  description="All Students hanya untuk melihat data lintas kelas. Untuk simpan absensi manual, pilih satu kelas spesifik."
                  variant="warning"
                  className="text-sm"
                />
              ) : null}
              <div className="flex flex-col gap-4 rounded-[1.6rem] border border-zinc-800/80 bg-linear-to-br from-zinc-950/72 to-zinc-900/38 p-4 shadow-sm shadow-black/10 lg:flex-row lg:items-center lg:justify-between">
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    {
                      label: "Siap Simpan",
                      value:
                        selectedClass === "all"
                          ? "Pilih kelas dulu"
                          : `${studentList.length} siswa`,
                    },
                    {
                      label: "Mode Tampilan",
                      value: viewMode === "detailed" ? "Detail" : "Ringkas",
                    },
                    {
                      label: "Status Dominan",
                      value:
                        attendanceSummary.present >= attendanceSummary.alpha
                          ? "Hadir"
                          : "Perlu review",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-2xl border border-zinc-800/80 bg-zinc-950/70 px-4 py-3 text-xs text-zinc-500 shadow-sm shadow-black/10"
                    >
                      <p className="uppercase tracking-[0.16em]">
                        {item.label}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-zinc-100">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || selectedClass === "all"}
                    className="min-w-[240px] gap-3 rounded-2xl border border-sky-400/35 bg-linear-to-r from-sky-500 to-cyan-500 px-8 py-6 font-semibold text-white shadow-lg shadow-sky-950/35 transition-all hover:-translate-y-0.5 hover:from-sky-400 hover:to-cyan-400 hover:shadow-xl hover:shadow-sky-950/45 active:scale-[0.99] disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Check className="h-5 w-5" />
                    )}
                    {selectedClass === "all"
                      ? "Pilih Kelas Untuk Simpan"
                      : "Simpan Attendance"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="sm:max-w-md border-zinc-800 bg-zinc-900 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
              Ekspor Laporan Absensi
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Sesuaikan pengaturan laporan sebelum mengekspor ke Excel.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 border-y border-zinc-800/50 py-6">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Tanggal", value: selectedDate },
                {
                  label: "Kelas",
                  value:
                    classList.find((c) => c.id === selectedClass)?.name || "-",
                },
                { label: "Total Data", value: String(studentList.length) },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-xs text-zinc-500 shadow-sm shadow-black/10"
                >
                  <p className="uppercase tracking-[0.16em]">{item.label}</p>
                  <p className="mt-2 text-sm font-semibold text-zinc-100">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-zinc-500 italic">
              Tanggal dan kelas mengikuti filter aktif pada halaman absensi.
            </p>

            <div className="space-y-2">
              <Label className="text-xs text-zinc-500 font-bold uppercase tracking-wider">
                Filter Status Kehadiran
              </Label>
              <Select
                value={exportFilter}
                onValueChange={(val) =>
                  setExportFilter(val as AttendanceStatus | "all")
                }
              >
                <SelectTrigger className="bg-zinc-950 border-zinc-800 h-11 text-zinc-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                  <SelectItem value="all">Semua Status (Lengkap)</SelectItem>
                  <SelectItem value="present" className="text-emerald-400">
                    Hanya Hadir
                  </SelectItem>
                  <SelectItem value="sick" className="text-yellow-400">
                    Hanya Sakit
                  </SelectItem>
                  <SelectItem value="permission" className="text-blue-400">
                    Hanya Izin
                  </SelectItem>
                  <SelectItem value="alpha" className="text-red-400">
                    Hanya Tanpa Keterangan (Alpha)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-zinc-500 italic px-1">
                *Hanya siswa dengan status yang dipilih akan masuk ke laporan.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowExportDialog(false)}
              className="bg-transparent border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 px-6"
            >
              Batal
            </Button>
            <Button
              onClick={handleExportXlsx}
              disabled={isExporting}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 shadow-lg shadow-emerald-600/20"
            >
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sedang mengekspor...
                </>
              ) : (
                "Ekspor File"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
