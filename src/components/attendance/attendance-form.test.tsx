import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useAttendanceFormMock = vi.hoisted(() => vi.fn());
const isTauriMock = vi.hoisted(() => vi.fn(() => false));

vi.mock("@/hooks/use-attendance-form", () => ({
  useAttendanceForm: useAttendanceFormMock,
}));

vi.mock("@/core/env", () => ({
  isTauri: isTauriMock,
}));

import { AttendanceForm } from "./attendance-form";

describe("AttendanceForm", () => {
  beforeEach(() => {
    useAttendanceFormMock.mockReset();
    isTauriMock.mockReturnValue(false);
  });

  function createAttendanceFormState(overrides?: Record<string, unknown>) {
    return {
      isMounted: true,
      loading: false,
      submitting: false,
      classLoadError: null,
      studentLoadError: null,
      submitSummary: null,
      studentList: [
        {
          id: "student-1",
          nis: "2324.10.001",
          nisn: "00998877",
          fullName: "Budi Santoso",
          grade: "X-A",
          tempatLahir: "Bandung",
          tanggalLahir: new Date("2010-01-05"),
          alamat: "Jl. Merdeka No. 1",
          parentName: "Sutrisno",
          parentPhone: "08123456789",
          status: "present",
          notes: "",
          isLocked: false,
          checkInTime: null,
          checkOutTime: null,
        },
        {
          id: "student-2",
          nis: "2324.10.002",
          nisn: null,
          fullName: "Siti Aisyah",
          grade: "X-A",
          tempatLahir: null,
          tanggalLahir: null,
          alamat: null,
          parentName: null,
          parentPhone: null,
          status: "alpha",
          notes: "",
          isLocked: true,
          checkInTime: new Date("2026-03-24T07:00:00.000Z"),
          checkOutTime: null,
        },
      ],
      paginatedStudentList: [
        {
          id: "student-1",
          nis: "2324.10.001",
          nisn: "00998877",
          fullName: "Budi Santoso",
          grade: "X-A",
          tempatLahir: "Bandung",
          tanggalLahir: new Date("2010-01-05"),
          alamat: "Jl. Merdeka No. 1",
          parentName: "Sutrisno",
          parentPhone: "08123456789",
          status: "present",
          notes: "",
          isLocked: false,
          checkInTime: null,
          checkOutTime: null,
        },
        {
          id: "student-2",
          nis: "2324.10.002",
          nisn: null,
          fullName: "Siti Aisyah",
          grade: "X-A",
          tempatLahir: null,
          tanggalLahir: null,
          alamat: null,
          parentName: null,
          parentPhone: null,
          status: "alpha",
          notes: "",
          isLocked: true,
          checkInTime: new Date("2026-03-24T07:00:00.000Z"),
          checkOutTime: null,
        },
      ],
      currentPage: 1,
      setCurrentPage: vi.fn(),
      totalPages: 1,
      totalItems: 2,
      itemsPerPage: 25,
      searchQuery: "",
      setSearchQuery: vi.fn(),
      selectedDate: "2026-03-24",
      setSelectedDate: vi.fn(),
      selectedClass: "class-xa",
      setSelectedClass: vi.fn(),
      classList: [
        { id: "all", name: "All Students" },
        { id: "class-xa", name: "X-A" },
      ],
      updateStatus: vi.fn(),
      setAllPresent: vi.fn(),
      handleSubmit: vi.fn(),
      loadClasses: vi.fn(),
      refreshStudents: vi.fn(),
      ...overrides,
    };
  }

  it("wires refresh and bulk-present actions to the attendance hook", () => {
    const hookState = createAttendanceFormState();
    useAttendanceFormMock.mockReturnValue(hookState);

    render(<AttendanceForm />);

    fireEvent.click(screen.getByRole("button", { name: /Muat Ulang/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Tandai Semua Hadir/i }),
    );

    expect(hookState.refreshStudents).toHaveBeenCalledTimes(1);
    expect(hookState.setAllPresent).toHaveBeenCalledTimes(1);
  }, 10000);

  it("toggles compact and detailed view labels from the toolbar", () => {
    useAttendanceFormMock.mockReturnValue(createAttendanceFormState());

    render(<AttendanceForm />);

    const toggleButton = screen.getByRole("button", { name: /Mode Ringkas/i });
    expect(toggleButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(toggleButton);

    expect(
      screen.getByRole("button", { name: /Mode Detail/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the save guard when all students mode is active", () => {
    const hookState = createAttendanceFormState({
      selectedClass: "all",
      totalItems: 2,
    });
    useAttendanceFormMock.mockReturnValue(hookState);

    render(<AttendanceForm />);

    expect(screen.getByText(/Mode baca semua kelas/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Pilih Kelas Untuk Simpan/i }),
    ).toBeDisabled();
  });

  it("shows student class label in manual attendance cards", () => {
    useAttendanceFormMock.mockReturnValue(createAttendanceFormState());

    render(<AttendanceForm />);

    expect(screen.getAllByText("X-A").length).toBeGreaterThan(0);
    expect(screen.getByText("Budi Santoso")).toBeInTheDocument();
  });

  it("submits manual attendance through the primary action when a class is selected", () => {
    const hookState = createAttendanceFormState();
    useAttendanceFormMock.mockReturnValue(hookState);

    render(<AttendanceForm />);

    fireEvent.click(screen.getByRole("button", { name: /Simpan Attendance/i }));

    expect(hookState.handleSubmit).toHaveBeenCalledTimes(1);
  });

  it("renders partial submit summary with retry action when provided by the hook", () => {
    const hookState = createAttendanceFormState({
      submitSummary: {
        tone: "warning",
        title: "Sebagian attendance belum tersimpan",
        description: "Absensi tersimpan untuk 20 siswa, 2 siswa gagal diproses",
        failedStudents: [
          {
            studentId: "student-1",
            studentName: "Budi Santoso",
            message: "Gagal menyimpan absensi siswa ini",
          },
        ],
      },
    });
    useAttendanceFormMock.mockReturnValue(hookState);

    render(<AttendanceForm />);

    expect(
      screen.getByText(/Sebagian attendance belum tersimpan/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Budi Santoso: Gagal menyimpan absensi siswa ini/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Muat Ulang Siswa/i }));

    expect(hookState.refreshStudents).toHaveBeenCalledTimes(1);
  });
});
