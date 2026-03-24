import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HistoryRecordCard } from "./history-record-card";

describe("HistoryRecordCard", () => {
  it("renders identity, source, class, timing, and notes", () => {
    render(
      <HistoryRecordCard
        density="comfortable"
        statusLabel="Terlambat"
        checkInLabel="07:15"
        checkOutLabel="15:10"
        log={{
          id: "log-1",
          studentId: "student-1",
          snapshotStudentName: "Budi Santoso",
          snapshotStudentNis: "2324.10.001",
          className: "X-A",
          date: "2026-03-24",
          checkInTime: "2026-03-24T07:15:00.000Z",
          checkOutTime: "2026-03-24T15:10:00.000Z",
          status: "LATE",
          lateDuration: 15,
          notes: "Datang setelah apel pagi.",
          syncStatus: "synced",
          source: "qr",
        }}
      />,
    );

    expect(screen.getByText("Budi Santoso")).toBeInTheDocument();
    expect(
      screen.getByText(/2324.10.001 • 2026-03-24 • QR • X-A/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Terlambat")).toBeInTheDocument();
    expect(screen.getByText(/In 07:15 • Out 15:10/i)).toBeInTheDocument();
    expect(screen.getByText(/Terlambat 15 menit/i)).toBeInTheDocument();
    expect(screen.getByText("Catatan")).toBeInTheDocument();
    expect(screen.getByText(/Datang setelah apel pagi./i)).toBeInTheDocument();
  });

  it("falls back cleanly when student identity and notes are missing", () => {
    render(
      <HistoryRecordCard
        density="compact"
        statusLabel="Hadir"
        checkInLabel="-"
        checkOutLabel="-"
        log={{
          id: "log-2",
          studentId: "student-2",
          snapshotStudentName: null,
          snapshotStudentNis: null,
          className: null,
          date: "2026-03-24",
          checkInTime: null,
          checkOutTime: null,
          status: "PRESENT",
          lateDuration: null,
          notes: null,
          syncStatus: "pending",
          source: "manual",
        }}
      />,
    );

    expect(screen.getByText("Siswa")).toBeInTheDocument();
    expect(
      screen.getByText(/- • 2026-03-24 • MANUAL • -/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/In - • Out -/i)).toBeInTheDocument();
    expect(screen.queryByText("Catatan")).not.toBeInTheDocument();
  });
});
