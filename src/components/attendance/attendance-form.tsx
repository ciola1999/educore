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
import { Input } from "@/components/ui/input";
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

export function AttendanceForm() {
  const [viewMode, setViewMode] = useState<"compact" | "detailed">("detailed");
  const [exportFilter, setExportFilter] = useState<AttendanceStatus | "all">(
    "all",
  );
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const {
    isMounted,
    loading,
    submitting,
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
    refreshStudents,
  } = useAttendanceForm();

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

  const statusLabels: Record<AttendanceStatus, string> = {
    present: "P",
    sick: "S",
    permission: "I",
    alpha: "A",
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
          // Fallback to browser download if tauri specific logic fails
        }
      }

      // Browser Fallback or Web Mode
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

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col gap-4 p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800 backdrop-blur-md shadow-xl">
        {/* Row 1: Primary Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-zinc-800/50 shrink-0 border border-zinc-700/50">
              <CalendarDays className="h-5 w-5 text-blue-400" />
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm focus:ring-2 focus:ring-blue-500 transition-all w-full font-medium"
            />
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm focus:ring-2 focus:ring-blue-500 transition-all w-full font-medium cursor-pointer"
            >
              <option value="" disabled>
                Select Class
              </option>
              {classList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search student..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl pl-11 pr-4 py-2.5 text-white text-sm focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-zinc-600"
            />
          </div>
        </div>

        {/* Row 2: Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-zinc-800/50">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={refreshStudents}
              variant="outline"
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 rounded-xl px-4 h-10 group"
              title="Refresh students"
            >
              <RefreshCw className="h-4 w-4 mr-2 group-active:rotate-180 transition-transform duration-500" />
              Refresh
            </Button>

            <Button
              onClick={() => setShowExportDialog(true)}
              variant="outline"
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 rounded-xl px-4 h-10"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-500" />{" "}
              Export XLSX
            </Button>

            <Button
              onClick={() =>
                setViewMode((prevMode) =>
                  prevMode === "detailed" ? "compact" : "detailed",
                )
              }
              variant="outline"
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 rounded-xl px-4 h-10"
            >
              <LayoutList className="h-4 w-4 mr-2 text-indigo-400" />
              {viewMode === "detailed" ? "Compact View" : "Detailed View"}
            </Button>
          </div>

          <Button
            onClick={setAllPresent}
            variant="outline"
            className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 rounded-xl px-5 h-10 font-medium"
          >
            <Check className="h-4 w-4 mr-2" /> Mark All Present
          </Button>
        </div>
      </div>

      {classList.length === 0 && (
        <div className="text-center py-20 text-zinc-500 bg-zinc-900/30 rounded-2xl border border-dashed border-zinc-800">
          <p className="mb-2 italic">No classes found.</p>
          <p className="text-sm">
            Please add classes first in{" "}
            <span className="text-blue-400 hover:underline cursor-pointer">
              Courses
            </span>{" "}
            menu.
          </p>
        </div>
      )}

      {classList.length > 0 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-xs font-medium text-zinc-400 uppercase tracking-wider px-1">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-600"></span>{" "}
              Present
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-yellow-600"></span> Sick
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-600"></span>{" "}
              Permission
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-600"></span> Alpha
            </span>
          </div>

          {/* Student List */}
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-blue-500/50" />
            </div>
          ) : (
            <div className="grid gap-3">
              {paginatedStudentList.map((student, idx) => {
                const globalIdx = (currentPage - 1) * itemsPerPage + idx;
                return (
                  <div
                    key={student.id}
                    className="group flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/50 hover:bg-zinc-800/50 hover:border-zinc-700 transition-all duration-200"
                  >
                    <div className="flex items-center gap-4 shrink-0 px-1">
                      <span className="w-6 text-zinc-600 text-[10px] font-mono font-bold text-center">
                        {(globalIdx + 1).toString().padStart(2, "0")}
                      </span>
                    </div>
                    <div className="flex flex-col flex-1">
                      <span className="font-mono text-xs text-blue-400 font-semibold mb-0.5">
                        {student.nis}
                        {student.nisn ? ` • NISN ${student.nisn}` : ""}
                      </span>
                      <span className="text-zinc-100 font-medium tracking-tight">
                        {student.fullName}
                      </span>
                      {viewMode === "detailed" ? (
                        <>
                          <span className="text-[11px] text-zinc-500">
                            {formatBirthInfo(
                              student.tempatLahir,
                              student.tanggalLahir,
                            )}
                          </span>
                          <span className="text-[11px] text-zinc-500">
                            {student.parentName || "-"}
                            {student.parentPhone
                              ? ` • ${student.parentPhone}`
                              : ""}
                          </span>
                          {student.alamat ? (
                            <span className="text-[11px] text-zinc-600 line-clamp-1 max-w-[300px]">
                              {student.alamat}
                            </span>
                          ) : null}
                        </>
                      ) : null}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {student.isLocked && (
                        <div className="flex items-center gap-3 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
                          <span className="text-[10px] font-bold text-blue-400 uppercase tracking-tighter">
                            QR AUTO-SYNCED
                          </span>
                          <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                            {student.checkInTime && (
                              <span title="Check-in">
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
                              <span title="Check-out">
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
                        <div
                          className={`flex gap-1.5 p-1 rounded-lg bg-zinc-950/50 border border-zinc-800 ${student.isLocked ? "opacity-60 grayscale" : ""}`}
                        >
                          {(
                            [
                              "present",
                              "sick",
                              "permission",
                              "alpha",
                            ] as AttendanceStatus[]
                          ).map((status) => (
                            <button
                              key={status}
                              type="button"
                              disabled={student.isLocked}
                              onClick={() => updateStatus(student.id, status)}
                              title={
                                status.charAt(0).toUpperCase() + status.slice(1)
                              }
                              className={`w-9 h-9 sm:w-8 sm:h-8 rounded-md text-xs font-bold transition-all duration-200 ${
                                student.status === status
                                  ? `${statusColors[status]} text-white shadow-lg scale-105 sm:scale-110`
                                  : "bg-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                              } ${student.isLocked ? "cursor-not-allowed" : ""}`}
                            >
                              {statusLabels[status]}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-4 border-t border-zinc-800/50">
              <div className="text-sm text-zinc-500">
                Showing{" "}
                <span className="text-zinc-300 font-medium">
                  {(currentPage - 1) * itemsPerPage + 1}
                </span>{" "}
                to{" "}
                <span className="text-zinc-300 font-medium">
                  {Math.min(currentPage * itemsPerPage, totalItems)}
                </span>{" "}
                of{" "}
                <span className="text-zinc-300 font-medium">{totalItems}</span>{" "}
                students
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 disabled:opacity-30 transition-colors"
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
                            ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                            : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
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
                  className="h-9 w-9 border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 disabled:opacity-30 transition-colors"
                  onClick={() =>
                    setCurrentPage(Math.min(totalPages, currentPage + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {studentList.length === 0 && !loading && (
            <div className="text-center py-20 text-zinc-500 bg-zinc-900/20 rounded-2xl border border-zinc-800/50">
              <p className="italic">No students found in this class.</p>
              <p className="text-sm mt-1">
                Make sure student's Grade matches the class name.
              </p>
            </div>
          )}

          {/* Submit Button */}
          {studentList.length > 0 && (
            <div className="flex justify-end pt-6 border-t border-zinc-800/50 mt-4">
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-6 px-8 rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 gap-3 min-w-[200px]"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Check className="h-5 w-5" />
                )}
                Save Attendance
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
              Export Laporan Absensi
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Sesuaikan pengaturan laporan sebelum mengeksport ke Excel.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-6 border-y border-zinc-800/50">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-zinc-500 font-bold uppercase tracking-wider">
                  Tanggal
                </Label>
                <Input
                  type="date"
                  value={selectedDate}
                  disabled
                  className="bg-zinc-950 border-zinc-800 text-zinc-400 h-10"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-zinc-500 font-bold uppercase tracking-wider">
                  Kelas
                </Label>
                <Input
                  value={
                    classList.find((c) => c.id === selectedClass)?.name || "-"
                  }
                  disabled
                  className="bg-zinc-950 border-zinc-800 text-zinc-400 h-10"
                />
              </div>
            </div>

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
                    Hanya Hadir (Present)
                  </SelectItem>
                  <SelectItem value="sick" className="text-yellow-400">
                    Hanya Sakit (Sick)
                  </SelectItem>
                  <SelectItem value="permission" className="text-blue-400">
                    Hanya Izin (Permission)
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
                  Memproses...
                </>
              ) : (
                "Export Sekarang"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
