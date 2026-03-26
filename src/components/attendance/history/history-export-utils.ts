import type {
  HistoryFilterStatus,
  HistorySourceFilter,
  StudentOption,
} from "./history-types";

type AttendanceHistoryQueryParamsOptions = {
  exportData?: boolean;
  analyticsBundle?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: string;
  studentId?: string | null;
  searchQuery?: string;
  status?: HistoryFilterStatus;
  source?: HistorySourceFilter;
  startDate?: string;
  endDate?: string;
  className?: string;
};

export function buildAttendanceHistoryQueryParams(
  options: AttendanceHistoryQueryParamsOptions,
) {
  const params = new URLSearchParams();

  if (options.exportData) {
    params.set("export", "true");
  }
  if (typeof options.limit === "number") {
    params.set("limit", String(options.limit));
  }
  if (typeof options.offset === "number") {
    params.set("offset", String(options.offset));
  }
  if (options.sortBy) {
    params.set("sortBy", options.sortBy);
  }
  if (options.studentId) {
    params.set("studentId", options.studentId);
  }
  if (options.searchQuery?.trim()) {
    params.set("searchQuery", options.searchQuery.trim());
  }
  if (options.status && options.status !== "all") {
    params.set("status", options.status);
  }
  if (options.source && options.source !== "all") {
    params.set("source", options.source);
  }
  if (options.startDate) {
    params.set("startDate", options.startDate);
  }
  if (options.endDate) {
    params.set("endDate", options.endDate);
  }
  if (options.className && options.className !== "all") {
    params.set("className", options.className);
  }
  if (options.analyticsBundle) {
    params.set("analyticsBundle", "true");
  }

  return params;
}

export function getAttendanceHistoryStudentLabel(
  selectedHistoryStudentId: string,
  historyStudentOptions: StudentOption[],
) {
  if (selectedHistoryStudentId === "all") {
    return "all-students";
  }

  return (
    historyStudentOptions.find(
      (student) => student.id === selectedHistoryStudentId,
    )?.nis || selectedHistoryStudentId
  );
}

function sanitizeAttendanceHistoryFileSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function buildAttendanceHistoryFileScope(options: {
  selectedHistoryStudentId: string;
  historyStudentOptions: StudentOption[];
  startDate: string;
  endDate: string;
  source: string;
  status: string;
  className?: string;
}) {
  const studentLabel = getAttendanceHistoryStudentLabel(
    options.selectedHistoryStudentId,
    options.historyStudentOptions,
  );

  return [
    sanitizeAttendanceHistoryFileSegment(studentLabel) || "all-students",
    sanitizeAttendanceHistoryFileSegment(options.startDate || "all") || "all",
    sanitizeAttendanceHistoryFileSegment(options.endDate || "all") || "all",
    sanitizeAttendanceHistoryFileSegment(options.className || "all-classes") ||
      "all-classes",
    sanitizeAttendanceHistoryFileSegment(options.source || "all") || "all",
    sanitizeAttendanceHistoryFileSegment(options.status || "all") || "all",
  ].join("-");
}

export function escapeAttendanceHistoryHtml(
  value: string | number | null | undefined,
) {
  return String(value ?? "-")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
