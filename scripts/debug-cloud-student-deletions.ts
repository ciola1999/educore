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

async function queryOne<T>(sql: string) {
  const result = await client.execute(sql);
  return (result.rows[0] ?? null) as T | null;
}

async function queryAll<T>(sql: string) {
  const result = await client.execute(sql);
  return result.rows as T[];
}

const counts = {
  activeStudents: Number(
    (
      await queryOne<{ value: number }>(
        "select count(*) as value from students where deleted_at is null",
      )
    )?.value ?? 0,
  ),
  deletedStudents: Number(
    (
      await queryOne<{ value: number }>(
        "select count(*) as value from students where deleted_at is not null",
      )
    )?.value ?? 0,
  ),
  activeStudentUsers: Number(
    (
      await queryOne<{ value: number }>(
        "select count(*) as value from users where role = 'student' and deleted_at is null and is_active = 1",
      )
    )?.value ?? 0,
  ),
  deletedStudentUsers: Number(
    (
      await queryOne<{ value: number }>(
        "select count(*) as value from users where role = 'student' and deleted_at is not null",
      )
    )?.value ?? 0,
  ),
};

const deletionGroups = await queryAll<{
  deleted_at: string | number | null;
  total: number;
}>(`
  select deleted_at, count(*) as total
  from students
  where deleted_at is not null
  group by deleted_at
  order by deleted_at desc
  limit 10
`);

const deletedStudents = await queryAll<{
  id: string;
  nis: string | null;
  full_name: string;
  grade: string | null;
  deleted_at: string | number | null;
  updated_at: string | number | null;
  sync_status: string | null;
}>(`
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

const deletedUsers = await queryAll<{
  id: string;
  email: string | null;
  nis: string | null;
  full_name: string;
  deleted_at: string | number | null;
  updated_at: string | number | null;
  sync_status: string | null;
}>(`
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

const latestBatchStandaloneDeletedStudents = await queryAll<{
  id: string;
  nis: string | null;
  full_name: string;
  grade: string | null;
  deleted_at: string | number | null;
}>(`
  select
    s.id,
    s.nis,
    s.full_name,
    s.grade,
    s.deleted_at
  from students s
  left join users u
    on u.id = s.id
   and u.role = 'student'
   and u.deleted_at is not null
  where s.deleted_at = 1775384665
    and u.id is null
  order by s.grade asc, s.nis asc, s.full_name asc
`);

const latestBatchStandaloneByGrade = await queryAll<{
  grade: string | null;
  total: number;
}>(`
  select s.grade, count(*) as total
  from students s
  left join users u
    on u.id = s.id
   and u.role = 'student'
   and u.deleted_at is not null
  where s.deleted_at = 1775384665
    and u.id is null
  group by s.grade
  order by total desc, s.grade asc
`);

const activeStandaloneByGrade = await queryAll<{
  grade: string | null;
  total: number;
}>(`
  select s.grade, count(*) as total
  from students s
  left join users u
    on u.id = s.id
   and u.role = 'student'
   and u.deleted_at is null
   and u.is_active = 1
  where s.deleted_at is null
    and u.id is null
  group by s.grade
  order by total desc, s.grade asc
`);

const latestBatchStandaloneWithDeletedUserNisMatch = await queryAll<{
  student_id: string;
  user_id: string;
  nis: string | null;
  full_name: string;
  grade: string | null;
}>(`
  select
    s.id as student_id,
    u.id as user_id,
    s.nis,
    s.full_name,
    s.grade
  from students s
  join users u
    on u.nis = s.nis
   and u.role = 'student'
   and u.deleted_at = 1775384665
  where s.deleted_at = 1775384665
    and s.id <> u.id
  order by s.grade asc, s.nis asc, s.full_name asc
`);

const latestBatchStandaloneTrueOrphans = await queryAll<{
  id: string;
  nis: string | null;
  full_name: string;
  grade: string | null;
}>(`
  select
    s.id,
    s.nis,
    s.full_name,
    s.grade
  from students s
  left join users u
    on u.nis = s.nis
   and u.role = 'student'
   and u.deleted_at = 1775384665
  where s.deleted_at = 1775384665
    and u.id is null
  order by s.grade asc, s.nis asc, s.full_name asc
`);

const activeOverlapByNis = await queryAll<{
  student_id: string;
  user_id: string;
  nis: string | null;
  full_name: string;
  grade: string | null;
}>(`
  select
    s.id as student_id,
    u.id as user_id,
    s.nis,
    s.full_name,
    s.grade
  from students s
  join users u
    on u.nis = s.nis
   and u.role = 'student'
   and u.deleted_at is null
   and u.is_active = 1
  where s.deleted_at is null
    and s.id <> u.id
  order by s.grade asc, s.nis asc, s.full_name asc
`);

const activeClasses = await queryAll<{
  id: string;
  name: string;
  is_active: number | boolean;
  deleted_at: string | number | null;
}>(`
  select id, name, is_active, deleted_at
  from classes
  where deleted_at is null
  order by name asc
`);

console.log(
  JSON.stringify(
    {
      url,
      counts,
      deletionGroups,
      latestBatchStandaloneDeletedStudents,
      latestBatchStandaloneByGrade,
      activeStandaloneByGrade,
      latestBatchStandaloneWithDeletedUserNisMatch,
      latestBatchStandaloneTrueOrphans,
      activeOverlapByNis,
      activeClasses,
      deletedStudents,
      deletedUsers,
    },
    null,
    2,
  ),
);
