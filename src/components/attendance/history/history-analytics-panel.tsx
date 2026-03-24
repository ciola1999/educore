"use client";

import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  AttendanceHistoryClassSummary,
  AttendanceHistoryHeatmapPoint,
  AttendanceHistoryTrendPoint,
} from "./history-types";
import {
  historyFocusRingClass,
  historyGradientButtonClass,
  historyMetricCardClass,
  historyOutlineButtonClass,
  historyPanelClass,
  historySectionCopyClass,
  historySectionEyebrowClass,
  historySectionTitleClass,
  historySoftPanelClass,
} from "./history-ui";

type HistoryAnalyticsPanelProps = {
  isAdminView: boolean;
  selectedHistoryStudentId: string;
  historyClassSummary: AttendanceHistoryClassSummary[];
  analyticsClassFilter: string;
  compareClassA: string;
  compareClassB: string;
  compareItemA: AttendanceHistoryClassSummary | null;
  compareItemB: AttendanceHistoryClassSummary | null;
  historyTrend: AttendanceHistoryTrendPoint[];
  maxTrendTotal: number;
  historyHeatmap: AttendanceHistoryHeatmapPoint[];
  heatmapMonthLabel: string | null;
  bestClass: AttendanceHistoryClassSummary | null;
  lowestClass: AttendanceHistoryClassSummary | null;
  classSummaryLabel: string;
  exportingClassSummary: boolean;
  exportingAnalyticsReport: boolean;
  exportingCompareReport: boolean;
  onAnalyticsClassFilterChange: (value: string) => void;
  onCompareClassAChange: (value: string) => void;
  onCompareClassBChange: (value: string) => void;
  onExportClassSummary: () => void;
  onExportAnalyticsReport: () => void;
  onExportCompareReport: () => void;
  onDrillDownToDate: (date: string) => void;
};

