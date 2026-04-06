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

const classRow = await client.execute({
  sql: `
    select id, name, academic_year, deleted_at, updated_at, sync_status
    from classes
    where id = ?
    limit 1
  `,
  args: [classId],
});

const refs = await client.execute({
  sql: `
    select
      (select count(*) from users where kelas_id = ? and deleted_at is null) as users_count,
      (select count(*) from attendance where class_id = ? and deleted_at is null) as attendance_count,
      (select count(*) from guru_mapel where kelas_id = ? and deleted_at is null) as guru_mapel_count,
      (select count(*) from jadwal j
        join guru_mapel gm on gm.id = j.guru_mapel_id
       where gm.kelas_id = ? and j.deleted_at is null and gm.deleted_at is null) as jadwal_count,
      (select count(*) from raport where kelas_id = ? and deleted_at is null) as raport_count,
      (select count(*) from pengumuman where kelas_id = ? and deleted_at is null) as pengumuman_count
  `,
  args: [classId, classId, classId, classId, classId, classId],
});

console.log(
  JSON.stringify(
    {
      url,
      classId,
      classRow: classRow.rows[0] ?? null,
      refs: refs.rows[0] ?? null,
    },
    null,
    2,
  ),
);
