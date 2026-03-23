import {
  getAttendanceSettings,
  getHolidays,
} from "@/core/services/attendance-service";
import { checkPermission } from "@/lib/auth/rbac";
import { auth } from "@/lib/auth/web/auth";
import type { AttendanceSetting, Holiday } from "@/lib/db/schema";
import { AttendancePageClient } from "./attendance-page-client";

export default async function AttendancePage() {
  const session = await auth();
  const canWriteAttendance = checkPermission(session, "attendance:write");

  let initialSettings: AttendanceSetting[] | undefined;
  let initialHolidays: Holiday[] | undefined;

  if (canWriteAttendance) {
    try {
      [initialSettings, initialHolidays] = await Promise.all([
        getAttendanceSettings(),
        getHolidays(),
      ]);
    } catch {
      initialSettings = undefined;
      initialHolidays = undefined;
    }
  }

  return (
    <AttendancePageClient
      initialSettings={initialSettings}
      initialHolidays={initialHolidays}
    />
  );
}
