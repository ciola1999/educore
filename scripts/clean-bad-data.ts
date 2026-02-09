import { sql } from "drizzle-orm";
import { getDb } from "../src/lib/db/index";

async function cleanBadData() {
	console.log("🧹 Cleaning corrupted data...");
	const db = await getDb();

	// 1. Clean Users (Invalid IDs)
	// Cuid2 is usually 24 chars, but we'll leniently check for length < 10 or empty
	const usersResult = await db.run(
		sql`DELETE FROM users WHERE length(id) < 10 OR id IS NULL`,
	);
	console.log(`✅ Cleaned Users: ${usersResult.rowsAffected} rows`);

	// 2. Clean Students
	const studentsResult = await db.run(
		sql`DELETE FROM students WHERE length(id) < 10 OR id IS NULL`,
	);
	console.log(`✅ Cleaned Students: ${studentsResult.rowsAffected} rows`);

	// 3. Clean Attendance
	const attResult = await db.run(
		sql`DELETE FROM attendance WHERE length(id) < 10 OR id IS NULL`,
	);
	console.log(`✅ Cleaned Attendance: ${attResult.rowsAffected} rows`);

	// 4. Clean Daily Attendance
	const dailyAttResult = await db.run(
		sql`DELETE FROM student_daily_attendance WHERE length(id) < 10 OR id IS NULL`,
	);
	console.log(
		`✅ Cleaned Daily Attendance: ${dailyAttResult.rowsAffected} rows`,
	);

	console.log("✨ Database cleanup complete.");
}

cleanBadData().catch(console.error);
