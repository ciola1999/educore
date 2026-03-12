import { sql } from "drizzle-orm";
import { getDb } from "../src/lib/db/index";

async function cleanBadData() {
  console.log("🧹 Cleaning corrupted data...");
  const db = await getDb();

  // 1. Clean Users (Invalid IDs)
  const usersResult = await db.run(
    sql`DELETE FROM users WHERE length(id) < 10 OR id IS NULL`,
  );
  console.log(`✅ Cleaned Users: ${(usersResult as any).rowsAffected} rows`);

  // 2. Clean Students
  const studentsResult = await db.run(
    sql`DELETE FROM students WHERE length(id) < 10 OR id IS NULL`,
  );
  console.log(
    `✅ Cleaned Students: ${(studentsResult as any).rowsAffected} rows`,
  );

  // 3. Clean Attendance
  const attResult = await db.run(
    sql`DELETE FROM attendance WHERE length(id) < 10 OR id IS NULL`,
  );
  console.log(`✅ Cleaned Attendance: ${(attResult as any).rowsAffected} rows`);

  // 4. Clean Daily Attendance
  const dailyAttResult = await db.run(
    sql`DELETE FROM student_daily_attendance WHERE length(id) < 10 OR id IS NULL`,
  );
  console.log(
    `✅ Cleaned Daily Attendance: ${(dailyAttResult as any).rowsAffected} rows`,
  );

  console.log("✨ Database cleanup complete.");
}

cleanBadData().catch(console.error);
