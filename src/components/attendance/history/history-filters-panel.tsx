"use client";

import { CalendarRange, Search } from "lucide-react";
import { InlineState } from "@/components/common/inline-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  HistoryDensity,
  HistoryFilterStatus,
  HistoryGroupBy,
  HistoryQuickRange,
  HistorySourceFilter,
  StudentOption,
} from "./history-types";
import {
  historyGradientButtonClass,
  historyNeutralButtonClass,
  historyPanelClass,
  historyQuickRangeInactiveClass,
  historyToggleButtonClass,
} from "./history-ui";

type HistoryFiltersPanelProps = {
  isStudentView: boolean;
  isAdminView: boolean;
  activeHistoryFilterCount: number;
  hasHistoryFiltersActive: boolean;
  historyDensity: HistoryDensity;
  showHistoryAdvancedFilters: boolean;
  historySearch: string;
  historyStudentSearch: string;
  historyStudentOptions: StudentOption[];
  selectedHistoryStudentId: string;
  loadingStudentOptions: boolean;
  historyStatus: HistoryFilterStatus;
  historySource: HistorySourceFilter;
  historyGroupBy: HistoryGroupBy;
  historySort: string;
  historyStartDate: string;
  historyEndDate: string;
  error: string | null;
  dateRangeInvalid: boolean;
  onHistoryDensityChange: (value: HistoryDensity) => void;
  onToggleAdvancedFilters: () => void;
  onResetAllFilters: () => void;
  onHistorySearchChange: (value: string) => void;
  onHistoryStudentSearchChange: (value: string) => void;
  onSelectedHistoryStudentIdChange: (value: string) => void;
  onHistoryStatusChange: (value: HistoryFilterStatus) => void;
  onHistorySourceChange: (value: HistorySourceFilter) => void;
  onHistoryGroupByChange: (value: HistoryGroupBy) => void;
  onHistorySortChange: (value: string) => void;
  onHistoryStartDateChange: (value: string) => void;
  onHistoryEndDateChange: (value: string) => void;
  onApplyQuickRange: (range: Exclude<HistoryQuickRange, "custom">) => void;
  isQuickRangeActive: (range: Exclude<HistoryQuickRange, "custom">) => boolean;
  onResetInvalidFilterState: () => void;
};

