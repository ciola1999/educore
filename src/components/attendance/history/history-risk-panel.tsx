"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AttendanceHistoryStudentSummary } from "./history-types";
import {
  historyFocusRingClass,
  historyMetricCardClass,
  historyOutlineButtonClass,
  historyPanelClass,
  historySectionCopyClass,
  historySectionEyebrowClass,
  historySectionTitleClass,
  historySoftPanelClass,
} from "./history-ui";

type HistoryRiskPanelProps = {
  historyStudentSummaryLength: number;
  atRiskStudents: AttendanceHistoryStudentSummary[];
  riskAlphaThreshold: string;
  riskLateThreshold: string;
  riskRateThreshold: string;
  savingRiskSettings: boolean;
  followUpNote: string;
  followUpDeadline: string;
  creatingFollowUpId: string | null;
  onRiskAlphaThresholdChange: (value: string) => void;
  onRiskLateThresholdChange: (value: string) => void;
  onRiskRateThresholdChange: (value: string) => void;
  onSaveRiskSettings: () => void;
  onFollowUpNoteChange: (value: string) => void;
  onFollowUpDeadlineChange: (value: string) => void;
  onDrillDownToStudent: (student: AttendanceHistoryStudentSummary) => void;
  onCreateFollowUp: (student: AttendanceHistoryStudentSummary) => void;
};

export function HistoryRiskPanel({
  historyStudentSummaryLength,
  atRiskStudents,
  riskAlphaThreshold,
  riskLateThreshold,
  riskRateThreshold,
  savingRiskSettings,
  followUpNote,
  followUpDeadline,
  creatingFollowUpId,
  onRiskAlphaThresholdChange,
  onRiskLateThresholdChange,
  onRiskRateThresholdChange,
  onSaveRiskSettings,
  onFollowUpNoteChange,
  onFollowUpDeadlineChange,
  onDrillDownToStudent,
  onCreateFollowUp,
}: HistoryRiskPanelProps) {
  if (historyStudentSummaryLength <= 0) {
    return null;
  }

  return (
    <div className={historyPanelClass}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={historySectionEyebrowClass}>Risk Control</p>
          <h3 className={historySectionTitleClass}>Alert Risiko Attendance</h3>
          <p className={historySectionCopyClass}>
            Threshold alert bisa diatur langsung oleh admin
          </p>
        </div>
        <p className="text-xs text-zinc-500">
          {atRiskStudents.length} siswa terdeteksi
        </p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Input
          type="number"
          min="0"
          value={riskAlphaThreshold}
          onChange={(event) => onRiskAlphaThresholdChange(event.target.value)}
          placeholder="Alpha threshold"
          aria-label="Threshold alpha"
          className="rounded-2xl border-zinc-800 bg-zinc-950/90 text-zinc-100 shadow-sm shadow-black/10 hover:border-red-500/25 focus-visible:ring-red-500/25"
        />
        <Input
          type="number"
          min="0"
          value={riskLateThreshold}
          onChange={(event) => onRiskLateThresholdChange(event.target.value)}
          placeholder="Terlambat threshold"
          aria-label="Threshold terlambat"
          className="rounded-2xl border-zinc-800 bg-zinc-950/90 text-zinc-100 shadow-sm shadow-black/10 hover:border-amber-500/25 focus-visible:ring-amber-500/25"
        />
        <Input
          type="number"
          min="0"
          max="100"
          value={riskRateThreshold}
          onChange={(event) => onRiskRateThresholdChange(event.target.value)}
          placeholder="Rate threshold"
          aria-label="Threshold attendance rate"
          className="rounded-2xl border-zinc-800 bg-zinc-950/90 text-zinc-100 shadow-sm shadow-black/10 hover:border-sky-500/25 focus-visible:ring-sky-500/25"
        />
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={savingRiskSettings}
          onClick={onSaveRiskSettings}
          className={historyOutlineButtonClass("sky")}
        >
          {savingRiskSettings ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Simpan Threshold
        </Button>
      </div>
      <div className={`mt-4 space-y-3 ${historySoftPanelClass}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-zinc-100">
              Catatan Tindak Lanjut
            </p>
            <p className="text-xs text-zinc-500">
              Catatan ini akan ikut masuk ke notifikasi internal saat tombol
              follow-up ditekan.
            </p>
          </div>
          <span className="text-xs text-zinc-500">
            {followUpNote.trim().length}/300
          </span>
        </div>
        <Input
          value={followUpNote}
          maxLength={300}
          onChange={(event) => onFollowUpNoteChange(event.target.value)}
          placeholder="Contoh: hubungi wali kelas, cek alasan alpha, jadwalkan konseling."
          aria-label="Catatan tindak lanjut"
          className="border-zinc-800 bg-zinc-950 text-zinc-200"
        />
        <div className="grid gap-2 md:grid-cols-[1fr_180px]">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Info
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              Deadline akan ikut tampil di dashboard follow-up guru atau wali
              kelas.
            </p>
          </div>
          <Input
            type="date"
            value={followUpDeadline}
            onChange={(event) => onFollowUpDeadlineChange(event.target.value)}
            aria-label="Deadline tindak lanjut"
            className="border-zinc-800 bg-zinc-950 text-zinc-200"
          />
        </div>
      </div>
      {atRiskStudents.length > 0 ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {atRiskStudents.map((item) => (
            <div
              key={`risk-${item.studentId}`}
              className={`${historyMetricCardClass} border-red-500/20 from-red-500/10 to-red-500/4 shadow-red-950/10 hover:-translate-y-0.5 hover:shadow-md hover:shadow-red-950/20`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <button
                    type="button"
                    onClick={() => onDrillDownToStudent(item)}
                    className={`text-left text-sm font-medium text-zinc-100 underline-offset-4 hover:underline ${historyFocusRingClass}`}
                  >
                    {item.studentName}
                  </button>
                  <p className="text-xs text-zinc-400">
                    {item.nis} • {item.className}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={creatingFollowUpId === item.studentId}
                  onClick={() => onCreateFollowUp(item)}
                  className={historyOutlineButtonClass("red")}
                >
                  {creatingFollowUpId === item.studentId ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Buat Tindak Lanjut
                </Button>
              </div>
              <div className="mt-3 text-right text-xs">
                <p className="text-red-300">Alpha {item.absent}</p>
                <p className="text-amber-300">Terlambat {item.late}</p>
                <p className="text-zinc-300">Rate {item.attendanceRate}%</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-zinc-500">
          Tidak ada siswa berisiko pada filter aktif.
        </p>
      )}
    </div>
  );
}
