import { createClient } from "@libsql/client";

const url =
  process.env.SYNC_DATABASE_URL ||
  process.env.TURSO_DATABASE_URL ||
  process.env.DATABASE_URL;
const authToken =
  process.env.SYNC_DATABASE_AUTH_TOKEN ||
  process.env.TURSO_AUTH_TOKEN ||
  process.env.DATABASE_AUTH_TOKEN;
const classId = process.env.CLASS_ID?.trim();

if (!url) {
  throw new Error("Missing cloud database URL env");
}

if (!classId) {
  throw new Error("CLASS_ID is required");
}

const client = createClient({
  url,
  authToken,
});

const attendanceRows = await client.execute({
  sql: `
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
  args: [classId],
});

console.log(
  JSON.stringify(
    {
      url,
      classId,
      total: attendanceRows.rows.length,
      rows: attendanceRows.rows,
    },
    null,
    2,
  ),
);
