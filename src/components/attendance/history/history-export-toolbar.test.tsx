import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HistoryExportToolbar } from "./history-export-toolbar";

describe("HistoryExportToolbar", () => {
  it("wires export, print, reset date, and pagination actions", () => {
    const props = {
      historyLogsLength: 25,
      historyTotal: 120,
      historyStartDate: "2026-03-01",
      historyEndDate: "2026-03-24",
      historyStatus: "all",
      historySource: "qr",
      historyGroupBy: "date",
      exportingHistory: false,
      exportingPdf: false,
      printingReport: false,
      loadingHistory: false,
      canGoPrev: true,
      canGoNext: true,
      onExportHistory: vi.fn(),
      onExportPdf: vi.fn(),
      onPrintReport: vi.fn(),
      onResetDate: vi.fn(),
      onPrevPage: vi.fn(),
      onNextPage: vi.fn(),
    };

    render(<HistoryExportToolbar {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /Ekspor Riwayat/i }));
    fireEvent.click(screen.getByRole("button", { name: /Ekspor PDF/i }));
    fireEvent.click(screen.getByRole("button", { name: /Cetak Laporan/i }));
    fireEvent.click(screen.getByRole("button", { name: /Reset Tanggal/i }));
    fireEvent.click(screen.getByRole("button", { name: /Sebelumnya/i }));
    fireEvent.click(screen.getByRole("button", { name: /Berikutnya/i }));

    expect(props.onExportHistory).toHaveBeenCalledTimes(1);
    expect(props.onExportPdf).toHaveBeenCalledTimes(1);
    expect(props.onPrintReport).toHaveBeenCalledTimes(1);
    expect(props.onResetDate).toHaveBeenCalledTimes(1);
    expect(props.onPrevPage).toHaveBeenCalledTimes(1);
    expect(props.onNextPage).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Menampilkan 25 \/ 120 data/i)).toBeInTheDocument();
    expect(screen.getByText(/Cakupan Rentang aktif/i)).toBeInTheDocument();
    expect(screen.getByText(/Status ALL/i)).toBeInTheDocument();
    expect(screen.getByText(/Sumber QR/i)).toBeInTheDocument();
    expect(screen.getByText(/Kelompok DATE/i)).toBeInTheDocument();
  });

  it("disables actions when history is empty or loading", () => {
    render(
      <HistoryExportToolbar
        historyLogsLength={0}
        historyTotal={0}
        historyStartDate=""
        historyEndDate=""
        historyStatus="all"
        historySource="all"
        historyGroupBy="none"
        exportingHistory={false}
        exportingPdf={false}
        printingReport={false}
        loadingHistory
        canGoPrev={false}
        canGoNext={false}
        onExportHistory={vi.fn()}
        onExportPdf={vi.fn()}
        onPrintReport={vi.fn()}
        onResetDate={vi.fn()}
        onPrevPage={vi.fn()}
        onNextPage={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Ekspor Riwayat/i }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: /Ekspor PDF/i })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Cetak Laporan/i }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: /Sebelumnya/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Berikutnya/i })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /Reset Tanggal/i }),
    ).not.toBeInTheDocument();
  });
});
