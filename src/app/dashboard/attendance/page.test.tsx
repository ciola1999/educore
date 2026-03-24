import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

  beforeEach(() => {
    replaceMock.mockReset();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  function setNavigation(search = "") {
    useAppNavigationMock.mockReturnValue({
      pathname: "/dashboard/attendance",
      router: { replace: replaceMock },
      searchParams: new URLSearchParams(search),
    });
  }

  it("hides QR and manual sections for read-only attendance roles", () => {
    replaceMock.mockReset();
    setNavigation();
    useAuthMock.mockReturnValue({
      user: { role: "student" },
    });

    render(<AttendancePageClient />);

    expect(screen.getByText("Daily Log Mock")).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /Log Absensi/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("QR Attendance")).not.toBeInTheDocument();
    expect(screen.getByText("Mode Baca Saja")).toBeInTheDocument();
    expect(screen.getByText("Analitik Saja")).toBeInTheDocument();
  });

  it("switches attendance content through menu tabs for write-enabled roles", () => {
    replaceMock.mockReset();
    setNavigation();
    useAuthMock.mockReturnValue({
      user: { role: "teacher" },
    });

    render(<AttendancePageClient />);

    expect(screen.getByText("QR Scanner Mock")).toBeInTheDocument();
    expect(screen.queryByText("Attendance Form Mock")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Input Manual/i }));
    expect(screen.getByText("Attendance Form Mock")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Pengaturan Jadwal/i }));
    expect(screen.getByText("Schedule Settings Mock")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Kelola Hari Libur/i }));
    expect(screen.getByText("Holiday Manager Mock")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Log Absensi/i }));
    expect(screen.getByText("Daily Log Mock")).toBeInTheDocument();
    expect(screen.getByText("Akses Tulis Aktif")).toBeInTheDocument();
  });

  it("opens the requested section from search params", () => {
    replaceMock.mockReset();
    setNavigation("section=manual");
    useAuthMock.mockReturnValue({
      user: { role: "teacher" },
    });

    render(<AttendancePageClient />);

    expect(screen.getByText("Attendance Form Mock")).toBeInTheDocument();
    expect(screen.queryByText("QR Scanner Mock")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Input Manual/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getAllByText("Section Aktif").length).toBeGreaterThan(0);
  });

  it("uses localized section labels in the shell", () => {
    replaceMock.mockReset();
    setNavigation();
    useAuthMock.mockReturnValue({
      user: { role: "teacher" },
    });

    render(<AttendancePageClient />);

    expect(screen.getAllByText("Section Aktif").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("tablist", { name: "Section attendance" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Web + Desktop")).toBeInTheDocument();
  });

  it("syncs selected section back to the url when menu changes", () => {
    replaceMock.mockReset();
    setNavigation();
    useAuthMock.mockReturnValue({
      user: { role: "teacher" },
    });

    render(<AttendancePageClient />);

    fireEvent.click(screen.getByRole("tab", { name: /Input Manual/i }));

    expect(replaceMock).toHaveBeenCalledWith(
      "/dashboard/attendance?section=manual",
      { scroll: false },
    );
  });
});
