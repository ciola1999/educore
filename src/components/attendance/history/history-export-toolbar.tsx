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
  const summaryLabel = `${historyLogsLength} / ${historyTotal} data`;
  const scopeLabel =
    historyStartDate || historyEndDate ? "Rentang aktif" : "Semua riwayat";

  return (
    <div className={`sticky bottom-3 z-20 ${historyPanelCompactClass}`}>
      <div className="flex flex-col gap-3 text-sm text-zinc-500 xl:flex-row xl:items-center xl:justify-between">
        <div className="grid gap-2 sm:grid-cols-2 xl:flex xl:flex-wrap">
          <span
            className={`${historyBadgeClass} text-xs normal-case tracking-normal sm:text-sm`}
          >
            Menampilkan {summaryLabel}
          </span>
          <span
            className={`${historyBadgeClass} text-xs normal-case tracking-normal sm:text-sm`}
          >
            Cakupan {scopeLabel}
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 xl:flex xl:flex-wrap">
          <span
            className={`${historyBadgeClass} text-xs normal-case tracking-normal sm:text-sm`}
          >
            Status {historyStatus.toUpperCase()}
          </span>
          <span
            className={`${historyBadgeClass} text-xs normal-case tracking-normal sm:text-sm`}
          >
            Sumber {historySource.toUpperCase()}
          </span>
          <span
            className={`${historyBadgeClass} text-xs normal-case tracking-normal sm:text-sm`}
          >
            Kelompok {historyGroupBy.toUpperCase()}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:flex xl:flex-wrap xl:justify-end">
          <Button
            type="button"
            variant="default"
            disabled={exportingHistory || loadingHistory || historyTotal === 0}
            onClick={onExportHistory}
            className={`h-11 w-full sm:w-auto ${historyGradientButtonClass("emerald")}`}
          >
            {exportingHistory ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            <span className="!text-white">Ekspor Riwayat</span>
          </Button>
          <Button
            type="button"
            variant="default"
            disabled={exportingPdf || loadingHistory || historyTotal === 0}
            onClick={onExportPdf}
            className={`h-11 w-full sm:w-auto ${historyGradientButtonClass("sky")}`}
          >
            {exportingPdf ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            <span className="!text-white">Ekspor PDF</span>
          </Button>
          <Button
            type="button"
            variant="default"
            disabled={printingReport || loadingHistory || historyTotal === 0}
            onClick={onPrintReport}
            className={`h-11 w-full sm:w-auto ${historyGradientButtonClass("violet")}`}
          >
            {printingReport ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Printer className="mr-2 h-4 w-4" />
            )}
            <span className="!text-white">Cetak Laporan</span>
          </Button>
          {(historyStartDate || historyEndDate) && (
            <Button
              type="button"
              variant="default"
              onClick={onResetDate}
              className={`w-full sm:w-auto ${historyNeutralButtonClass}`}
            >
              <span className="!text-zinc-100">Reset Tanggal</span>
            </Button>
          )}
          <Button
            type="button"
            variant="default"
            disabled={!canGoPrev}
            onClick={onPrevPage}
            className={`w-full sm:w-auto ${historyNeutralButtonClass}`}
          >
            <span className="!text-zinc-100">Sebelumnya</span>
          </Button>
          <Button
            type="button"
            variant="default"
            disabled={!canGoNext}
            onClick={onNextPage}
            className={`w-full sm:w-auto ${historyNeutralButtonClass}`}
          >
            <span className="!text-zinc-100">Berikutnya</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
