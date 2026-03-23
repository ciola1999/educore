import { HistoryRecordCard } from "./history-record-card";
import type { HistoryDensity, TodayAttendanceLog } from "./history-types";

type HistoryLogListProps = {
  logs: TodayAttendanceLog[];
  density: HistoryDensity;
  formatStatusLabel: (status: TodayAttendanceLog["status"]) => string;
  formatTime: (value: string | Date | null) => string;
};

export function HistoryLogList({
  logs,
  density,
  formatStatusLabel,
  formatTime,
}: HistoryLogListProps) {
  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <HistoryRecordCard
          key={log.id}
          log={log}
          density={density}
          statusLabel={formatStatusLabel(log.status)}
          checkInLabel={formatTime(log.checkInTime)}
          checkOutLabel={formatTime(log.checkOutTime)}
        />
      ))}
    </div>
  );
}
