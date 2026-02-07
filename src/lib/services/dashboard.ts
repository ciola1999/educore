import { eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { attendance, students, users } from "../db/schema";

export type DashboardStats = {
	totalStudents: number;
	totalTeachers: number;
	attendanceToday: {
		present: number;
		sick: number;
		permission: number;
		alpha: number;
		totalRecorded: number;
	};
};

export async function getDashboardStats(): Promise<DashboardStats> {
	const db = await getDb();
	const today = new Date().toISOString().split("T")[0];

	try {
		// 1. Total Students
		const studentCount = await db
			.select({ count: sql<number>`count(*)` })
			.from(students);
		const totalStudents = studentCount[0]?.count || 0;

		// 2. Total Teachers (role = 'teacher' or 'staff')
		const teacherCount = await db
			.select({ count: sql<number>`count(*)` })
			.from(users)
			.where(sql`role IN ('teacher', 'staff')`);
		const totalTeachers = teacherCount[0]?.count || 0;

		// 3. Today's Attendance
		const attendanceStats = await db
			.select({
				status: attendance.status,
				count: sql<number>`count(*)`,
			})
			.from(attendance)
			.where(eq(attendance.date, today))
			.groupBy(attendance.status);

		const stats = {
			present: 0,
			sick: 0,
			permission: 0,
			alpha: 0,
			totalRecorded: 0,
		};

		for (const s of attendanceStats) {
			if (s.status === "present") stats.present = s.count;
			if (s.status === "sick") stats.sick = s.count;
			if (s.status === "permission") stats.permission = s.count;
			if (s.status === "alpha") stats.alpha = s.count;
		}
		stats.totalRecorded =
			stats.present + stats.sick + stats.permission + stats.alpha;

		return {
			totalStudents,
			totalTeachers,
			attendanceToday: stats,
		};
	} catch (error) {
		console.error("Error fetching dashboard stats:", error);
		return {
			totalStudents: 0,
			totalTeachers: 0,
			attendanceToday: {
				present: 0,
				sick: 0,
				permission: 0,
				alpha: 0,
				totalRecorded: 0,
			},
		};
	}
}
