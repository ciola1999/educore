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

const nis = process.env.STUDENT_NIS?.trim();
if (!nis) {
  throw new Error("STUDENT_NIS is required");
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
      s.deleted_at as student_deleted_at,
      s.updated_at as student_updated_at,
      s.sync_status as student_sync_status,
      u.id as user_id,
      u.email,
      u.kelas_id as user_kelas_id,
      u.is_active as user_is_active,
      u.deleted_at as user_deleted_at,
      u.updated_at as user_updated_at,
      u.sync_status as user_sync_status,
      c.name as joined_class_name
    from students s
    left join users u
      on u.id = s.id
     and u.role = 'student'
    left join classes c
      on c.id = u.kelas_id
     and c.deleted_at is null
    where s.nis = ?
       or coalesce(u.nis, '') = ?
    order by s.updated_at desc
  `)
  .all(nis, nis);

console.log(
  JSON.stringify(
    {
      dbPath,
      nis,
      count: rows.length,
      rows,
    },
    null,
    2,
  ),
);
