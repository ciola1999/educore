// @ts-nocheck
import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@libsql/client";

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

const cloudUrl =
  process.env.SYNC_DATABASE_URL ||
  process.env.TURSO_DATABASE_URL ||
  process.env.DATABASE_URL;
const cloudAuthToken =
  process.env.SYNC_DATABASE_AUTH_TOKEN ||
  process.env.TURSO_AUTH_TOKEN ||
  process.env.DATABASE_AUTH_TOKEN;
const nis = process.env.STUDENT_NIS?.trim();

if (!cloudUrl) {
  throw new Error("Missing cloud database URL env");
}

if (!nis) {
  throw new Error("STUDENT_NIS is required");
}

const client = createClient({
  url: cloudUrl,
  authToken: cloudAuthToken,
});

const dbPath = resolveDesktopDbPath();
const db = new Database(dbPath);

const cloudResult = await client.execute({
  sql: `
    select
      s.id as student_id,
      s.nis,
      s.full_name,
      s.gender,
      s.grade,
      s.nisn,
      s.tempat_lahir,
      s.tanggal_lahir,
      s.alamat,
      s.created_at as student_created_at,
      s.updated_at as student_updated_at,
      s.deleted_at as student_deleted_at,
      s.sync_status as student_sync_status,
      u.id as user_id,
      u.email,
      u.password_hash,
      u.role,
      u.kelas_id,
      u.is_active,
      u.created_at as user_created_at,
      u.updated_at as user_updated_at,
      u.deleted_at as user_deleted_at,
      u.sync_status as user_sync_status
    from students s
    left join users u
      on u.id = s.id
     and u.role = 'student'
     and u.deleted_at is null
    where s.nis = ?
      and s.deleted_at is null
    limit 1
  `,
  args: [nis],
});

const cloudRow = cloudResult.rows[0];
const canonicalClassName =
  typeof cloudRow?.grade === "string" && cloudRow.grade.trim()
    ? cloudRow.grade.trim()
    : null;
if (!cloudRow?.student_id || !cloudRow?.kelas_id || !canonicalClassName) {
  throw new Error(
    `Cloud student/account/class record for NIS ${nis} not found`,
  );
}

const nowEpoch = Math.floor(Date.now() / 1000);
const classResult = await client.execute({
  sql: `
    select
      id,
      name,
      academic_year,
      is_active,
      created_at,
      updated_at,
      deleted_at,
      sync_status
    from classes
    where id = ?
      and deleted_at is null
    limit 1
  `,
  args: [cloudRow.kelas_id],
});
const classRow = classResult.rows[0];
if (!classRow?.id || !classRow?.name) {
  throw new Error(`Cloud class ${String(cloudRow.kelas_id)} not found`);
}

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
      ) values (?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(id) do update set
        name = excluded.name,
        academic_year = excluded.academic_year,
        is_active = excluded.is_active,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at,
        sync_status = excluded.sync_status
    `,
  ).run(
    classRow.id,
    canonicalClassName,
    classRow.academic_year ?? "2026/2027",
    Number(classRow.is_active ?? 1),
    Number(classRow.created_at ?? nowEpoch),
    Number(classRow.updated_at ?? nowEpoch),
    classRow.deleted_at ?? null,
    classRow.sync_status ?? "synced",
  );

  db.query(
    `
      update attendance
      set student_id = ?, updated_at = ?, sync_status = 'pending'
      where student_id in (
        select id from students where nis = ? and id <> ?
      )
    `,
  ).run(cloudRow.student_id, nowEpoch, nis, cloudRow.student_id);

  db.query(
    `
      update student_daily_attendance
      set student_id = ?, updated_at = ?, sync_status = 'pending'
      where student_id in (
        select id from students where nis = ? and id <> ?
      )
    `,
  ).run(cloudRow.student_id, nowEpoch, nis, cloudRow.student_id);

  db.query(
    `
      delete from students
      where nis = ?
        and id <> ?
    `,
  ).run(nis, cloudRow.student_id);

  db.query(
    `
      delete from users
      where role = 'student'
        and nis = ?
        and id <> ?
    `,
  ).run(nis, cloudRow.user_id ?? cloudRow.student_id);

  db.query(
    `
      insert or replace into students (
        id,
        nis,
        full_name,
        gender,
        grade,
        nisn,
        tempat_lahir,
        tanggal_lahir,
        alamat,
        created_at,
        updated_at,
        deleted_at,
        sync_status
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    cloudRow.student_id,
    cloudRow.nis,
    cloudRow.full_name,
    cloudRow.gender,
    canonicalClassName,
    cloudRow.nisn ?? null,
    cloudRow.tempat_lahir ?? null,
    cloudRow.tanggal_lahir ?? null,
    cloudRow.alamat ?? null,
    Number(cloudRow.student_created_at ?? nowEpoch),
    Number(cloudRow.student_updated_at ?? nowEpoch),
    cloudRow.student_deleted_at ?? null,
    cloudRow.student_sync_status ?? "synced",
  );

  if (cloudRow.user_id) {
    db.query(
      `
        insert or replace into users (
          id,
          full_name,
          email,
          role,
          password_hash,
          nis,
          nisn,
          tempat_lahir,
          tanggal_lahir,
          alamat,
          kelas_id,
          is_active,
          created_at,
          updated_at,
          deleted_at,
          sync_status
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      cloudRow.user_id,
      cloudRow.full_name,
      cloudRow.email,
      cloudRow.role ?? "student",
      cloudRow.password_hash ?? null,
      cloudRow.nis,
      cloudRow.nisn ?? null,
      cloudRow.tempat_lahir ?? null,
      cloudRow.tanggal_lahir ?? null,
      cloudRow.alamat ?? null,
      cloudRow.kelas_id,
      Number(cloudRow.is_active ?? 1),
      Number(cloudRow.user_created_at ?? nowEpoch),
      Number(cloudRow.user_updated_at ?? nowEpoch),
      cloudRow.user_deleted_at ?? null,
      cloudRow.user_sync_status ?? "synced",
    );
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
    `,
  )
  .all(nis);

db.close();

console.log(
  JSON.stringify(
    {
      dbPath,
      nis,
      repairedStudentId: cloudRow.student_id,
      repairedClassId: classRow.id,
      repairedClassName: canonicalClassName,
      after,
    },
    null,
    2,
  ),
);
