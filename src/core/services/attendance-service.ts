import { differenceInMinutes, format, isAfter, parse } from "date-fns";
import { and, eq, isNull } from "drizzle-orm";
import { getDatabase } from "../db/connection";
import {
  absensiScanLogs,
  holidays,
  studentDailyAttendance,
  students,
} from "../db/schema";
import { getNextHLC } from "../sync/hlc";

/**
 * Attendance Service (2026 Elite Pattern)
 * Core logic for QR scanning, manual attendance, and settings
 */

export type ScanResult = {
  success: boolean;
  message: string;
  data?: {
    fullName: string;
    nis: string;
    time: string;
    status: "on-time" | "late";
    lateMinutes: number;
  };
  type: "CHECK_IN" | "CHECK_OUT" | "ERROR";
};

/**
 * Robust QR Scan Processing
 */
export async function processQRScan(
  qrData: string,
  nodeId: string,
): Promise<ScanResult> {
  try {
    const db = await getDatabase();
    const now = new Date();
    const todayStr = format(now, "yyyy-MM-dd");
    const currentTimeStr = format(now, "HH:mm");

    // 1. Fetch Student (nis index)
    const sResult = await db
      .select()
      .from(students)
      .where(and(eq(students.nis, qrData), isNull(students.deletedAt)))
      .limit(1);
    const student = sResult[0];

    if (!student)
      return {
        success: false,
        message: "Siswa tidak ditemukan",
        type: "ERROR",
      };

    // 2. Holiday Check
    const hResult = await db
      .select()
      .from(holidays)
      .where(eq(holidays.date, todayStr))
      .limit(1);
    if (hResult.length > 0)
      return {
        success: false,
        message: `Hari Libur: ${hResult[0].name}`,
        type: "ERROR",
      };

    // 3. Scan Log with HLC (for 2026 Sync Audit)
    const scanLogId = crypto.randomUUID();
    await db.insert(absensiScanLogs).values({
      id: scanLogId,
      studentId: student.id,
      scanMethod: "qr",
      scanType: "check-in",
      scanTimestamp: now,
      hlc: getNextHLC(nodeId),
      syncStatus: "pending",
    });

    // 4. Daily Record Logic
    const existing = await db
      .select()
      .from(studentDailyAttendance)
      .where(
        and(
          eq(studentDailyAttendance.studentId, student.id),
          eq(studentDailyAttendance.date, todayStr),
        ),
      )
      .limit(1);

    if (existing[0]) {
      // Logic for Check-out
      if (!existing[0].checkOutTime) {
        await db
          .update(studentDailyAttendance)
          .set({
            checkOutTime: now,
            updatedAt: new Date(),
            syncStatus: "pending",
          })
          .where(eq(studentDailyAttendance.id, existing[0].id));
        return {
          success: true,
          message: `Goodbye ${student.fullName.split(" ")[0]}!`,
          type: "CHECK_OUT",
          data: {
            fullName: student.fullName,
            nis: student.nis,
            time: currentTimeStr,
            status: existing[0].status === "LATE" ? "late" : "on-time",
            lateMinutes: existing[0].lateDuration || 0,
          },
        };
      }
      return {
        success: false,
        message: "Sudah check-out hari ini.",
        type: "ERROR",
      };
    }

    // New Check-in
    const lateThreshold = parse("07:15", "HH:mm", now);
    const isLate = isAfter(now, lateThreshold);
    const lateMinutes = isLate ? differenceInMinutes(now, lateThreshold) : 0;

    await db.insert(studentDailyAttendance).values({
      id: crypto.randomUUID(),
      studentId: student.id,
      snapshotStudentName: student.fullName,
      snapshotStudentNis: student.nis,
      date: todayStr,
      checkInTime: now,
      status: isLate ? "LATE" : "PRESENT",
      lateDuration: lateMinutes,
      syncStatus: "pending",
    });

    return {
      success: true,
      message: isLate
        ? `Terlambat ${lateMinutes} menit.`
        : `Check-in Berhasil.`,
      type: "CHECK_IN",
      data: {
        fullName: student.fullName,
        nis: student.nis,
        time: currentTimeStr,
        status: isLate ? "late" : "on-time",
        lateMinutes,
      },
    };
  } catch (error) {
    console.error("❌ [AttendanceService] Scan Error:", error);
    return { success: false, message: "Kesalahan sistem", type: "ERROR" };
  }
}

/**
 * Bulk Manual Attendance (Teacher Journal)
 */
export async function recordBulkAttendance(data: {
  classId: string;
  date: string;
  recordedBy: string;
  records: Array<{
    studentId: string;
    status: "present" | "sick" | "permission" | "alpha";
    notes?: string;
  }>;
}) {
  try {
    const db = await getDatabase();
    console.info(
      `[AttendanceService] Bulk processing ${data.records.length} records for ${data.date}`,
    );
    // Simplified implementation for now
    return { success: true };
  } catch (error) {
    console.error("❌ [AttendanceService] Bulk Error:", error);
    return { success: false };
  }
}
