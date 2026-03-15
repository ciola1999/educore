import { isNull } from "drizzle-orm";
import { getDb } from "./src/lib/db";
import { classes, students, users } from "./src/lib/db/schema";

async function checkDb() {
  const db = await getDb();

  const studentCount = await db
    .select()
    .from(students)
    .where(isNull(students.deletedAt));
  console.log("Total students in students table:", studentCount.length);

  const classList = await db
    .select()
    .from(classes)
    .where(isNull(classes.deletedAt));
  console.log("Total classes:", classList.length);
  classList.forEach((c) => console.log(`- Class: ${c.name} (${c.id})`));

  const sampleStudents = await db
    .select()
    .from(students)
    .where(isNull(students.deletedAt))
    .limit(10);
  console.log("Sample students (first 10):");
  sampleStudents.forEach((s) =>
    console.log(`- ${s.fullName} (NIS: ${s.nis}, Grade: ${s.grade})`),
  );

  const studentUsers = await db
    .select()
    .from(users)
    .where(isNull(users.deletedAt))
    .limit(10);
  console.log("Sample users (first 10):");
  studentUsers.forEach((u) =>
    console.log(
      `- ${u.fullName} (NIS: ${u.nis}, Email: ${u.email}, Role: ${u.role}, KelasId: ${u.kelasId})`,
    ),
  );
}

checkDb().catch(console.error);
