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

function queryOne<T>(sql: string) {
  return db.query(sql).get() as T;
}

function queryAll<T>(sql: string) {
  return db.query(sql).all() as T[];
}

const total = queryOne<{ value: number }>(
  "select count(*) as value from students where deleted_at is null",
);

const accountBacked = queryOne<{ value: number }>(`
  select count(*) as value
  from students s
  join users u
    on u.id = s.id
   and u.role = 'student'
   and u.deleted_at is null
   and u.is_active = 1
  where s.deleted_at is null
`);

const standalone = queryOne<{ value: number }>(`
  select count(*) as value
  from students s
  left join users u
    on u.id = s.id
   and u.role = 'student'
   and u.deleted_at is null
   and u.is_active = 1
  where s.deleted_at is null
    and u.id is null
`);

const duplicateNis = queryAll<{ nis: string; total: number }>(`
  select nis, count(*) as total
  from students
  where deleted_at is null and trim(coalesce(nis, '')) <> ''
  group by nis
  having count(*) > 1
  order by total desc, nis asc
`);

const orphanById = queryAll<{
  id: string;
  nis: string | null;
  full_name: string;
  grade: string | null;
}>(`
  select s.id, s.nis, s.full_name, s.grade
  from students s
  left join users u
    on u.id = s.id
    and u.role = 'student'
    and u.deleted_at is null
    and u.is_active = 1
  where s.deleted_at is null
    and u.id is null
  order by s.nis asc, s.full_name asc
  limit 50
`);

const overlapByNis = queryAll<{
  student_id: string;
  user_id: string;
  nis: string;
  full_name: string;
}>(`
  select s.id as student_id, u.id as user_id, s.nis, s.full_name
  from students s
  join users u
    on u.nis = s.nis
    and u.role = 'student'
    and u.deleted_at is null
    and u.is_active = 1
  where s.deleted_at is null
    and s.id <> u.id
  order by s.nis asc
  limit 50
`);

console.log(
  JSON.stringify(
    {
      dbPath,
      totalActiveStudents: total?.value ?? 0,
      accountBackedStudents: accountBacked?.value ?? 0,
      standaloneStudents: standalone?.value ?? 0,
      duplicateNisCount: duplicateNis.length,
      duplicateNisSample: duplicateNis.slice(0, 20),
      orphanByIdCountSample: orphanById.length,
      orphanByIdSample: orphanById.slice(0, 20),
      overlapByNisCountSample: overlapByNis.length,
      overlapByNisSample: overlapByNis.slice(0, 20),
    },
    null,
    2,
  ),
);
