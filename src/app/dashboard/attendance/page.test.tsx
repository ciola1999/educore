import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.hoisted(() => vi.fn());
const useAppNavigationMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());
const ensureAppWarmupMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-auth", () => ({
  useAuth: useAuthMock,
}));

vi.mock("@/hooks/use-app-navigation", () => ({
  useAppNavigation: useAppNavigationMock,
}));

vi.mock("@/lib/api/request", () => ({
  apiPost: apiPostMock,
}));

vi.mock("@/lib/runtime/app-bootstrap", () => ({
  ensureAppWarmup: ensureAppWarmupMock,
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
    apiPostMock.mockReset();
    ensureAppWarmupMock.mockReset();
    window.sessionStorage.clear();
    apiPostMock.mockResolvedValue({
      classCreated: 0,
      studentUpserted: 0,
      settingsSeeded: 0,
    });
    ensureAppWarmupMock.mockResolvedValue(undefined);
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

  it("hides QR and manual sections for read-only attendance roles", async () => {
    replaceMock.mockReset();
    setNavigation();
    useAuthMock.mockReturnValue({
      user: { role: "student" },
    });

    render(<AttendancePageClient />);

    expect(
      await screen.findByText("Daily Log Mock", {}, { timeout: 10000 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /Log Absensi/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("QR Attendance")).not.toBeInTheDocument();
    expect(screen.getByText("Mode Baca Saja")).toBeInTheDocument();
    expect(screen.getByText("Analitik Saja")).toBeInTheDocument();
    expect(apiPostMock).toHaveBeenCalledWith("/api/attendance/projection-sync");
  }, 10000);

  it("switches attendance content through menu tabs for write-enabled roles", async () => {
    replaceMock.mockReset();
    setNavigation();
    useAuthMock.mockReturnValue({
      user: { role: "teacher" },
    });

    render(<AttendancePageClient />);

    expect(
      await screen.findByText("QR Scanner Mock", {}, { timeout: 10000 }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Attendance Form Mock")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Input Manual/i }));
    expect(await screen.findByText("Attendance Form Mock")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Pengaturan Jadwal/i }));
    expect(
      await screen.findByText("Schedule Settings Mock"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Kelola Hari Libur/i }));
    expect(await screen.findByText("Holiday Manager Mock")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Log Absensi/i }));
    expect(await screen.findByText("Daily Log Mock")).toBeInTheDocument();
    expect(screen.getByText("Akses Tulis Aktif")).toBeInTheDocument();
  }, 10000);

  it("opens the requested section from search params", async () => {
    replaceMock.mockReset();
    setNavigation("section=manual");
    useAuthMock.mockReturnValue({
      user: { role: "teacher" },
    });

    render(<AttendancePageClient />);

    expect(await screen.findByText("Attendance Form Mock")).toBeInTheDocument();
    expect(screen.queryByText("QR Scanner Mock")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Input Manual/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getAllByText("Section Aktif").length).toBeGreaterThan(0);
  });

  it("uses localized section labels in the shell", async () => {
    replaceMock.mockReset();
    setNavigation();
    useAuthMock.mockReturnValue({
      user: { role: "teacher" },
    });

    render(<AttendancePageClient />);

    expect(
      await screen.findByText("QR Scanner Mock", {}, { timeout: 10000 }),
    ).toBeInTheDocument();

    expect(screen.getAllByText("Section Aktif").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("tablist", { name: "Section attendance" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Web + Desktop")).toBeInTheDocument();
  });

  it("syncs selected section back to the url when menu changes", async () => {
    replaceMock.mockReset();
    setNavigation();
    useAuthMock.mockReturnValue({
      user: { role: "teacher" },
    });

    render(<AttendancePageClient />);

    expect(
      await screen.findByText("QR Scanner Mock", {}, { timeout: 10000 }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Input Manual/i }));

    expect(replaceMock).toHaveBeenCalledWith(
      "/dashboard/attendance?section=manual",
      { scroll: false },
    );
  });

  it("shows recovery warning when attendance bootstrap sync fails", async () => {
    replaceMock.mockReset();
    setNavigation();
    useAuthMock.mockReturnValue({
      user: { role: "teacher" },
    });
    apiPostMock.mockRejectedValueOnce(new Error("Projection sync unavailable"));

    render(<AttendancePageClient />);

    expect(
      await screen.findByText("Bootstrap attendance perlu perhatian"),
    ).toBeInTheDocument();
    expect(screen.getByText("Projection sync unavailable")).toBeInTheDocument();
  });
});
