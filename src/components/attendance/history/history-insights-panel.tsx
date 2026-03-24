"use client";

import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  AttendanceHistoryStudentSummary,
  AttendanceHistorySummary,
  AttendanceRiskFollowUpHistoryItem,
} from "./history-types";
import {
  historyFocusRingClass,
  historyGradientButtonClass,
  historyMetricCardClass,
  historyPanelClass,
  historySectionCopyClass,
  historySectionEyebrowClass,
  historySectionTitleClass,
} from "./history-ui";

type HistoryInsightsPanelProps = {
  selectedHistoryStudentId: string;
  followUpHistory: AttendanceRiskFollowUpHistoryItem[];
  historySummary: AttendanceHistorySummary | null;
  historyClassSummaryLength: number;
  atRiskStudentsLength: number;
  internalNotifications: string[];
  historyStudentSummaryLength: number;
  topStudentSummary: AttendanceHistoryStudentSummary[];
  topLateStudents: AttendanceHistoryStudentSummary[];
  topAbsentStudents: AttendanceHistoryStudentSummary[];
  exportingStudentSummary: boolean;
  exportingRiskRanking: boolean;
  onExportStudentSummary: () => void;
  onExportRiskRanking: () => void;
  onDrillDownToStudent: (student: AttendanceHistoryStudentSummary) => void;
};

