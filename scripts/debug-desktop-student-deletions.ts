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

function queryOne(sql: string) {
  return db.query(sql).get();
}

function queryAll(sql: string) {
  return db.query(sql).all();
}

const counts = {
  activeStudents:
    queryOne("select count(*) as value from students where deleted_at is null")
      ?.value ?? 0,
  deletedStudents:
    queryOne(
      "select count(*) as value from students where deleted_at is not null",
    )?.value ?? 0,
  activeStudentUsers:
    queryOne(
      "select count(*) as value from users where role = 'student' and deleted_at is null and is_active = 1",
    )?.value ?? 0,
  deletedStudentUsers:
    queryOne(
      "select count(*) as value from users where role = 'student' and deleted_at is not null",
    )?.value ?? 0,
};

const deletionGroups = queryAll(`
  select deleted_at, count(*) as total
  from students
  where deleted_at is not null
  group by deleted_at
  order by deleted_at desc
  limit 10
`);

const deletedStudents = queryAll(`
  select
    id,
    nis,
    full_name,
    grade,
    deleted_at,
    updated_at,
    sync_status
  from students
  where deleted_at is not null
  order by deleted_at desc, updated_at desc
  limit 50
`);

const deletedUsers = queryAll(`
  select
    id,
    email,
    nis,
    full_name,
    deleted_at,
    updated_at,
    sync_status
  from users
  where role = 'student'
    and deleted_at is not null
  order by deleted_at desc, updated_at desc
  limit 50
`);

console.log(
  JSON.stringify(
    {
      dbPath,
      counts,
      deletionGroups,
      deletedStudents,
      deletedUsers,
    },
    null,
    2,
  ),
);
