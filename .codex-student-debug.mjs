import { and, inArray, isNull } from "drizzle-orm";
import { getDb } from "./src/lib/db";
import { classes, students, users } from "./src/lib/db/schema";

const db = await getDb();

const studentRows = await db
  .select({
    id: students.id,
    nis: students.nis,
    fullName: students.fullName,
    grade: students.grade,
  })
  .from(students)
  .where(isNull(students.deletedAt))
  .limit(15);

const studentIds = studentRows.map((row) => row.id);

const userRows =
  studentIds.length > 0
    ? await db
        .select({
          id: users.id,
          nis: users.nis,
          kelasId: users.kelasId,
        })
        .from(users)
        .where(and(inArray(users.id, studentIds), isNull(users.deletedAt)))
        .limit(30)
    : [];

const classRefs = [...new Set(userRows.map((row) => row.kelasId).filter(Boolean))];

const classRows =
  classRefs.length > 0
    ? await db
        .select({
          id: classes.id,
          name: classes.name,
        })
        .from(classes)
        .where(and(inArray(classes.id, classRefs), isNull(classes.deletedAt)))
        .limit(50)
    : [];

console.log(
  JSON.stringify(
    {
      studentRows,
      userRows,
      classRows,
    },
    null,
    2,
  ),
);
