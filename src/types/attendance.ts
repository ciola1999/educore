export type AttendanceStatus = "present" | "sick" | "permission" | "alpha";

export type AttendanceSyncStatus = "synced" | "pending" | "error";

export type AttendanceSetting = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  lateThreshold: string;
  entityType: "student" | "employee";
  isActive: boolean;
  version: number;
  hlc: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  syncStatus: AttendanceSyncStatus;
};

export type Holiday = {
  id: string;
  date: string;
  name: string;
  version: number;
  hlc: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  syncStatus: AttendanceSyncStatus;
};
