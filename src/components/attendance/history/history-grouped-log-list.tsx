import { cn } from "@/lib/utils";
import { HistoryRecordCard } from "./history-record-card";
import type {
  HistoryDensity,
  HistoryLogGroup,
  TodayAttendanceLog,
} from "./history-types";
import { historyPanelCompactClass, historySoftPanelClass } from "./history-ui";

type HistoryGroupedLogListProps = {
  groups: HistoryLogGroup[];
  groupBy: "date" | "class";
  density: HistoryDensity;
  formatStatusLabel: (status: TodayAttendanceLog["status"]) => string;
  formatTime: (value: string | Date | null) => string;
};

export function HistoryGroupedLogList({
  groups,
  groupBy,
  density,
  formatStatusLabel,
  formatTime,
}: HistoryGroupedLogListProps) {
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.title} className={historyPanelCompactClass}>
          <div
            className={cn(
              historySoftPanelClass,
              "sticky top-2 z-10 mb-3 flex items-center justify-between px-3 py-2 backdrop-blur-sm",
            )}
          >
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-200">
              {groupBy === "date"
                ? `Tanggal ${group.title}`
                : `Kelas ${group.title}`}
            </h3>
            <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              {group.items.length} record
            </span>
          </div>
          <div className="space-y-3">
            {group.items.map((log) => (
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
        </div>
      ))}
    </div>
  );
}
