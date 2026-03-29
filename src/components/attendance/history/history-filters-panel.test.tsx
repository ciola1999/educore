import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HistoryFiltersPanel } from "./history-filters-panel";

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) => (
    <div data-value={value}>
      {children}
      <button type="button" onClick={() => onValueChange?.("manual")}>
        select-manual
      </button>
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectItem: ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => <div data-value={value}>{children}</div>,
  SelectTrigger: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span>{placeholder ?? "selected"}</span>
  ),
}));

describe("HistoryFiltersPanel", () => {
  const baseProps = {
    isStudentView: false,
    isAdminView: true,
    activeHistoryFilterCount: 3,
    hasHistoryFiltersActive: true,
    historyDensity: "comfortable" as const,
    showHistoryAdvancedFilters: false,
    historySearch: "",
    historyStudentSearch: "",
    historyStudentOptions: [
      {
        id: "student-1",
        fullName: "Budi Santoso",
        nis: "2324.10.001",
        grade: "X-A",
      },
    ],
    selectedHistoryStudentId: "all",
    loadingStudentOptions: false,
    historyStatus: "all" as const,
    historySource: "all" as const,
    historyGroupBy: "none" as const,
    historySort: "latest",
    historyStartDate: "",
    historyEndDate: "",
    error: null,
    dateRangeInvalid: false,
    onHistoryDensityChange: vi.fn(),
    onToggleAdvancedFilters: vi.fn(),
    onResetAllFilters: vi.fn(),
    onHistorySearchChange: vi.fn(),
    onHistoryStudentSearchChange: vi.fn(),
    onSelectedHistoryStudentIdChange: vi.fn(),
    onHistoryStatusChange: vi.fn(),
    onHistorySourceChange: vi.fn(),
    onHistoryGroupByChange: vi.fn(),
    onHistorySortChange: vi.fn(),
    onHistoryStartDateChange: vi.fn(),
    onHistoryEndDateChange: vi.fn(),
    onApplyQuickRange: vi.fn(),
    isQuickRangeActive: vi.fn((range: string) => range === "today"),
    onResetInvalidFilterState: vi.fn(),
  };

  beforeEach(() => {
    Object.values(baseProps).forEach((value) => {
      if (typeof value === "function" && "mockReset" in value) {
        value.mockReset();
      }
    });
    baseProps.isQuickRangeActive.mockImplementation(
      (range: string) => range === "today",
    );
  });

  it("wires density, advanced filters, reset, and quick range actions", () => {
    render(<HistoryFiltersPanel {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /Ringkas/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Tampilkan Filter Lanjutan/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Reset Semua Filter/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /7 Hari/i }));

    expect(baseProps.onHistoryDensityChange).toHaveBeenCalledWith("compact");
    expect(baseProps.onToggleAdvancedFilters).toHaveBeenCalledTimes(1);
    expect(baseProps.onResetAllFilters).toHaveBeenCalledTimes(1);
    expect(baseProps.onApplyQuickRange).toHaveBeenCalledWith("7d");
  });

  it("updates search fields and admin student selector", () => {
    render(<HistoryFiltersPanel {...baseProps} />);

    expect(
      screen.getByText("Budi Santoso - X-A • 2324.10.001"),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Cari nama atau NIS siswa/i), {
      target: { value: "budi" },
    });
    fireEvent.change(screen.getByLabelText(/Cari siswa spesifik/i), {
      target: { value: "2324" },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: /select-manual/i })[0],
    );

    expect(baseProps.onHistorySearchChange).toHaveBeenCalledWith("budi");
    expect(baseProps.onHistoryStudentSearchChange).toHaveBeenCalledWith("2324");
    expect(baseProps.onSelectedHistoryStudentIdChange).toHaveBeenCalledWith(
      "manual",
    );
  });

  it("shows advanced filters and invalid filter recovery when enabled", () => {
    render(
      <HistoryFiltersPanel
        {...baseProps}
        showHistoryAdvancedFilters
        error="Rentang tanggal tidak valid"
        dateRangeInvalid
      />,
    );

    fireEvent.change(screen.getByLabelText(/Tanggal mulai riwayat/i), {
      target: { value: "2026-03-01" },
    });
    fireEvent.change(screen.getByLabelText(/Tanggal akhir riwayat/i), {
      target: { value: "2026-03-31" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Reset Filter Riwayat/i }),
    );

    expect(baseProps.onHistoryStartDateChange).toHaveBeenCalledWith(
      "2026-03-01",
    );
    expect(baseProps.onHistoryEndDateChange).toHaveBeenCalledWith("2026-03-31");
    expect(baseProps.onResetInvalidFilterState).toHaveBeenCalledTimes(1);
  });
});
