import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useAuthMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-auth", () => ({
  useAuth: useAuthMock,
}));

vi.mock("@/components/attendance/attendance-form", () => ({
  AttendanceForm: () => <div>Attendance Form Mock</div>,
}));

vi.mock("@/components/attendance/qr-scanner-view", () => ({
  QRScannerView: () => <div>QR Scanner Mock</div>,
}));

vi.mock("@/components/attendance/daily-log-view", () => ({
  DailyLogView: () => <div>Daily Log Mock</div>,
}));

vi.mock("@/components/attendance/schedule-settings", () => ({
  ScheduleSettings: () => <div>Schedule Settings Mock</div>,
}));

vi.mock("@/components/attendance/holiday-manager", () => ({
  HolidayManager: () => <div>Holiday Manager Mock</div>,
}));

import { AttendancePageClient } from "./attendance-page-client";

describe("AttendancePageClient", () => {
  it("hides QR and manual sections for read-only attendance roles", () => {
    useAuthMock.mockReturnValue({
      user: { role: "student" },
    });

    render(<AttendancePageClient />);

    expect(screen.queryByText("QR Scanner Mock")).not.toBeInTheDocument();
    expect(screen.queryByText("Attendance Form Mock")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Schedule Settings Mock"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Holiday Manager Mock")).not.toBeInTheDocument();
    expect(screen.getByText("Daily Log Mock")).toBeInTheDocument();
    expect(screen.getByText("Mode Read Only")).toBeInTheDocument();
  });

  it("shows QR and manual sections for write-enabled attendance roles", () => {
    useAuthMock.mockReturnValue({
      user: { role: "teacher" },
    });

    render(<AttendancePageClient />);

    expect(screen.getByText("QR Scanner Mock")).toBeInTheDocument();
    expect(screen.getByText("Attendance Form Mock")).toBeInTheDocument();
    expect(screen.getByText("Schedule Settings Mock")).toBeInTheDocument();
    expect(screen.getByText("Holiday Manager Mock")).toBeInTheDocument();
    expect(screen.getByText("Daily Log Mock")).toBeInTheDocument();
    expect(screen.getByText("Akses Tulis Aktif")).toBeInTheDocument();
  });
});
