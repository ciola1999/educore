import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}));

const storeState = {
  user: { id: "teacher-1" },
};

vi.mock("@/lib/api/request", () => ({
  apiGet: apiGetMock,
  apiPost: apiPostMock,
}));

vi.mock("@/lib/store/use-store", () => ({
  useStore: (selector: (state: typeof storeState) => unknown) =>
    selector(storeState),
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

import { type StudentRecord, useAttendanceForm } from "./use-attendance-form";

function createStudent(overrides?: Partial<StudentRecord>): StudentRecord {
  return {
    id: "student-1",
    nis: "2324.10.001",
    nisn: "00998877",
    fullName: "Budi Santoso",
    grade: "X-A",
    tempatLahir: null,
    tanggalLahir: null,
    alamat: null,
    parentName: null,
    parentPhone: null,
    status: "alpha",
    notes: "",
    isLocked: false,
    checkInTime: null,
    checkOutTime: null,
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe("useAttendanceForm", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    toastMock.error.mockReset();
    toastMock.success.mockReset();
    toastMock.warning.mockReset();
    toastMock.info.mockReset();
    storeState.user = { id: "teacher-1" };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("posts only filtered unlocked students and refreshes after successful save", async () => {
    apiGetMock.mockImplementation((url: string) => {
      if (url === "/api/attendance/classes") {
        return Promise.resolve([{ id: "class-xa", name: "X-A" }]);
      }

      if (url.startsWith("/api/attendance/students?")) {
        return Promise.resolve([
          createStudent({
            id: "student-visible-editable",
            fullName: "Tes Manual",
            nis: "2001",
            status: "permission",
            notes: "visible",
          }),
          createStudent({
            id: "student-visible-locked",
            fullName: "Tes Manual Locked",
            nis: "2002",
            status: "alpha",
            notes: "locked",
            isLocked: true,
          }),
          createStudent({
            id: "student-hidden",
            fullName: "Tidak Cocok Search",
            nis: "2003",
            status: "sick",
            notes: "hidden",
          }),
        ]);
      }

      throw new Error(`Unexpected apiGet url: ${url}`);
    });
    apiPostMock.mockResolvedValue({
      success: true,
      partial: false,
      message: "Absensi tersimpan",
      successCount: 1,
      failedCount: 0,
      totalRecords: 1,
      failures: [],
    });

    const { result } = renderHook(() =>
      useAttendanceForm({ initialDate: "2026-04-07" }),
    );

    await waitFor(() => {
      expect(result.current.selectedClass).toBe("class-xa");
      expect(result.current.studentList).toHaveLength(3);
    });

    act(() => {
      result.current.setSearchQuery("Tes Manual");
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(apiPostMock).toHaveBeenCalledWith("/api/attendance/bulk", {
      classId: "class-xa",
      date: "2026-04-07",
      records: [
        {
          studentId: "student-visible-editable",
          status: "permission",
          notes: "visible",
        },
      ],
    });
    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledTimes(3);
      expect(result.current.submitSummary).toEqual({
        tone: "success",
        title: "Attendance berhasil disimpan",
        description: "Absensi tersimpan",
        failedStudents: [],
      });
    });
  });

  it("does not submit when the active search matches no students", async () => {
    apiGetMock.mockImplementation((url: string) => {
      if (url === "/api/attendance/classes") {
        return Promise.resolve([{ id: "class-xa", name: "X-A" }]);
      }

      return Promise.resolve([
        createStudent({ id: "student-1", fullName: "Budi Santoso" }),
      ]);
    });

    const { result } = renderHook(() =>
      useAttendanceForm({ initialDate: "2026-04-07" }),
    );

    await waitFor(() => {
      expect(result.current.studentList).toHaveLength(1);
    });

    act(() => {
      result.current.setSearchQuery("zzz");
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(apiPostMock).not.toHaveBeenCalled();
    expect(result.current.submitSummary).toBeNull();
  });

  it("does not submit when all matching students are locked", async () => {
    apiGetMock.mockImplementation((url: string) => {
      if (url === "/api/attendance/classes") {
        return Promise.resolve([{ id: "class-xa", name: "X-A" }]);
      }

      return Promise.resolve([
        createStudent({
          id: "student-locked",
          fullName: "Tes Manual Locked",
          nis: "2002",
          isLocked: true,
        }),
      ]);
    });

    const { result } = renderHook(() =>
      useAttendanceForm({ initialDate: "2026-04-07" }),
    );

    await waitFor(() => {
      expect(result.current.studentList).toHaveLength(1);
    });

    act(() => {
      result.current.setSearchQuery("Tes Manual");
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(apiPostMock).not.toHaveBeenCalled();
    expect(result.current.submitSummary).toBeNull();
  });

  it("maps partial failures back to student names", async () => {
    apiGetMock.mockImplementation((url: string) => {
      if (url === "/api/attendance/classes") {
        return Promise.resolve([{ id: "class-xa", name: "X-A" }]);
      }

      return Promise.resolve([
        createStudent({
          id: "student-1",
          fullName: "Budi Santoso",
          status: "alpha",
        }),
      ]);
    });
    apiPostMock.mockResolvedValue({
      success: true,
      partial: true,
      message: "Absensi tersimpan untuk 0 siswa, 1 siswa gagal diproses",
      successCount: 0,
      failedCount: 1,
      totalRecords: 1,
      failures: [
        {
          studentId: "student-1",
          message: "Gagal menyimpan absensi siswa ini",
        },
      ],
    });

    const { result } = renderHook(() =>
      useAttendanceForm({ initialDate: "2026-04-07" }),
    );

    await waitFor(() => {
      expect(result.current.studentList).toHaveLength(1);
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    await waitFor(() => {
      expect(result.current.submitSummary?.tone).toBe("warning");
    });

    expect(result.current.submitSummary?.failedStudents).toEqual([
      {
        studentId: "student-1",
        studentName: "Budi Santoso",
        message: "Gagal menyimpan absensi siswa ini",
      },
    ]);
    expect(result.current.submitSummary?.description).toBe(
      "Absensi tersimpan untuk 0 siswa, 1 siswa gagal diproses",
    );
  });

  it("keeps locked rows unchanged when setting all students present", async () => {
    apiGetMock.mockImplementation((url: string) => {
      if (url === "/api/attendance/classes") {
        return Promise.resolve([{ id: "class-xa", name: "X-A" }]);
      }

      return Promise.resolve([
        createStudent({
          id: "student-editable",
          status: "alpha",
          isLocked: false,
        }),
        createStudent({
          id: "student-locked",
          status: "sick",
          isLocked: true,
        }),
      ]);
    });

    const { result } = renderHook(() =>
      useAttendanceForm({ initialDate: "2026-04-07" }),
    );

    await waitFor(() => {
      expect(result.current.studentList).toHaveLength(2);
    });

    act(() => {
      result.current.setAllPresent();
    });

    expect(result.current.studentList).toEqual([
      expect.objectContaining({
        id: "student-editable",
        status: "present",
      }),
      expect.objectContaining({
        id: "student-locked",
        status: "sick",
      }),
    ]);
  });

  it("ignores stale roster responses when class changes quickly", async () => {
    const firstRoster = deferred<StudentRecord[]>();
    const secondRoster = deferred<StudentRecord[]>();

    apiGetMock.mockImplementation((url: string) => {
      if (url === "/api/attendance/classes") {
        return Promise.resolve([
          { id: "class-a", name: "X-A" },
          { id: "class-b", name: "X-B" },
        ]);
      }

      if (url.includes("classId=class-a")) {
        return firstRoster.promise as Promise<unknown>;
      }

      if (url.includes("classId=class-b")) {
        return secondRoster.promise as Promise<unknown>;
      }

      throw new Error(`Unexpected apiGet url: ${url}`);
    });

    const { result } = renderHook(() =>
      useAttendanceForm({ initialDate: "2026-04-07" }),
    );

    await waitFor(() => {
      expect(result.current.selectedClass).toBe("class-a");
    });

    act(() => {
      result.current.setSelectedClass("class-b");
    });

    await act(async () => {
      secondRoster.resolve([
        createStudent({ id: "student-b", fullName: "Student B", grade: "X-B" }),
      ]);
      await secondRoster.promise;
    });

    await waitFor(() => {
      expect(result.current.studentList[0]?.id).toBe("student-b");
    });

    await act(async () => {
      firstRoster.resolve([
        createStudent({ id: "student-a", fullName: "Student A", grade: "X-A" }),
      ]);
      await firstRoster.promise;
    });

    expect(result.current.studentList[0]?.id).toBe("student-b");
  });
});
