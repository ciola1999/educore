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

const total = await client.execute(
  "select count(*) as value from students where deleted_at is null",
);

const accountBacked = await client.execute(`
  select count(*) as value
  from students s
  join users u
    on u.id = s.id
   and u.role = 'student'
   and u.deleted_at is null
   and u.is_active = 1
  where s.deleted_at is null
`);

const standalone = await client.execute(`
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

console.log(
  JSON.stringify(
    {
      url,
      totalActiveStudents: Number(total.rows[0]?.value ?? 0),
      accountBackedStudents: Number(accountBacked.rows[0]?.value ?? 0),
      standaloneStudents: Number(standalone.rows[0]?.value ?? 0),
    },
    null,
    2,
  ),
);
