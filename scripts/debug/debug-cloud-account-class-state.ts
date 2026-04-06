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

const client = createClient({
  url,
  authToken,
});

const result = await client.execute(`
  select
    s.id as student_id,
    s.nis,
    s.full_name,
    s.grade as student_grade,
    u.email as account_email,
    u.kelas_id as user_kelas_id,
    c.name as joined_class_name,
    sg.name as student_grade_class_name,
    la.class_id as latest_attendance_class_id,
    ac.name as latest_attendance_class_name
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
  left join (
    select a.student_id, a.class_id
    from attendance a
    join (
      select student_id, max(updated_at) as max_updated_at
      from attendance
      where deleted_at is null
      group by student_id
    ) latest
      on latest.student_id = a.student_id
     and latest.max_updated_at = a.updated_at
    where a.deleted_at is null
  ) la
    on la.student_id = s.id
  left join classes ac
    on ac.id = la.class_id
   and ac.deleted_at is null
  where s.deleted_at is null
  order by s.full_name asc, s.nis asc
`);

const classesResult = await client.execute(`
  select
    id,
    name,
    academic_year,
    deleted_at
  from classes
  where deleted_at is null
  order by name asc, academic_year asc
`);

console.log(
  JSON.stringify(
    {
      url,
      total: result.rows.length,
      rows: result.rows,
      activeClasses: classesResult.rows,
    },
    null,
    2,
  ),
);