export function HistoryInsightsPanel({
  selectedHistoryStudentId,
  followUpHistory,
  historySummary,
  historyClassSummaryLength,
  atRiskStudentsLength,
  internalNotifications,
  historyStudentSummaryLength,
  topStudentSummary,
  topLateStudents,
  topAbsentStudents,
  exportingStudentSummary,
  exportingRiskRanking,
  onExportStudentSummary,
  onExportRiskRanking,
  onDrillDownToStudent,
}: HistoryInsightsPanelProps) {
  return (
    <>
      {selectedHistoryStudentId !== "all" && followUpHistory.length > 0 ? (
        <div className={historyPanelClass}>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className={historySectionEyebrowClass}>Tindak Lanjut</p>
              <h3 className={historySectionTitleClass}>
                Riwayat Tindakan Attendance
              </h3>
              <p className={historySectionCopyClass}>
                Riwayat follow-up untuk siswa yang sedang dipilih
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {followUpHistory.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3"
              >
                <p className="text-sm font-medium text-zinc-100">
                  {item.judul}
                </p>
                <p className="mt-1 text-xs text-zinc-400">{item.pesan}</p>
                <p className="mt-2 text-[11px] text-zinc-500">
                  Status: {item.isRead ? "Selesai" : "Aktif"}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {historySummary ? (
        <div className={historyPanelClass}>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className={historySectionEyebrowClass}>Ringkasan</p>
              <h3 className={historySectionTitleClass}>Dashboard Attendance</h3>
              <p className={historySectionCopyClass}>
                Ringkasan cepat untuk admin/kepala sekolah
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className={historyMetricCardClass}>
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Tingkat Hadir
              </p>
              <p className="mt-2 text-2xl font-semibold text-zinc-100">
                {historySummary.total === 0
                  ? 0
                  : Number(
                      (
                        ((historySummary.present + historySummary.late) /
                          historySummary.total) *
                        100
                      ).toFixed(1),
                    )}
                %
              </p>
            </div>
            <div className={historyMetricCardClass}>
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Kelas Aktif
              </p>
              <p className="mt-2 text-2xl font-semibold text-zinc-100">
                {historyClassSummaryLength}
              </p>
            </div>
            <div className={historyMetricCardClass}>
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Siswa Berisiko
              </p>
              <p className="mt-2 text-2xl font-semibold text-red-300">
                {atRiskStudentsLength}
              </p>
            </div>
            <div className={historyMetricCardClass}>
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Sumber Dominan
              </p>
              <p className="mt-2 text-2xl font-semibold text-zinc-100">
                {historySummary.qr >= historySummary.manual ? "QR" : "Manual"}
              </p>
            </div>
          </div>
          {internalNotifications.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-zinc-800 bg-linear-to-br from-zinc-900/55 to-zinc-950/70 p-4 shadow-sm shadow-black/10">
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Notifikasi Internal
              </p>
              <div className="mt-3 space-y-2">
                {internalNotifications.map((message) => (
                  <div
                    key={message}
                    className="rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-300 shadow-sm shadow-black/10"
                  >
                    {message}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {historyStudentSummaryLength > 0 ? (
        <div className={historyPanelClass}>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className={historySectionEyebrowClass}>Peringkat</p>
              <h3 className={historySectionTitleClass}>Rekap Siswa</h3>
              <p className={historySectionCopyClass}>
                Peringkat siswa berdasarkan total record dan tingkat hadir
              </p>
            </div>
            <p className="text-xs text-zinc-500">
              Menampilkan {topStudentSummary.length} dari{" "}
              {historyStudentSummaryLength} siswa
            </p>
          </div>

          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={exportingStudentSummary}
              onClick={onExportStudentSummary}
              className={`h-10 w-full sm:w-auto ${historyGradientButtonClass("sky")}`}
            >
              {exportingStudentSummary ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              <span className="!text-white">Ekspor Rekap Siswa</span>
            </Button>
          </div>

          <section
            className="mt-4 overflow-x-auto"
            aria-label="Tabel rekap attendance siswa"
          >
            <div className="grid gap-3 lg:hidden">
              {topStudentSummary.map((item) => (
                <div
                  key={`student-card-${item.studentId}`}
                  className="rounded-2xl border border-zinc-800 bg-linear-to-br from-zinc-900/55 to-zinc-950/70 p-4 shadow-sm shadow-black/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onDrillDownToStudent(item)}
                        className={`text-left text-sm font-semibold text-zinc-100 underline-offset-4 hover:underline ${historyFocusRingClass}`}
                      >
                        {item.studentName}
                      </button>
                      <p className="mt-1 text-xs text-zinc-500">
                        {item.nis} • {item.className}
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
                    <div className="rounded-xl bg-zinc-950/70 px-3 py-2 text-red-300">
                      Alpha {item.absent}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <table className="hidden min-w-full text-sm lg:table">
              <thead className="text-left text-zinc-500">
                <tr className="border-b border-zinc-800">
                  <th className="pb-2 pr-4 font-medium">Siswa</th>
                  <th className="pb-2 pr-4 font-medium">NIS</th>
                  <th className="pb-2 pr-4 font-medium">Kelas</th>
                  <th className="pb-2 pr-4 font-medium">Total</th>
                  <th className="pb-2 pr-4 font-medium">Hadir</th>
                  <th className="pb-2 pr-4 font-medium">Terlambat</th>
                  <th className="pb-2 pr-4 font-medium">Alpha</th>
                  <th className="pb-2 font-medium">Tingkat Hadir</th>
                </tr>
              </thead>
              <tbody>
                {topStudentSummary.map((item) => (
                  <tr
                    key={item.studentId}
                    className="border-b border-zinc-900/80 text-zinc-200"
                  >
                    <td className="py-3 pr-4 font-medium">
                      <button
                        type="button"
                        onClick={() => onDrillDownToStudent(item)}
                        className={`text-left text-zinc-100 underline-offset-4 hover:underline ${historyFocusRingClass}`}
                      >
                        {item.studentName}
                      </button>
                    </td>
                    <td className="py-3 pr-4">{item.nis}</td>
                    <td className="py-3 pr-4">{item.className}</td>
                    <td className="py-3 pr-4">{item.total}</td>
                    <td className="py-3 pr-4 text-emerald-300">
                      {item.present}
                    </td>
                    <td className="py-3 pr-4 text-amber-300">{item.late}</td>
                    <td className="py-3 pr-4 text-red-300">{item.absent}</td>
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

      {historyStudentSummaryLength > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <div className={historyPanelClass}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className={historySectionEyebrowClass}>Ketepatan Waktu</p>
                <h3 className={historySectionTitleClass}>Ranking Terlambat</h3>
                <p className={historySectionCopyClass}>
                  Siswa dengan frekuensi terlambat tertinggi
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {topLateStudents.map((item, index) => (
                <button
                  type="button"
                  onClick={() => onDrillDownToStudent(item)}
                  key={`late-${item.studentId}`}
                  className={`flex w-full flex-col gap-3 rounded-2xl border border-zinc-800 bg-linear-to-br from-zinc-900/55 to-zinc-950/70 px-3 py-3 text-left shadow-sm shadow-black/10 transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-700 hover:shadow-md hover:shadow-black/20 sm:flex-row sm:items-center sm:justify-between ${historyFocusRingClass}`}
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-100">
                      {index + 1}. {item.studentName}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {item.nis} • {item.className}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-amber-300">
                      {item.late} kali
                    </p>
                    <p className="text-xs text-zinc-500">Alpha {item.absent}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className={historyPanelClass}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className={historySectionEyebrowClass}>Peringkat Risiko</p>
                <h3 className={historySectionTitleClass}>Ranking Alpha</h3>
                <p className={historySectionCopyClass}>
                  Siswa dengan frekuensi alpha tertinggi
                </p>
              </div>
              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={exportingRiskRanking}
                onClick={onExportRiskRanking}
                className={`h-10 w-full sm:w-auto ${historyGradientButtonClass("red")}`}
              >
                {exportingRiskRanking ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                <span className="!text-white">Ekspor Peringkat</span>
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              {topAbsentStudents.map((item, index) => (
                <button
                  type="button"
                  key={`absent-${item.studentId}`}
                  onClick={() => onDrillDownToStudent(item)}
                  className={`flex w-full flex-col gap-3 rounded-2xl border border-zinc-800 bg-linear-to-br from-zinc-900/55 to-zinc-950/70 px-3 py-3 text-left shadow-sm shadow-black/10 transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-700 hover:shadow-md hover:shadow-black/20 sm:flex-row sm:items-center sm:justify-between ${historyFocusRingClass}`}
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-100">
                      {index + 1}. {item.studentName}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {item.nis} • {item.className}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-red-300">
                      {item.absent} kali
                    </p>
                    <p className="text-xs text-zinc-500">
                      Terlambat {item.late}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
