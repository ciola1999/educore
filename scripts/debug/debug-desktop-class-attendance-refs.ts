// @ts-nocheck
import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";

function resolveDesktopDbPath() {
  const appData = process.env.APPDATA;
  if (!appData) {
    throw new Error("APPDATA is not available");
  }

  const candidates = [
    join(appData, "com.educore.system", "educore.db"),
    join(appData, "educore", "educore.db"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Desktop database not found. Checked: ${candidates.join(", ")}`,
  );
}

const classId = process.env.CLASS_ID?.trim();
if (!classId) {
  throw new Error("CLASS_ID is required");
}

const dbPath = resolveDesktopDbPath();
const db = new Database(dbPath, { readonly: true });

const rows = db
  .query(
    `
      select
        a.id as attendance_id,
        a.student_id,
        a.class_id,
        a.date,
        a.status,
        s.nis,
        s.full_name,
        s.grade as student_grade,
        u.kelas_id as user_kelas_id,
        c.name as user_class_name
      from attendance a
      left join students s
        on s.id = a.student_id
       and s.deleted_at is null
      left join users u
        on u.id = a.student_id
       and u.role = 'student'
       and u.deleted_at is null
      left join classes c
        on c.id = u.kelas_id
       and c.deleted_at is null
      where a.class_id = ?
        and a.deleted_at is null
      order by a.date desc, a.updated_at desc
    `,
  )
  .all(classId);

db.close();

console.log(
  JSON.stringify(
    {
      dbPath,
      classId,
      total: rows.length,
      rows,
    },
    null,
    2,
  ),
);
