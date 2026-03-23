import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useAuthMock = vi.hoisted(() => vi.fn());
const useAppNavigationMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-auth", () => ({
  useAuth: useAuthMock,
}));

vi.mock("@/hooks/use-app-navigation", () => ({
  useAppNavigation: useAppNavigationMock,
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
  const replaceMock = vi.fn();

  useAppNavigationMock.mockReturnValue({
    pathname: "/dashboard/attendance",
    router: { replace: replaceMock },
    searchParams: new URLSearchParams(),
  });

  it("hides QR and manual sections for read-only attendance roles", () => {
    replaceMock.mockReset();
    useAuthMock.mockReturnValue({
      user: { role: "student" },
    });

    render(<AttendancePageClient />);

    expect(screen.getByText("Daily Log Mock")).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /Log Absensi/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("QR Attendance")).not.toBeInTheDocument();
    expect(screen.getByText("Mode Read Only")).toBeInTheDocument();
  });

  it("switches attendance content through menu tabs for write-enabled roles", () => {
    replaceMock.mockReset();
    useAuthMock.mockReturnValue({
      user: { role: "teacher" },
    });

    render(<AttendancePageClient />);

    expect(screen.getByText("QR Scanner Mock")).toBeInTheDocument();
    expect(screen.queryByText("Attendance Form Mock")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Input Manual/i }));
    expect(screen.getByText("Attendance Form Mock")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Schedule Settings/i }));
    expect(screen.getByText("Schedule Settings Mock")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Holiday Manager/i }));
    expect(screen.getByText("Holiday Manager Mock")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Log Absensi/i }));
    expect(screen.getByText("Daily Log Mock")).toBeInTheDocument();
    expect(screen.getByText("Akses Tulis Aktif")).toBeInTheDocument();
  });
});
