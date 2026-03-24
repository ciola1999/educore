import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HistoryLogList } from "./history-log-list";

describe("HistoryLogList", () => {
  it("renders all records with formatted status and time labels", () => {
    const formatStatusLabel = vi.fn((status: string) =>
      status === "LATE" ? "Terlambat" : "Hadir",
    );
    const formatTime = vi.fn((value: string | Date | null) =>
      value ? "07:00" : "-",
    );

    render(
      <HistoryLogList
        density="comfortable"
        formatStatusLabel={formatStatusLabel}
        formatTime={formatTime}
        logs={[
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
          {
            id: "log-2",
            studentId: "student-2",
            snapshotStudentName: "Siti Aisyah",
            snapshotStudentNis: "2324.10.002",
            className: "X-A",
            date: "2026-03-24",
            checkInTime: "2026-03-24T07:20:00.000Z",
            checkOutTime: null,
            status: "LATE",
            lateDuration: 20,
            syncStatus: "synced",
            source: "qr",
          },
        ]}
      />,
    );

    expect(screen.getByText("Budi Santoso")).toBeInTheDocument();
    expect(screen.getByText("Siti Aisyah")).toBeInTheDocument();
    expect(screen.getByText("Hadir")).toBeInTheDocument();
    expect(screen.getByText("Terlambat")).toBeInTheDocument();
    expect(formatStatusLabel).toHaveBeenCalledTimes(2);
    expect(formatTime).toHaveBeenCalledTimes(4);
  });
});
