import { cn } from "@/lib/utils";
import type { HistoryDensity, TodayAttendanceLog } from "./history-types";
import {
  historyCardMetaLabelClass,
  historyCardMutedCopyClass,
  historyCardShellClass,
} from "./history-ui";

type HistoryRecordCardProps = {
  log: TodayAttendanceLog;
  density: HistoryDensity;
  statusLabel: string;
  checkInLabel: string;
  checkOutLabel: string;
};

export function HistoryRecordCard({
  log,
  density,
  statusLabel,
  checkInLabel,
  checkOutLabel,
}: HistoryRecordCardProps) {
  const itemCardClass = cn(
    historyCardShellClass,
    density === "compact" ? "rounded-2xl p-3" : "rounded-3xl p-4",
  );
  const identityTextClass =
    density === "compact"
      ? "mt-1 text-xs text-zinc-400"
      : "mt-1 text-sm text-zinc-400";
  const metaTextClass =
    density === "compact"
      ? "space-y-1 text-xs text-zinc-300 sm:text-right"
      : "space-y-1 text-sm text-zinc-300 sm:text-right";

  return (
    <div className={itemCardClass}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-tight text-zinc-100 sm:text-[15px]">
            {log.snapshotStudentName || "Siswa"}
          </p>
          <p className={identityTextClass}>
            Kelas: {log.className || "-"} • {log.date} •{" "}
            {log.source === "qr" ? "QR" : "MANUAL"}
          </p>
          <p className={identityTextClass}>
            NIS: {log.snapshotStudentNis || "-"}
          </p>
          <p className={identityTextClass}>
            NISN: {log.snapshotStudentNisn || "-"}
          </p>
        </div>
        <div className={metaTextClass}>
          <p className="font-medium text-zinc-200">{statusLabel}</p>
          <p className={historyCardMutedCopyClass}>
            In {checkInLabel} • Out {checkOutLabel}
          </p>
          {log.lateDuration ? (
            <p className={historyCardMutedCopyClass}>
              Terlambat {log.lateDuration} menit
            </p>
          ) : null}
          {log.notes ? (
            <div className="pt-1">
              <p className={historyCardMetaLabelClass}>Catatan</p>
              <p className={cn(historyCardMutedCopyClass, "mt-1 leading-5")}>
                {log.notes}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