export function HistoryFiltersPanel({
  isStudentView,
  isAdminView,
  activeHistoryFilterCount,
  hasHistoryFiltersActive,
  historyDensity,
  showHistoryAdvancedFilters,
  historySearch,
  historyStudentSearch,
  historyStudentOptions,
  selectedHistoryStudentId,
  loadingStudentOptions,
  historyStatus,
  historySource,
  historyGroupBy,
  historySort,
  historyStartDate,
  historyEndDate,
  error,
  dateRangeInvalid,
  onHistoryDensityChange,
  onToggleAdvancedFilters,
  onResetAllFilters,
  onHistorySearchChange,
  onHistoryStudentSearchChange,
  onSelectedHistoryStudentIdChange,
  onHistoryStatusChange,
  onHistorySourceChange,
  onHistoryGroupByChange,
  onHistorySortChange,
  onHistoryStartDateChange,
  onHistoryEndDateChange,
  onApplyQuickRange,
  isQuickRangeActive,
  onResetInvalidFilterState,
}: HistoryFiltersPanelProps) {
  return (
    <div className={`flex flex-col gap-3 ${historyPanelClass}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-200">
            Filter Riwayat
          </p>
          <p className="text-xs text-zinc-500">
            Filter Aktif: {activeHistoryFilterCount} • Total:{" "}
            {hasHistoryFiltersActive ? "Mode tersegmentasi" : "Semua data"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-xl border border-zinc-800 bg-zinc-950/60 p-1 shadow-sm shadow-black/10">
            <Button
              type="button"
              variant="default"
              size="sm"
              aria-pressed={historyDensity === "comfortable"}
              onClick={() => onHistoryDensityChange("comfortable")}
              className={historyToggleButtonClass(
                "sky",
                historyDensity === "comfortable",
              )}
            >
              <span
                className={
                  historyDensity === "comfortable"
                    ? "!text-white"
                    : "!text-zinc-300"
                }
              >
                Comfort
              </span>
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              aria-pressed={historyDensity === "compact"}
              onClick={() => onHistoryDensityChange("compact")}
              className={historyToggleButtonClass(
                "amber",
                historyDensity === "compact",
              )}
            >
              <span
                className={
                  historyDensity === "compact"
                    ? "!text-white"
                    : "!text-zinc-300"
                }
              >
                Compact
              </span>
            </Button>
          </div>
          <Button
            type="button"
            variant="default"
            aria-expanded={showHistoryAdvancedFilters}
            onClick={onToggleAdvancedFilters}
            className={historyNeutralButtonClass}
          >
            <span className="!text-zinc-100">
              {showHistoryAdvancedFilters
                ? "Sembunyikan Filter Lanjutan"
                : "Tampilkan Filter Lanjutan"}
            </span>
          </Button>
          {hasHistoryFiltersActive ? (
            <Button
              type="button"
              variant="default"
              onClick={onResetAllFilters}
              className={historyGradientButtonClass("red")}
            >
              <span className="!text-red-100">Reset Semua Filter</span>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {!isStudentView ? (
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              value={historySearch}
              onChange={(event) => onHistorySearchChange(event.target.value)}
              placeholder="Cari nama atau NIS..."
              aria-label="Cari nama atau NIS siswa"
              className="border-zinc-800 bg-zinc-950 pl-11 text-zinc-100"
            />
          </div>
        ) : (
          <div className="rounded-md border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-500">
            Pencarian lintas siswa disembunyikan pada mode siswa.
          </div>
        )}

        {isAdminView ? (
          <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3">
            <Input
              value={historyStudentSearch}
              onChange={(event) =>
                onHistoryStudentSearchChange(event.target.value)
              }
              placeholder="Cari siswa spesifik..."
              aria-label="Cari siswa spesifik"
              className="border-zinc-800 bg-zinc-950 text-zinc-100"
            />
            <Select
              value={selectedHistoryStudentId}
              onValueChange={onSelectedHistoryStudentIdChange}
            >
              <SelectTrigger
                aria-label="Pilih siswa spesifik"
                className="border-zinc-800 bg-zinc-950 text-zinc-200"
              >
                <SelectValue placeholder="Semua siswa" />
              </SelectTrigger>
              <SelectContent className="border-zinc-800 bg-zinc-900 text-white">
                <SelectItem value="all">Semua Siswa</SelectItem>
                {historyStudentOptions.map((student) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.fullName} • {student.nis} • {student.grade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-zinc-500">
              {loadingStudentOptions
                ? "Memuat opsi siswa..."
                : "Filter ini khusus admin/super admin."}
            </p>
          </div>
        ) : null}

        <Select
          value={historyStatus}
          onValueChange={(value) =>
            onHistoryStatusChange(value as HistoryFilterStatus)
          }
        >
          <SelectTrigger
            aria-label="Filter status attendance"
            className="border-zinc-800 bg-zinc-950 text-zinc-200"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-zinc-800 bg-zinc-900 text-white">
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="present">Hadir</SelectItem>
            <SelectItem value="late">Terlambat</SelectItem>
            <SelectItem value="sick">Sakit</SelectItem>
            <SelectItem value="permission">Izin</SelectItem>
            <SelectItem value="alpha">Alpha</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={historySource}
          onValueChange={(value) =>
            onHistorySourceChange(value as HistorySourceFilter)
          }
        >
          <SelectTrigger
            aria-label="Filter sumber attendance"
            className="border-zinc-800 bg-zinc-950 text-zinc-200"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-zinc-800 bg-zinc-900 text-white">
            <SelectItem value="all">Semua Sumber</SelectItem>
            <SelectItem value="qr">QR</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>

        {showHistoryAdvancedFilters ? (
          <>
            <Select
              value={historyGroupBy}
              onValueChange={(value) =>
                onHistoryGroupByChange(value as HistoryGroupBy)
              }
            >
              <SelectTrigger
                aria-label="Atur grouping riwayat"
                className="border-zinc-800 bg-zinc-950 text-zinc-200"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-zinc-800 bg-zinc-900 text-white">
                <SelectItem value="none">Tanpa Grouping</SelectItem>
                <SelectItem value="date">Group per Tanggal</SelectItem>
                <SelectItem value="class">Group per Kelas</SelectItem>
              </SelectContent>
            </Select>

            <Select value={historySort} onValueChange={onHistorySortChange}>
              <SelectTrigger
                aria-label="Atur urutan riwayat"
                className="border-zinc-800 bg-zinc-950 text-zinc-200"
              >
                <CalendarRange className="mr-2 h-4 w-4 text-zinc-500" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-zinc-800 bg-zinc-900 text-white">
                <SelectItem value="latest">Terbaru</SelectItem>
                <SelectItem value="earliest">Terlama</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={historyStartDate}
              onChange={(event) => onHistoryStartDateChange(event.target.value)}
              aria-label="Tanggal mulai riwayat"
              className="border-zinc-800 bg-zinc-950 text-zinc-200"
            />

            <Input
              type="date"
              value={historyEndDate}
              onChange={(event) => onHistoryEndDateChange(event.target.value)}
              aria-label="Tanggal akhir riwayat"
              className="border-zinc-800 bg-zinc-950 text-zinc-200"
            />
          </>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="default"
          onClick={() => onApplyQuickRange("today")}
          aria-pressed={isQuickRangeActive("today")}
          className={
            isQuickRangeActive("today")
              ? "rounded-xl border border-emerald-400/50 !bg-linear-to-br !from-emerald-500 !to-teal-500 !text-white shadow-sm shadow-emerald-950/30 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300/70 hover:!from-emerald-400 hover:!to-teal-400"
              : historyQuickRangeInactiveClass
          }
        >
          <span
            className={
              isQuickRangeActive("today") ? "!text-white" : "!text-zinc-100"
            }
          >
            Hari Ini
          </span>
        </Button>
        <Button
          type="button"
          variant="default"
          onClick={() => onApplyQuickRange("7d")}
          aria-pressed={isQuickRangeActive("7d")}
          className={
            isQuickRangeActive("7d")
              ? "rounded-xl border border-sky-400/50 !bg-linear-to-br !from-sky-500 !to-cyan-500 !text-white shadow-sm shadow-sky-950/30 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300/70 hover:!from-sky-400 hover:!to-cyan-400"
              : historyQuickRangeInactiveClass
          }
        >
          <span
            className={
              isQuickRangeActive("7d") ? "!text-white" : "!text-zinc-100"
            }
          >
            7 Hari
          </span>
        </Button>
        <Button
          type="button"
          variant="default"
          onClick={() => onApplyQuickRange("30d")}
          aria-pressed={isQuickRangeActive("30d")}
          className={
            isQuickRangeActive("30d")
              ? "rounded-xl border border-amber-400/50 !bg-linear-to-br !from-amber-500 !to-orange-500 !text-white shadow-sm shadow-amber-950/30 transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-300/70 hover:!from-amber-400 hover:!to-orange-400"
              : historyQuickRangeInactiveClass
          }
        >
          <span
            className={
              isQuickRangeActive("30d") ? "!text-white" : "!text-zinc-100"
            }
          >
            30 Hari
          </span>
        </Button>
        <Button
          type="button"
          variant="default"
          onClick={() => onApplyQuickRange("month")}
          aria-pressed={isQuickRangeActive("month")}
          className={
            isQuickRangeActive("month")
              ? "rounded-xl border border-violet-400/50 !bg-linear-to-br !from-violet-500 !to-fuchsia-500 !text-white shadow-sm shadow-violet-950/30 transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-300/70 hover:!from-violet-400 hover:!to-fuchsia-400"
              : historyQuickRangeInactiveClass
          }
        >
          <span
            className={
              isQuickRangeActive("month") ? "!text-white" : "!text-zinc-100"
            }
          >
            Bulan Ini
          </span>
        </Button>
        <Button
          type="button"
          variant="default"
          onClick={() => onApplyQuickRange("all")}
          aria-pressed={isQuickRangeActive("all")}
          className={
            isQuickRangeActive("all")
              ? "rounded-xl border border-zinc-500/60 !bg-linear-to-br !from-zinc-700 !to-zinc-800 !text-white shadow-sm shadow-black/20 transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-400/80 hover:!from-zinc-600 hover:!to-zinc-700"
              : historyQuickRangeInactiveClass
          }
        >
          <span
            className={
              isQuickRangeActive("all") ? "!text-white" : "!text-zinc-100"
            }
          >
            Semua
          </span>
        </Button>
      </div>

      {error ? (
        <InlineState
          title="Filter riwayat perlu disesuaikan"
          description={error}
          variant={dateRangeInvalid ? "warning" : "error"}
          actionLabel="Reset Filter Riwayat"
          onAction={onResetInvalidFilterState}
        />
      ) : null}
    </div>
  );
}
