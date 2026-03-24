import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HistoryGroupedLogList } from "./history-grouped-log-list";

describe("HistoryGroupedLogList", () => {
  it("renders date groups with record counts and entries", () => {
    render(
      <HistoryGroupedLogList
        groupBy="date"
        density="comfortable"
        formatStatusLabel={vi.fn(() => "Hadir")}
        formatTime={vi.fn(() => "07:00")}
        groups={[
          {
            title: "2026-03-24",
            items: [
              {
                id: "log-1",
                studentId: "student-1",
                snapshotStudentName: "Budi Santoso",
                snapshotStudentNis: "2324.10.001",
                className: "X-A",
                date: "2026-03-24",
                checkInTime: "2026-03-24T07:00:00.000Z",
                checkOutTime: null,
                status: "PRESENT",
                lateDuration: null,
                syncStatus: "synced",
                source: "manual",
              },
            ],
          },
          {
            title: "2026-03-23",
            items: [
              {
                id: "log-2",
                studentId: "student-2",
                snapshotStudentName: "Siti Aisyah",
                snapshotStudentNis: "2324.10.002",
                className: "X-B",
                date: "2026-03-23",
                checkInTime: "2026-03-23T07:00:00.000Z",
                checkOutTime: null,
                status: "PRESENT",
                lateDuration: null,
                syncStatus: "pending",
                source: "qr",
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText(/Tanggal 2026-03-24/i)).toBeInTheDocument();
    expect(screen.getByText(/Tanggal 2026-03-23/i)).toBeInTheDocument();
    expect(screen.getAllByText(/1 record/i)).toHaveLength(2);
    expect(screen.getByText("Budi Santoso")).toBeInTheDocument();
    expect(screen.getByText("Siti Aisyah")).toBeInTheDocument();
  });

  it("renders class groups with class label header", () => {
    render(
      <HistoryGroupedLogList
        groupBy="class"
        density="compact"
        formatStatusLabel={vi.fn(() => "Alpha")}
        formatTime={vi.fn(() => "-")}
        groups={[
          {
            title: "XI-IPA-1",
            items: [
              {
                id: "log-3",
                studentId: "student-3",
                snapshotStudentName: "Dewi Lestari",
                snapshotStudentNis: "2324.10.003",
                className: "XI-IPA-1",
                date: "2026-03-24",
                checkInTime: null,
                checkOutTime: null,
                status: "ABSENT",
                lateDuration: null,
                syncStatus: "error",
                source: "manual",
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText(/Kelas XI-IPA-1/i)).toBeInTheDocument();
    expect(screen.getByText("Dewi Lestari")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });
});
