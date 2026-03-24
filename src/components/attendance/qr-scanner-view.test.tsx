import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());
const isTauriMock = vi.hoisted(() => vi.fn(() => false));
const useQrAttendanceMock = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.mock("@/core/env", () => ({
  isTauri: isTauriMock,
}));

vi.mock("@/hooks/use-attendance", () => ({
  useQrAttendance: useQrAttendanceMock,
}));

import { QRScannerView } from "./qr-scanner-view";

describe("QRScannerView", () => {
  beforeEach(() => {
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    isTauriMock.mockReturnValue(false);
    useQrAttendanceMock.mockReset();
  });

  function createQrAttendanceState(
    overrides?: Partial<ReturnType<typeof useQrAttendanceMock>>,
  ) {
    return {
      submitting: false,
      loadingLogs: false,
      logs: [],
      lastResult: null,
      loadTodayLogs: vi.fn(),
      submitQrScan: vi.fn(),
      ...overrides,
    };
  }

  it("shows an error toast when manual fallback is submitted without payload", async () => {
    const hookState = createQrAttendanceState();
    useQrAttendanceMock.mockReturnValue(hookState);

    render(<QRScannerView />);

    fireEvent.click(screen.getByRole("button", { name: /Proses QR/i }));

    expect(screen.getByLabelText(/Input QR manual/i)).toHaveValue("");
    expect(hookState.submitQrScan).not.toHaveBeenCalled();
  });

  it("submits trimmed manual payload and clears the textarea after success", async () => {
    const hookState = createQrAttendanceState({
      submitQrScan: vi.fn().mockResolvedValue({
        success: true,
        message: "Scan berhasil",
        type: "CHECK_IN",
      }),
    });
    useQrAttendanceMock.mockReturnValue(hookState);

    render(<QRScannerView />);

    const input = screen.getByLabelText(/Input QR manual/i);
    fireEvent.change(input, {
      target: { value: '   {"nis":"2324.10.001"}   ' },
    });
    fireEvent.click(screen.getByRole("button", { name: /Proses QR/i }));

    await waitFor(() => {
      expect(hookState.submitQrScan).toHaveBeenCalledWith(
        '{"nis":"2324.10.001"}',
      );
    });
    await waitFor(() => {
      expect(screen.getByLabelText(/Input QR manual/i)).toHaveValue("");
    });
  });

  it("renders scan result details and refreshes today logs on demand", async () => {
    const hookState = createQrAttendanceState({
      lastResult: {
        success: true,
        message: "Check-in berhasil",
        type: "CHECK_IN",
        data: {
          fullName: "Budi Santoso",
          nis: "2324.10.001",
          grade: "X-A",
          time: "07:10",
          status: "on-time",
          type: "in",
          lateMinutes: 0,
        },
      },
      logs: [
        {
          id: "log-1",
          studentId: "student-1",
          snapshotStudentName: "Budi Santoso",
          snapshotStudentNis: "2324.10.001",
          date: "2026-03-24",
          checkInTime: "2026-03-24T07:10:00.000Z",
          checkOutTime: null,
          status: "PRESENT",
          lateDuration: null,
          syncStatus: "synced",
        },
      ],
    });
    useQrAttendanceMock.mockReturnValue(hookState);

    render(<QRScannerView />);

    expect(screen.getByText("Check-in berhasil")).toBeInTheDocument();
    expect(
      screen.getByText("Tersimpan dan log diperbarui"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Budi Santoso")).toHaveLength(2);
    expect(screen.getByText("Hadir")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Muat Ulang/i }));

    await waitFor(() => {
      expect(hookState.loadTodayLogs).toHaveBeenCalledTimes(1);
    });
  });
});
