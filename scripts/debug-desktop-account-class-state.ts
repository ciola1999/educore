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

const dbPath = resolveDesktopDbPath();
const db = new Database(dbPath, { readonly: true });

const rows = db
  .query(`
    select
      s.id as student_id,
      s.nis,
      s.full_name,
      s.grade as student_grade,
      u.email as account_email,
      u.kelas_id as user_kelas_id,
      c.name as joined_class_name,
      sg.name as student_grade_class_name
    from students s
    join users u
      on u.id = s.id
     and u.role = 'student'
     and u.deleted_at is null
     and u.is_active = 1
    left join classes c
      on c.id = u.kelas_id
     and c.deleted_at is null
    left join classes sg
      on sg.id = s.grade
     and sg.deleted_at is null
    where s.deleted_at is null
    order by s.full_name asc, s.nis asc
  `)
  .all();

console.log(
  JSON.stringify(
    {
      dbPath,
      total: rows.length,
      rows,
    },
    null,
    2,
  ),
);
