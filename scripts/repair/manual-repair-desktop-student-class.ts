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
const className = process.env.MANUAL_CLASS_NAME?.trim();

if (!nis) {
  throw new Error("STUDENT_NIS is required");
}

if (!className) {
  throw new Error("MANUAL_CLASS_NAME is required");
}

const dbPath = resolveDesktopDbPath();
const db = new Database(dbPath);
const nowEpoch = Math.floor(Date.now() / 1000);

const before = db
  .query(
    `
      select
        s.id as student_id,
        s.nis,
        s.full_name,
        s.grade as student_grade,
        u.id as user_id,
        u.email,
        u.kelas_id as user_kelas_id,
        c.name as joined_class_name
      from students s
      left join users u
        on u.id = s.id
       and u.role = 'student'
      left join classes c
        on c.id = u.kelas_id
       and c.deleted_at is null
      where s.nis = ?
        and s.deleted_at is null
      limit 1
    `,
  )
  .get(nis) as
  | {
      student_id: string;
      nis: string;
      full_name: string;
      student_grade: string | null;
      user_id: string | null;
      email: string | null;
      user_kelas_id: string | null;
      joined_class_name: string | null;
    }
  | undefined;

if (!before?.student_id) {
  throw new Error(`Desktop student with NIS ${nis} not found`);
}

const targetClassId =
  before.user_kelas_id ||
  (
    db
      .query(
        `
          select id
          from classes
          where name = ?
            and deleted_at is null
          limit 1
        `,
      )
      .get(className) as { id?: string } | undefined
  )?.id ||
  crypto.randomUUID();

db.exec("BEGIN IMMEDIATE");

try {
  db.query(
    `
      insert into classes (
        id,
        name,
        academic_year,
        is_active,
        created_at,
        updated_at,
        deleted_at,
        sync_status
      ) values (?, ?, '2026/2027', 1, ?, ?, null, 'pending')
      on conflict(id) do update set
        name = excluded.name,
        academic_year = excluded.academic_year,
        is_active = excluded.is_active,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at,
        sync_status = excluded.sync_status
    `,
  ).run(targetClassId, className, nowEpoch, nowEpoch);

  db.query(
    `
      update students
      set grade = ?,
          updated_at = ?,
          sync_status = 'pending'
      where id = ?
    `,
  ).run(className, nowEpoch, before.student_id);

  if (before.user_id) {
    db.query(
      `
        update users
        set kelas_id = ?,
            updated_at = ?,
            sync_status = 'pending'
        where id = ?
      `,
    ).run(targetClassId, nowEpoch, before.user_id);
  }

  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}

const after = db
  .query(
    `
      select
        s.id as student_id,
        s.nis,
        s.full_name,
        s.grade as student_grade,
        u.id as user_id,
        u.email,
        u.kelas_id as user_kelas_id,
        c.name as joined_class_name
      from students s
      left join users u
        on u.id = s.id
       and u.role = 'student'
      left join classes c
        on c.id = u.kelas_id
       and c.deleted_at is null
      where s.nis = ?
        and s.deleted_at is null
      limit 1
    `,
  )
  .get(nis);

db.close();

console.log(
  JSON.stringify(
    {
      dbPath,
      nis,
      className,
      targetClassId,
      before,
      after,
    },
    null,
    2,
  ),
);
