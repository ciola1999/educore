"use client";

import { format, parseISO } from "date-fns";
import { id } from "date-fns/locale";
import {
  Calendar,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Cloud,
  CloudOff,
  Download,
  FileSpreadsheet,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import * as xlsx from "xlsx";
import { Badge } from "@/components/ui/badge";
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
import { isTauri } from "@/core/env";
import {
  type AttendanceHistoryRecord,
  getAttendanceHistory,
  getAttendanceHistoryCount,
} from "@/core/services/attendance-service";

// Group records by date
type GroupedRecords = Record<string, AttendanceHistoryRecord[]>;

type SortOption = "earliest" | "latest";

export function DailyLogView() {
  const [records, setRecords] = useState<AttendanceHistoryRecord[]>([]);
  const [groupedRecords, setGroupedRecords] = useState<GroupedRecords>({});
  const [loading, setLoading] = useState(true);

  // Filter states
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [status, setStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("latest");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage] = useState<number>(50);
  const [totalItems, setTotalItems] = useState<number>(0);

  const [isExporting, setIsExporting] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportStartDate, setExportStartDate] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [exportEndDate, setExportEndDate] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [exportStatus, setExportStatus] = useState<string>("all");
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debounced search (optimization for 2026 pattern)
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let filterStartDate: string | undefined;
      let filterEndDate: string | undefined;

      if (selectedDate) {
        filterStartDate = selectedDate;
        filterEndDate = selectedDate;
      } else {
        filterStartDate = startDate || undefined;
        filterEndDate = endDate || undefined;
      }

      const baseFilter = {
        startDate: filterStartDate,
        endDate: filterEndDate,
        status,
        sortBy,
        searchQuery: debouncedSearch,
      };

      const count = await getAttendanceHistoryCount(baseFilter);
      setTotalItems(count);
      setTotalPages(Math.max(1, Math.ceil(count / itemsPerPage)));

      const data = await getAttendanceHistory({
        ...baseFilter,
        limit: itemsPerPage,
      });
      setRecords(data);

      const grouped: GroupedRecords = {};
      data.forEach((record) => {
        if (!grouped[record.date]) {
          grouped[record.date] = [];
        }
        grouped[record.date].push(record);
      });
      setGroupedRecords(grouped);
    } catch (_error) {
      toast.error("Gagal memuat riwayat absensi");
    } finally {
      setLoading(false);
    }
  }, [
    startDate,
    endDate,
    status,
    sortBy,
    itemsPerPage,
    selectedDate,
    debouncedSearch,
  ]);

  // Load data on mount and filter changes
  useEffect(() => {
    loadData();

    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Quick filter handlers
  const handleToday = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    setStartDate(today);
    setEndDate(today);
  };

  const handleYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = format(yesterday, "yyyy-MM-dd");
    setStartDate(yesterdayStr);
    setEndDate(yesterdayStr);
  };

  const handleLast7Days = () => {
    const today = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    setStartDate(format(weekAgo, "yyyy-MM-dd"));
    setEndDate(format(today, "yyyy-MM-dd"));
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      // Fetch full data for the selected export range
      const dataToExport = await getAttendanceHistory({
        startDate: exportStartDate,
        endDate: exportEndDate,
        status: exportStatus,
        sortBy: "latest",
      });

      if (dataToExport.length === 0) {
        toast.warning("Tidak ada data absensi untuk rentang tanggal tersebut");
        return;
      }

      const formattedData = dataToExport.map((r) => ({
        Tanggal: r.date,
        NIS: r.snapshotStudentNis || "",
        Nama: r.snapshotStudentName || "",
        "Jam Masuk": r.checkInTime
          ? format(new Date(r.checkInTime), "HH:mm")
          : "--:--",
        "Jam Pulang": r.checkOutTime
          ? format(new Date(r.checkOutTime), "HH:mm")
          : "--:--",
        Status:
          r.status === "LATE"
            ? "TERLAMBAT"
            : r.status === "EXCUSED"
              ? "IZIN"
              : r.status === "ABSENT"
                ? "TIDAK HADIR"
                : "HADIR",
        Keterangan: r.lateDuration ? `Terlambat ${r.lateDuration} menit` : "",
        Sync: r.syncStatus,
      }));

      const worksheet = xlsx.utils.json_to_sheet(formattedData);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, "Daily Log Absensi");

      const excelBuffer = xlsx.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });

      const fileName = `EduCore_Attendance_${exportStartDate}_to_${exportEndDate}.xlsx`;

      if (isTauri()) {
        try {
          const { save } = await import("@tauri-apps/plugin-dialog");
          const { writeFile } = await import("@tauri-apps/plugin-fs");

          const filePath = await save({
            filters: [{ name: "Excel", extensions: ["xlsx"] }],
            defaultPath: fileName,
          });

          if (filePath) {
            await writeFile(
              filePath,
              new Uint8Array(excelBuffer as ArrayBuffer),
            );
            toast.success("Log absensi berhasil disimpan!");
            setShowExportDialog(false);
            return;
          }
          return;
        } catch (_tauriError) {
          // Fallback
        }
      }

      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 100);
      toast.success("Ekspor data berhasil!");
      setShowExportDialog(false);
    } catch (error) {
      toast.error("Gagal mengekspor data");
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Note: Importing attendance logs is complex because it involves student IDs
    // For now we'll just show the same pattern but warning that it's read-only in this version
    toast.info(
      "Fitur import log saat ini hanya tersedia untuk Dashboard Utama.",
    );
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClearFilters = () => {
    setStartDate("");
    setEndDate("");
    setStatus("all");
    setSortBy("latest");
    setSearchQuery("");
  };

  // Sort dates in the grouped records (newest first by default)
  const sortedDates = Object.keys(groupedRecords).sort((a, b) => {
    if (sortBy === "earliest") {
      return a.localeCompare(b);
    }
    return b.localeCompare(a);
  });

  // Get stats
  const totalRecords = records.length;
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todayRecords = records.filter((r) => r.date === todayStr);
  const lateRecords = records.filter((r) => r.status === "LATE");
  const presentRecords = records.filter((r) => r.status === "PRESENT");

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Riwayat Absensi</h2>
          <p className="text-sm text-zinc-400">
            Menampilkan data absensi dari berbagai tanggal
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            accept=".xlsx, .xls"
            ref={fileInputRef}
            onChange={handleImportExcel}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending}
            variant="outline"
            size="sm"
            className="bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-zinc-300 gap-2"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Import
          </Button>
          <Button
            onClick={() => setShowExportDialog(true)}
            disabled={isExporting}
            variant="outline"
            size="sm"
            className="bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-emerald-400 hover:text-emerald-300 gap-2"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export Log
          </Button>
          <Button
            onClick={loadData}
            disabled={loading}
            variant="outline"
            size="sm"
            className="bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-zinc-300 gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant="outline"
            size="sm"
            className={`bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-zinc-300 gap-2 ${
              showFilters ? "bg-zinc-800" : ""
            }`}
          >
            <Filter className="h-4 w-4" />
            Filter
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
          <div className="flex items-center gap-2 text-zinc-400 mb-1">
            <Calendar className="h-4 w-4" />
            <span className="text-xs">Total Record</span>
          </div>
          <p className="text-2xl font-bold text-white">{totalRecords}</p>
        </div>
        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
          <div className="flex items-center gap-2 text-zinc-400 mb-1">
            <CalendarRange className="h-4 w-4" />
            <span className="text-xs">Hari Ini</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">
            {todayRecords.length}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
          <div className="flex items-center gap-2 text-zinc-400 mb-1">
            <Clock className="h-4 w-4" />
            <span className="text-xs">Tepat Waktu</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">
            {presentRecords.length}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
          <div className="flex items-center gap-2 text-zinc-400 mb-1">
            <Clock className="h-4 w-4" />
            <span className="text-xs">Terlambat</span>
          </div>
          <p className="text-2xl font-bold text-red-400">
            {lateRecords.length}
          </p>
        </div>
      </div>

      {/* Filters Section */}
      {showFilters && (
        <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 text-zinc-300 mb-2">
            <Filter className="h-4 w-4" />
            <span className="font-medium">Opsi Filter</span>
          </div>

          {/* Quick Date Filters */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleToday}
              variant="outline"
              size="sm"
              className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-300"
            >
              Hari Ini
            </Button>
            <Button
              onClick={handleYesterday}
              variant="outline"
              size="sm"
              className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-300"
            >
              Kemarin
            </Button>
            <Button
              onClick={handleLast7Days}
              variant="outline"
              size="sm"
              className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-300"
            >
              7 Hari Terakhir
            </Button>
            <Button
              onClick={handleClearFilters}
              variant="outline"
              size="sm"
              className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-400"
            >
              Clear
            </Button>
          </div>

          {/* Date Range & Sort */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label htmlFor="start-date" className="text-xs text-zinc-400">
                Tanggal Mulai
              </label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-zinc-950 border-zinc-800 text-zinc-200"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="end-date" className="text-xs text-zinc-400">
                Tanggal Selesai
              </label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-zinc-950 border-zinc-800 text-zinc-200"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="sort-by" className="text-xs text-zinc-400">
                Urutkan Waktu
              </label>
              <Select
                value={sortBy}
                onValueChange={(value) => setSortBy(value as SortOption)}
              >
                <SelectTrigger
                  id="sort-by"
                  className="bg-zinc-950 border-zinc-800 text-zinc-200"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem
                    value="latest"
                    className="text-zinc-200 focus:bg-zinc-800"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronDown className="h-4 w-4" />
                      <span>Terbaru</span>
                    </div>
                  </SelectItem>
                  <SelectItem
                    value="earliest"
                    className="text-zinc-200 focus:bg-zinc-800"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronUp className="h-4 w-4" />
                      <span>Terlama</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label htmlFor="status-filter" className="text-xs text-zinc-400">
                Filter Status
              </label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger
                  id="status-filter"
                  className="bg-zinc-950 border-zinc-800 text-zinc-200"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="all" className="focus:bg-zinc-800">
                    Semua Status
                  </SelectItem>
                  <SelectItem
                    value="present"
                    className="focus:bg-zinc-800 text-emerald-400"
                  >
                    Hadir
                  </SelectItem>
                  <SelectItem
                    value="late"
                    className="focus:bg-zinc-800 text-red-400"
                  >
                    Terlambat
                  </SelectItem>
                  <SelectItem
                    value="excused"
                    className="focus:bg-zinc-800 text-amber-400"
                  >
                    Izin/Sakit
                  </SelectItem>
                  <SelectItem
                    value="absent"
                    className="focus:bg-zinc-800 text-zinc-400"
                  >
                    Alpa
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Search */}
          <div className="space-y-2">
            <label htmlFor="search-query" className="text-xs text-zinc-400">
              Cari Siswa (NIS/Nama)
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                id="search-query"
                type="text"
                placeholder="Cari berdasarkan NIS atau nama..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-zinc-950 border-zinc-800 text-zinc-200 placeholder:text-zinc-600"
              />
            </div>
          </div>
        </div>
      )}

      {/* Records by Date */}
      <div className="space-y-6">
        {/* Date Dropdown Filter */}
        {sortedDates.length > 0 && (
          <div className="mb-4">
            <label
              htmlFor="date-dropdown"
              className="mb-2 block text-sm font-medium text-zinc-300"
            >
              Pilih Tanggal
            </label>
            <Select
              value={selectedDate || "all"}
              onValueChange={(value) => {
                setSelectedDate(value === "all" ? null : value);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger
                id="date-dropdown"
                className="w-full max-w-xs bg-zinc-950 border-zinc-800 text-zinc-200"
              >
                <SelectValue placeholder="Semua tanggal" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                <SelectItem
                  value="all"
                  className="text-zinc-200 focus:bg-zinc-800"
                >
                  Semua tanggal
                </SelectItem>
                {sortedDates.map((date) => (
                  <SelectItem
                    key={date}
                    value={date}
                    className="text-zinc-200 focus:bg-zinc-800"
                  >
                    {format(parseISO(date), "EEEE, dd MMMM yyyy", {
                      locale: id,
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {loading && records.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-500 mx-auto mb-4" />
            <p className="text-zinc-400">Memuat riwayat absensi...</p>
          </div>
        ) : sortedDates.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-12 text-center">
            <CalendarRange className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400 text-lg">Belum ada data absensi</p>
            <p className="text-zinc-500 text-sm mt-1">
              Data absensi akan muncul di sini setelah siswa melakukan check-in
            </p>
          </div>
        ) : (
          sortedDates.map((date) => {
            const dateRecords = groupedRecords[date];
            const isToday = date === todayStr;
            const formattedDate = format(parseISO(date), "EEEE, dd MMMM yyyy", {
              locale: id,
            });

            return (
              <div key={date} className="space-y-3">
                {/* Date Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`px-3 py-1.5 rounded-lg font-medium text-sm ${
                        isToday
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-zinc-800 text-zinc-300"
                      }`}
                    >
                      {isToday ? "Hari Ini" : formattedDate}
                    </div>
                    <span className="text-xs text-zinc-500">
                      {dateRecords.length} siswa
                    </span>
                  </div>
                  {isToday && (
                    <Badge
                      variant="outline"
                      className="bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    >
                      Aktif
                    </Badge>
                  )}
                </div>

                {/* Records Table */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-zinc-900/50 border-b border-zinc-800">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-zinc-400">NIS</TableHead>
                        <TableHead className="text-zinc-400">
                          Nama Lengkap
                        </TableHead>
                        <TableHead className="text-zinc-400">Masuk</TableHead>
                        <TableHead className="text-zinc-400">Pulang</TableHead>
                        <TableHead className="text-zinc-400">Status</TableHead>
                        <TableHead className="text-right text-zinc-400">
                          Sync Cloud
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dateRecords.map((row) => (
                        <TableRow
                          key={row.id}
                          className="border-zinc-800 hover:bg-zinc-900/50"
                        >
                          <TableCell className="font-mono text-xs font-bold text-zinc-300">
                            {row.snapshotStudentNis || "-"}
                          </TableCell>
                          <TableCell className="font-medium text-zinc-200">
                            {row.snapshotStudentName || "-"}
                          </TableCell>
                          <TableCell className="text-zinc-300">
                            {row.checkInTime
                              ? format(new Date(row.checkInTime), "HH:mm")
                              : "--:--"}
                          </TableCell>
                          <TableCell className="text-zinc-300">
                            {row.checkOutTime
                              ? format(new Date(row.checkOutTime), "HH:mm")
                              : "--:--"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                row.status === "LATE"
                                  ? "border-red-500/30 text-red-400 bg-red-500/10"
                                  : row.status === "EXCUSED"
                                    ? "border-amber-500/30 text-amber-400 bg-amber-500/10"
                                    : row.status === "ABSENT"
                                      ? "border-zinc-500/30 text-zinc-400 bg-zinc-500/10"
                                      : "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                              }
                            >
                              {row.status === "LATE"
                                ? "TERLAMBAT"
                                : row.status === "EXCUSED"
                                  ? "IZIN"
                                  : row.status === "ABSENT"
                                    ? "TIDAK HADIR"
                                    : "HADIR"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {row.syncStatus === "pending" ? (
                              <div className="flex items-center justify-end gap-1.5 text-amber-500/80">
                                <CloudOff className="h-4 w-4" />
                                <span className="text-xs font-semibold uppercase">
                                  Pending
                                </span>
                              </div>
                            ) : row.syncStatus === "error" ? (
                              <div className="flex items-center justify-end gap-1.5 text-red-500/80">
                                <CloudOff className="h-4 w-4" />
                                <span className="text-xs font-semibold uppercase">
                                  Error
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5 text-blue-400">
                                <Cloud className="h-4 w-4" />
                                <span className="text-xs font-semibold uppercase">
                                  Synced
                                </span>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Summary Footer & Pagination */}
      {records.length > 0 && (
        <div className="flex flex-col gap-4 pt-4 border-t border-zinc-800">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>
              Menampilkan {Math.min(currentPage * itemsPerPage, totalItems)}{" "}
              dari {totalItems} record
            </span>
            <span>Terakhir diperbarui: {format(new Date(), "HH:mm:ss")}</span>
          </div>

          {/* Pagination Controls */}
          {totalItems > itemsPerPage && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">
                Halaman {currentPage} dari {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  variant="outline"
                  size="sm"
                  className="bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-zinc-300"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  onClick={() =>
                    setCurrentPage(Math.min(totalPages, currentPage + 1))
                  }
                  disabled={currentPage === totalPages}
                  variant="outline"
                  size="sm"
                  className="bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-zinc-300"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
              Export Laporan Absensi
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Pilih rentang tanggal untuk mengeksport file Excel.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex flex-wrap gap-2 mb-4">
              <Button
                variant="outline"
                size="xs"
                className="bg-zinc-900 border-zinc-800 text-xs h-8"
                onClick={() => {
                  const today = format(new Date(), "yyyy-MM-dd");
                  setExportStartDate(today);
                  setExportEndDate(today);
                }}
              >
                Hari Ini
              </Button>
              <Button
                variant="outline"
                size="xs"
                className="bg-zinc-900 border-zinc-800 text-xs h-8"
                onClick={() => {
                  const weekAgo = new Date();
                  weekAgo.setDate(weekAgo.getDate() - 7);
                  setExportStartDate(format(weekAgo, "yyyy-MM-dd"));
                  setExportEndDate(format(new Date(), "yyyy-MM-dd"));
                }}
              >
                7 Hari Terakhir
              </Button>
              <Button
                variant="outline"
                size="xs"
                className="bg-zinc-900 border-zinc-800 text-xs h-8"
                onClick={() => {
                  const monthAgo = new Date();
                  monthAgo.setMonth(monthAgo.getMonth() - 1);
                  setExportStartDate(format(monthAgo, "yyyy-MM-dd"));
                  setExportEndDate(format(new Date(), "yyyy-MM-dd"));
                }}
              >
                30 Hari Terakhir
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label
                  htmlFor="export-start-date"
                  className="text-xs text-zinc-500 font-medium"
                >
                  Dari Tanggal
                </label>
                <Input
                  id="export-start-date"
                  type="date"
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
                  className="bg-zinc-900 border-zinc-800 h-9 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="export-end-date"
                  className="text-xs text-zinc-500 font-medium"
                >
                  Sampai Tanggal
                </label>
                <Input
                  id="export-end-date"
                  type="date"
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                  className="bg-zinc-900 border-zinc-800 h-9 text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="export-status"
                className="text-xs text-zinc-500 font-medium"
              >
                Filter Status
              </label>
              <Select value={exportStatus} onValueChange={setExportStatus}>
                <SelectTrigger
                  id="export-status"
                  className="bg-zinc-900 border-zinc-800 h-9 text-sm"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="present">Only Present (Hadir)</SelectItem>
                  <SelectItem value="late">Only Late (Terlambat)</SelectItem>
                  <SelectItem value="excused">
                    Only Excused (Izin/Sakit)
                  </SelectItem>
                  <SelectItem value="absent">Only Absent (Alpa)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowExportDialog(false)}
              className="bg-zinc-900 border-zinc-800 hover:bg-zinc-800"
            >
              Batal
            </Button>
            <Button
              onClick={handleExportExcel}
              disabled={isExporting}
              className="bg-emerald-600 hover:bg-emerald-500 text-white min-w-[100px]"
            >
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                "Export Excel"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
