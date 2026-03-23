export type TodayAttendanceLog = {
  id: string;
  studentId: string;
  snapshotStudentName: string | null;
  snapshotStudentNis: string | null;
  className?: string | null;
  date: string;
  checkInTime: string | Date | null;
  checkOutTime: string | Date | null;
  status: "PRESENT" | "LATE" | "EXCUSED" | "ABSENT";
  lateDuration: number | null;
  notes?: string | null;
  syncStatus: "synced" | "pending" | "error";
  source?: "qr" | "manual";
};

export type HistoryFilterStatus =
  | "all"
  | "present"
  | "late"
  | "sick"
  | "permission"
  | "alpha";

export type HistorySourceFilter = "all" | "qr" | "manual";
export type HistoryGroupBy = "none" | "date" | "class";
export type HistoryQuickRange =
  | "today"
  | "7d"
  | "30d"
  | "month"
  | "all"
  | "custom";
export type HistoryDensity = "comfortable" | "compact";

export type HistoryLogGroup = {
  title: string;
  items: TodayAttendanceLog[];
};

export type StudentOption = {
  id: string;
  fullName: string;
  nis: string;
  grade: string;
};

export type AttendanceHistorySummary = {
  total: number;
  present: number;
  late: number;
  excused: number;
  absent: number;
  qr: number;
  manual: number;
};

export type AttendanceHistoryClassSummary = {
  className: string;
  total: number;
  present: number;
  late: number;
  excused: number;
  absent: number;
  qr: number;
  manual: number;
  attendanceRate: number;
};

export type AttendanceHistoryStudentSummary = {
  studentId: string;
  studentName: string;
  nis: string;
  className: string;
  total: number;
  present: number;
  late: number;
  excused: number;
  absent: number;
  qr: number;
  manual: number;
  attendanceRate: number;
};

export type AttendanceHistoryTrendPoint = {
  label: string;
  period: string;
  total: number;
  present: number;
  late: number;
  excused: number;
  absent: number;
  attendanceRate: number;
};

export type AttendanceHistoryHeatmapPoint = {
  date: string;
  dayLabel: string;
  total: number;
  present: number;
  late: number;
  excused: number;
  absent: number;
  attendanceRate: number;
};

export type AttendanceRiskFollowUpHistoryItem = {
  id: string;
  judul: string;
  pesan: string;
  link: string | null;
  isRead: boolean;
  createdAt: string | Date;
};