export function HistoryAnalyticsPanel({
  isAdminView,
  selectedHistoryStudentId,
  historyClassSummary,
  analyticsClassFilter,
  compareClassA,
  compareClassB,
  compareItemA,
  compareItemB,
  historyTrend,
  maxTrendTotal,
  historyHeatmap,
  heatmapMonthLabel,
  bestClass,
  lowestClass,
  classSummaryLabel,
  exportingClassSummary,
  exportingAnalyticsReport,
  exportingCompareReport,
  onAnalyticsClassFilterChange,
  onCompareClassAChange,
  onCompareClassBChange,
  onExportClassSummary,
  onExportAnalyticsReport,
  onExportCompareReport,
  onDrillDownToDate,
}: HistoryAnalyticsPanelProps) {
  return (
    <>
      {isAdminView && historyClassSummary.length > 0 ? (
        <div
          className={`flex flex-col gap-3 ${historyPanelClass} sm:flex-row sm:items-end sm:justify-between`}
        >
          <div>
            <p className={historySectionEyebrowClass}>Cakupan</p>
            <p className={historySectionTitleClass}>
              Filter Analitik per Kelas
            </p>
            <p className={historySectionCopyClass}>
              Mempengaruhi tren, rekap siswa, dan ranking alpha/terlambat
            </p>
          </div>
          <div className="w-full sm:w-72">
            <Select
              value={analyticsClassFilter}
              onValueChange={onAnalyticsClassFilterChange}
            >
              <SelectTrigger
                aria-label="Filter analitik per kelas"
                className="border-zinc-800 bg-zinc-950 text-zinc-200"
              >
                <SelectValue placeholder="Semua kelas" />
              </SelectTrigger>
              <SelectContent className="border-zinc-800 bg-zinc-900 text-white">
                <SelectItem value="all">Semua Kelas</SelectItem>
                {historyClassSummary.map((item) => (
                  <SelectItem key={item.className} value={item.className}>
                    {item.className}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      {isAdminView && historyClassSummary.length > 1 ? (
        <div className={historyPanelClass}>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className={historySectionEyebrowClass}>Banding</p>
              <h3 className={historySectionTitleClass}>
                Mode Banding Antar Kelas
              </h3>
              <p className={historySectionCopyClass}>
                Bandingkan performa dua kelas pada filter aktif
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Select value={compareClassA} onValueChange={onCompareClassAChange}>
              <SelectTrigger
                aria-label="Pilih kelas A untuk compare"
                className="border-zinc-800 bg-zinc-950 text-zinc-200"
              >
                <SelectValue placeholder="Pilih kelas A" />
              </SelectTrigger>
              <SelectContent className="border-zinc-800 bg-zinc-900 text-white">
                <SelectItem value="none">Pilih Kelas A</SelectItem>
                {historyClassSummary.map((item) => (
                  <SelectItem
                    key={`a-${item.className}`}
                    value={item.className}
                  >
                    {item.className}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={compareClassB} onValueChange={onCompareClassBChange}>
              <SelectTrigger
                aria-label="Pilih kelas B untuk compare"
                className="border-zinc-800 bg-zinc-950 text-zinc-200"
              >
                <SelectValue placeholder="Pilih kelas B" />
              </SelectTrigger>
              <SelectContent className="border-zinc-800 bg-zinc-900 text-white">
                <SelectItem value="none">Pilih Kelas B</SelectItem>
                {historyClassSummary.map((item) => (
                  <SelectItem
                    key={`b-${item.className}`}
                    value={item.className}
                  >
                    {item.className}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {compareItemA && compareItemB ? (
            <div className="mt-4">
              <div className="mb-4 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={exportingCompareReport}
                  onClick={onExportCompareReport}
                  className={`w-full sm:w-auto ${historyOutlineButtonClass("sky")}`}
                >
                  {exportingCompareReport ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Ekspor Perbandingan
                </Button>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {[compareItemA, compareItemB].map((item) => (
                  <div key={item.className} className={historySoftPanelClass}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-zinc-100">
                          {item.className}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          Ringkasan performa untuk filter aktif
                        </p>
                      </div>
                      <span className="inline-flex rounded-full border border-zinc-800 bg-zinc-950/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
                        Hadir {item.attendanceRate}%
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                      <div className="rounded-xl bg-zinc-950/70 px-3 py-2 text-zinc-300">
                        Total {item.total}
                      </div>
                      <div className="rounded-xl bg-zinc-950/70 px-3 py-2 text-emerald-300">
                        Hadir {item.present}
                      </div>
                      <div className="rounded-xl bg-zinc-950/70 px-3 py-2 text-amber-300">
                        Terlambat {item.late}
                      </div>
                      <div className="rounded-xl bg-zinc-950/70 px-3 py-2 text-sky-300">
                        Izin {item.excused}
                      </div>
                      <div className="rounded-xl bg-zinc-950/70 px-3 py-2 text-red-300">
                        Alpha {item.absent}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {historyTrend.length > 0 ? (
        <div className={historyPanelClass}>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className={historySectionEyebrowClass}>Tren</p>
              <h3 className={historySectionTitleClass}>Tren Attendance</h3>
              <p className={historySectionCopyClass}>
                Grafik{" "}
                {historyTrend.some((item) => item.period.length === 7)
                  ? "bulanan"
                  : "harian"}{" "}
                sesuai filter aktif
              </p>
            </div>
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={exportingAnalyticsReport}
              onClick={onExportAnalyticsReport}
              className={`h-10 w-full sm:w-auto ${historyGradientButtonClass("sky")}`}
            >
              {exportingAnalyticsReport ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              <span className="!text-white">Ekspor Tren/Heatmap</span>
            </Button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {historyTrend.map((item) => (
              <div
                key={item.period}
                className={`${historyMetricCardClass} p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-700 hover:shadow-md hover:shadow-black/20`}
              >
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>{item.label}</span>
                  <span>{item.attendanceRate}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all"
                    style={{
                      width: `${Math.max(8, (item.total / maxTrendTotal) * 100)}%`,
                    }}
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-zinc-950/60 px-2 py-1 text-zinc-300">
                    Total {item.total}
                  </div>
                  <div className="rounded-lg bg-zinc-950/60 px-2 py-1 text-emerald-300">
                    Hadir {item.present + item.late}
                  </div>
                  <div className="rounded-lg bg-zinc-950/60 px-2 py-1 text-sky-300">
                    Izin {item.excused}
                  </div>
                  <div className="rounded-lg bg-zinc-950/60 px-2 py-1 text-red-300">
                    Alpha {item.absent}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {historyHeatmap.length > 0 ? (
        <div className={historyPanelClass}>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className={historySectionEyebrowClass}>Audit</p>
              <h3 className={historySectionTitleClass}>Heatmap Kehadiran</h3>
              <p className={historySectionCopyClass}>
                Visual audit harian untuk {heatmapMonthLabel || "rentang aktif"}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7 lg:grid-cols-10 xl:grid-cols-12">
            {historyHeatmap.map((item) => {
              const bgClass =
                item.attendanceRate >= 90
                  ? "bg-emerald-500/20 border-emerald-500/40"
                  : item.attendanceRate >= 75
                    ? "bg-amber-500/20 border-amber-500/40"
                    : "bg-red-500/20 border-red-500/40";

              return (
                <button
                  type="button"
                  key={item.date}
                  onClick={() => onDrillDownToDate(item.date)}
                  aria-label={`Lihat detail tanggal ${item.date}, attendance rate ${item.attendanceRate} persen, total ${item.total}, alpha ${item.absent}`}
                  className={`rounded-2xl border p-2.5 text-left shadow-sm shadow-black/10 transition-all duration-200 hover:-translate-y-0.5 hover:bg-zinc-900/80 hover:shadow-md hover:shadow-black/20 sm:p-3 ${historyFocusRingClass} ${bgClass}`}
                  title={`${item.date} | Hadir ${item.present + item.late}/${item.total} | Alpha ${item.absent}`}
                >
                  <p className="text-sm font-semibold text-zinc-100">
                    {item.dayLabel}
                  </p>
                  <p className="mt-1 text-xs text-zinc-300">
                    {item.attendanceRate}%
                  </p>
                  <p className="mt-2 text-[11px] text-zinc-400">
                    T {item.total}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {historyClassSummary.length > 1 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {bestClass ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 shadow-sm shadow-emerald-950/10">
              <p className="text-xs uppercase tracking-wide text-emerald-300">
                Kelas Terbaik
              </p>
              <p className="mt-2 text-lg font-semibold text-zinc-100">
                {bestClass.className}
              </p>
              <p className="mt-1 text-sm text-zinc-300">
                Tingkat hadir {bestClass.attendanceRate}% dari {bestClass.total}{" "}
                data
              </p>
            </div>
          ) : null}
          {lowestClass ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 shadow-sm shadow-red-950/10">
              <p className="text-xs uppercase tracking-wide text-red-300">
                Kelas Perlu Perhatian
              </p>
              <p className="mt-2 text-lg font-semibold text-zinc-100">
                {lowestClass.className}
              </p>
              <p className="mt-1 text-sm text-zinc-300">
                Tingkat hadir {lowestClass.attendanceRate}% dengan{" "}
                {lowestClass.absent} alpha
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {isAdminView &&
      selectedHistoryStudentId === "all" &&
      historyClassSummary.length > 0 ? (
        <div className={historyPanelClass}>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-200">
                Rekap Kelas
              </h3>
              <p className="text-xs text-zinc-500">
                Ringkasan kehadiran per kelas untuk {classSummaryLabel}
              </p>
            </div>
            <p className="text-xs text-zinc-500">
              {historyClassSummary.length} kelas terdeteksi
            </p>
          </div>

          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={exportingClassSummary}
              onClick={onExportClassSummary}
              className={`h-10 w-full sm:w-auto ${historyGradientButtonClass("emerald")}`}
            >
              {exportingClassSummary ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              <span className="!text-white">Ekspor Rekap Kelas</span>
            </Button>
          </div>

          <section
            className="mt-4 overflow-x-auto"
            aria-label="Tabel rekap attendance per kelas"
          >
            <div className="grid gap-3 lg:hidden">
              {historyClassSummary.map((item) => (
                <div
                  key={`class-card-${item.className}`}
                  className="rounded-2xl border border-zinc-800 bg-linear-to-br from-zinc-900/55 to-zinc-950/70 p-4 shadow-sm shadow-black/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-100">
                        {item.className}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Rekap kelas untuk filter aktif
                      </p>
                    </div>
                    <span className="rounded-full border border-zinc-800 bg-zinc-950/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-200">
                      {item.attendanceRate}%
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-zinc-950/70 px-3 py-2 text-zinc-300">
                      Total {item.total}
                    </div>
                    <div className="rounded-xl bg-zinc-950/70 px-3 py-2 text-emerald-300">
                      Hadir {item.present}
                    </div>
                    <div className="rounded-xl bg-zinc-950/70 px-3 py-2 text-amber-300">
                      Terlambat {item.late}
                    </div>
                    <div className="rounded-xl bg-zinc-950/70 px-3 py-2 text-sky-300">
                      Izin {item.excused}
                    </div>
                    <div className="rounded-xl bg-zinc-950/70 px-3 py-2 text-red-300">
                      Alpha {item.absent}
                    </div>
                    <div className="rounded-xl bg-zinc-950/70 px-3 py-2 text-violet-300">
                      QR {item.qr}
                    </div>
                    <div className="rounded-xl bg-zinc-950/70 px-3 py-2 text-orange-300">
                      Manual {item.manual}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <table className="hidden min-w-full text-sm lg:table">
              <thead className="text-left text-zinc-500">
                <tr className="border-b border-zinc-800">
                  <th className="pb-2 pr-4 font-medium">Kelas</th>
                  <th className="pb-2 pr-4 font-medium">Total</th>
                  <th className="pb-2 pr-4 font-medium">Hadir</th>
                  <th className="pb-2 pr-4 font-medium">Terlambat</th>
                  <th className="pb-2 pr-4 font-medium">Izin/Sakit</th>
                  <th className="pb-2 pr-4 font-medium">Alpha</th>
                  <th className="pb-2 pr-4 font-medium">QR</th>
                  <th className="pb-2 pr-4 font-medium">Manual</th>
                  <th className="pb-2 font-medium">Tingkat Hadir</th>
                </tr>
              </thead>
              <tbody>
                {historyClassSummary.map((item) => (
                  <tr
                    key={item.className}
                    className="border-b border-zinc-900/80 text-zinc-200"
                  >
                    <td className="py-3 pr-4 font-medium">{item.className}</td>
                    <td className="py-3 pr-4">{item.total}</td>
                    <td className="py-3 pr-4 text-emerald-300">
                      {item.present}
                    </td>
                    <td className="py-3 pr-4 text-amber-300">{item.late}</td>
                    <td className="py-3 pr-4 text-sky-300">{item.excused}</td>
                    <td className="py-3 pr-4 text-red-300">{item.absent}</td>
                    <td className="py-3 pr-4 text-violet-300">{item.qr}</td>
                    <td className="py-3 pr-4 text-orange-300">{item.manual}</td>
                    <td className="py-3 font-semibold text-zinc-100">
                      {item.attendanceRate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      ) : null}
    </>
  );
}
