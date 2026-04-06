import { createClient } from "@libsql/client";

const url =
  process.env.SYNC_DATABASE_URL ||
  process.env.TURSO_DATABASE_URL ||
  process.env.DATABASE_URL;
const authToken =
  process.env.SYNC_DATABASE_AUTH_TOKEN ||
  process.env.TURSO_AUTH_TOKEN ||
  process.env.DATABASE_AUTH_TOKEN;

if (!url) {
  throw new Error("Missing cloud database URL env");
}

const nis = process.env.MANUAL_NIS?.trim() || "";
const className = process.env.MANUAL_CLASS_NAME?.trim() || "";
const apply = process.env.APPLY_REPAIR === "1";

if (!nis) {
  throw new Error("MANUAL_NIS is required");
}

if (!className) {
  throw new Error("MANUAL_CLASS_NAME is required");
}

const client = createClient({
  url,
  authToken,
});

const nowEpoch = Math.floor(Date.now() / 1000);

const before = await client.execute({
  sql: `
    select
      s.id as student_id,
      s.nis,
      s.full_name,
      s.grade as student_grade,
      u.kelas_id as user_kelas_id,
      c.name as joined_class_name
    from students s
    left join users u
      on u.id = s.id
     and u.role = 'student'
     and u.deleted_at is null
    left join classes c
      on c.id = u.kelas_id
     and c.deleted_at is null
    where s.nis = ?
      and s.deleted_at is null
    limit 1
  `,
  args: [nis],
});

const student = before.rows[0];
if (!student?.student_id || typeof student.student_id !== "string") {
  throw new Error(`Student with NIS ${nis} not found`);
}

const classLookup = await client.execute({
  sql: `
    select id, name
    from classes
    where lower(name) = lower(?)
      and deleted_at is null
    order by updated_at desc
    limit 1
  `,
  args: [className],
});

let classId = classLookup.rows[0]?.id;
let classUpsert: { inserted: boolean; rowsAffected: number } | null = null;

if (typeof classId !== "string" || !classId.trim()) {
  classId = crypto.randomUUID();
  if (apply) {
    const insertResult = await client.execute({
      sql: `
        insert into classes (
          id,
          name,
          academic_year,
          is_active,
          created_at,
          updated_at,
          sync_status
        ) values (?, ?, ?, 1, ?, ?, 'pending')
      `,
      args: [classId, className, "2026/2027", nowEpoch, nowEpoch],
    });
    classUpsert = {
      inserted: true,
      rowsAffected: insertResult.rowsAffected ?? 0,
    };
  } else {
    classUpsert = {
      inserted: true,
      rowsAffected: 0,
    };
  }
}

let studentUpdateRows = 0;
let userUpdateRows = 0;

if (apply) {
  const studentUpdate = await client.execute({
    sql: `
      update students
      set grade = ?,
          updated_at = ?,
          sync_status = 'pending'
      where id = ?
        and deleted_at is null
    `,
    args: [className, nowEpoch, student.student_id],
  });
  studentUpdateRows = studentUpdate.rowsAffected ?? 0;

  const userUpdate = await client.execute({
    sql: `
      update users
      set kelas_id = ?,
          updated_at = ?,
          sync_status = 'pending'
      where id = ?
        and role = 'student'
        and deleted_at is null
    `,
    args: [classId, nowEpoch, student.student_id],
  });
  userUpdateRows = userUpdate.rowsAffected ?? 0;
}

const after = await client.execute({
  sql: `
    select
      s.id as student_id,
      s.nis,
      s.full_name,
      s.grade as student_grade,
      u.kelas_id as user_kelas_id,
      c.name as joined_class_name
    from students s
    left join users u
      on u.id = s.id
     and u.role = 'student'
     and u.deleted_at is null
    left join classes c
      on c.id = u.kelas_id
     and c.deleted_at is null
    where s.id = ?
      and s.deleted_at is null
    limit 1
  `,
  args: [student.student_id],
});

console.log(
  JSON.stringify(
    {
      url,
      apply,
      nis,
      className,
      classId,
      classUpsert,
      studentUpdateRows,
      userUpdateRows,
      before: before.rows[0] ?? null,
      after: after.rows[0] ?? null,
    },
    null,
    2,
  ),
);
