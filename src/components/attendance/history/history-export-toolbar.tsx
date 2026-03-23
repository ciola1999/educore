import { Download, FileText, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  historyBadgeClass,
  historyGradientButtonClass,
  historyNeutralButtonClass,
  historyPanelCompactClass,
} from "./history-ui";

type HistoryExportToolbarProps = {
  historyLogsLength: number;
  historyTotal: number;
  historyStartDate: string;
  historyEndDate: string;
  historyStatus: string;
  historySource: string;
  historyGroupBy: string;
  exportingHistory: boolean;
  exportingPdf: boolean;
  printingReport: boolean;
  loadingHistory: boolean;
  canGoPrev: boolean;
  canGoNext: boolean;
  onExportHistory: () => void;
  onExportPdf: () => void;
  onPrintReport: () => void;
  onResetDate: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
};

export function HistoryExportToolbar({
  historyLogsLength,
  historyTotal,
  historyStartDate,
  historyEndDate,
  historyStatus,
  historySource,
  historyGroupBy,
  exportingHistory,
  exportingPdf,
  printingReport,
  loadingHistory,
  canGoPrev,
  canGoNext,
  onExportHistory,
  onExportPdf,
  onPrintReport,
  onResetDate,
  onPrevPage,
  onNextPage,
}: HistoryExportToolbarProps) {
  return (
    <div className={`sticky bottom-3 z-20 ${historyPanelCompactClass}`}>
      <div className="flex flex-col gap-3 text-sm text-zinc-500 xl:flex-row xl:items-center xl:justify-between">
        <span
          className={`${historyBadgeClass} text-sm normal-case tracking-normal`}
        >
          Menampilkan {historyLogsLength} dari {historyTotal} record
          {historyStartDate || historyEndDate
            ? " sesuai rentang tanggal"
            : " dari seluruh riwayat"}
        </span>
        <span className={historyBadgeClass}>
          Status {historyStatus.toUpperCase()} | Sumber{" "}
          {historySource.toUpperCase()} | Group {historyGroupBy.toUpperCase()}
        </span>
        <div className="flex flex-wrap gap-2 xl:justify-end">
          <Button
            type="button"
            variant="default"
            disabled={exportingHistory || loadingHistory || historyTotal === 0}
            onClick={onExportHistory}
            className={`h-11 ${historyGradientButtonClass("emerald")}`}
          >
            {exportingHistory ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            <span className="!text-white">Export History</span>
          </Button>
          <Button
            type="button"
            variant="default"
            disabled={exportingPdf || loadingHistory || historyTotal === 0}
            onClick={onExportPdf}
            className={`h-11 ${historyGradientButtonClass("sky")}`}
          >
            {exportingPdf ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            <span className="!text-white">Export PDF</span>
          </Button>
          <Button
            type="button"
            variant="default"
            disabled={printingReport || loadingHistory || historyTotal === 0}
            onClick={onPrintReport}
            className={`h-11 ${historyGradientButtonClass("violet")}`}
          >
            {printingReport ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Printer className="mr-2 h-4 w-4" />
            )}
            <span className="!text-white">Print Report</span>
          </Button>
          {(historyStartDate || historyEndDate) && (
            <Button
              type="button"
              variant="default"
              onClick={onResetDate}
              className={historyNeutralButtonClass}
            >
              <span className="!text-zinc-100">Reset Tanggal</span>
            </Button>
          )}
          <Button
            type="button"
            variant="default"
            disabled={!canGoPrev}
            onClick={onPrevPage}
            className={historyNeutralButtonClass}
          >
            <span className="!text-zinc-100">Prev</span>
          </Button>
          <Button
            type="button"
            variant="default"
            disabled={!canGoNext}
            onClick={onNextPage}
            className={historyNeutralButtonClass}
          >
            <span className="!text-zinc-100">Next</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
