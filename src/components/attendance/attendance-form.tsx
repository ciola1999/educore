"use client";

import { Button } from "@/components/ui/button";
import { useAttendanceForm } from "@/hooks/use-attendance-form";
import type { AttendanceStatus } from "@/lib/validations/schemas";
import { CalendarDays, Check, Loader2 } from "lucide-react";

export function AttendanceForm() {
  const {
    isMounted,
    loading,
    submitting,
    studentList,
    selectedDate,
    setSelectedDate,
    selectedClass,
    setSelectedClass,
    classList,
    updateStatus,
    setAllPresent,
    handleSubmit,
  } = useAttendanceForm();

  if (!isMounted) return null;

  if (loading && classList.length === 0) {
    return (
      <div className="flex justify-center items-center py-20 text-zinc-500">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const statusColors: Record<AttendanceStatus, string> = {
    present: "bg-emerald-600 hover:bg-emerald-500",
    sick: "bg-yellow-600 hover:bg-yellow-500",
    permission: "bg-blue-600 hover:bg-blue-500",
    alpha: "bg-red-600 hover:bg-red-500",
  };

  const statusLabels: Record<AttendanceStatus, string> = {
    present: "P",
    sick: "S",
    permission: "I",
    alpha: "A",
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-zinc-800/50">
            <CalendarDays className="h-5 w-5 text-zinc-400" />
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-zinc-400 text-sm font-medium">Class:</span>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500 transition-all min-w-[140px]"
          >
            {classList.length === 0 ? (
              <option value="">No classes available</option>
            ) : (
              classList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))
            )}
          </select>
        </div>
        <div className="sm:ml-auto flex gap-2">
          <Button
            onClick={setAllPresent}
            variant="outline"
            size="sm"
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 rounded-lg px-4"
          >
            <Check className="h-4 w-4 mr-2" /> All Present
          </Button>
        </div>
      </div>

      {classList.length === 0 && (
        <div className="text-center py-20 text-zinc-500 bg-zinc-900/30 rounded-2xl border border-dashed border-zinc-800">
          <p className="mb-2 italic">No classes found.</p>
          <p className="text-sm">
            Please add classes first in{" "}
            <span className="text-blue-400 hover:underline cursor-pointer">
              Courses
            </span>{" "}
            menu.
          </p>
        </div>
      )}

      {classList.length > 0 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-xs font-medium text-zinc-400 uppercase tracking-wider px-1">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-600"></span>{" "}
              Present
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-yellow-600"></span> Sick
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-600"></span>{" "}
              Permission
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-600"></span> Alpha
            </span>
          </div>

          {/* Student List */}
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-blue-500/50" />
            </div>
          ) : (
            <div className="grid gap-3">
              {studentList.map((student, idx) => (
                <div
                  key={student.id}
                  className="group flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/50 hover:bg-zinc-800/50 hover:border-zinc-700 transition-all duration-200"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <span className="w-6 text-zinc-600 text-xs font-mono font-bold">
                      {(idx + 1).toString().padStart(2, "0")}
                    </span>
                    <div className="flex flex-col">
                      <span className="font-mono text-xs text-blue-400 font-semibold mb-0.5">
                        {student.nis}
                      </span>
                      <span className="text-zinc-100 font-medium tracking-tight">
                        {student.fullName}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2 border-t sm:border-t-0 border-zinc-800/50 pt-3 sm:pt-0">
                    <span className="sm:hidden text-xs text-zinc-500 font-medium">
                      Status:
                    </span>
                    <div className="flex gap-1.5 p-1 rounded-lg bg-zinc-950/50 border border-zinc-800">
                      {(
                        [
                          "present",
                          "sick",
                          "permission",
                          "alpha",
                        ] as AttendanceStatus[]
                      ).map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => updateStatus(student.id, status)}
                          title={
                            status.charAt(0).toUpperCase() + status.slice(1)
                          }
                          className={`w-9 h-9 sm:w-8 sm:h-8 rounded-md text-xs font-bold transition-all duration-200 ${
                            student.status === status
                              ? `${statusColors[status]} text-white shadow-lg shadow-${statusColors[status].split("-")[1]}-500/20 scale-105 sm:scale-110`
                              : "bg-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                          }`}
                        >
                          {statusLabels[status]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {studentList.length === 0 && !loading && (
            <div className="text-center py-20 text-zinc-500 bg-zinc-900/20 rounded-2xl border border-zinc-800/50">
              <p className="italic">No students found in this class.</p>
              <p className="text-sm mt-1">
                Make sure student's Grade matches the class name.
              </p>
            </div>
          )}

          {/* Submit Button */}
          {studentList.length > 0 && (
            <div className="flex justify-end pt-6 border-t border-zinc-800/50 mt-4">
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-6 px-8 rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 gap-3 min-w-[200px]"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Check className="h-5 w-5" />
                )}
                Save Attendance
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
