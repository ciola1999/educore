import { createClient } from "@libsql/client";

type DuplicateCheck = {
  key: string;
  table: string;
  columns: string[];
};

const CHECKS: DuplicateCheck[] = [
  { key: "users.email", table: "users", columns: ["email"] },
  { key: "roles.name", table: "roles", columns: ["name"] },
  { key: "permissions.name", table: "permissions", columns: ["name"] },
  { key: "tahun_ajaran.nama", table: "tahun_ajaran", columns: ["nama"] },
  {
    key: "semester.(tahun_ajaran_id,nama)",
    table: "semester",
    columns: ["tahun_ajaran_id", "nama"],
  },
  { key: "subjects.code", table: "subjects", columns: ["code"] },
  {
    key: "classes.(name,academic_year)",
    table: "classes",
    columns: ["name", "academic_year"],
  },
  {
    key: "guru_mapel.(guru_id,mata_pelajaran_id,kelas_id,semester_id)",
    table: "guru_mapel",
    columns: ["guru_id", "mata_pelajaran_id", "kelas_id", "semester_id"],
  },
  {
    key: "jadwal.(guru_mapel_id,hari,jam_mulai,jam_selesai)",
    table: "jadwal",
    columns: ["guru_mapel_id", "hari", "jam_mulai", "jam_selesai"],
  },
  { key: "students.nis", table: "students", columns: ["nis"] },
  {
    key: "student_daily_attendance.(student_id,date)",
    table: "student_daily_attendance",
    columns: ["student_id", "date"],
  },
];

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

async function tableExists(tableName: string) {
  const result = await client.execute({
    sql: `
      select name
      from sqlite_master
      where type = 'table'
        and name = ?
      limit 1
    `,
    args: [tableName],
  });

  return result.rows.length > 0;
}

const results = [];

for (const check of CHECKS) {
  if (!(await tableExists(check.table))) {
    results.push({
      ...check,
      status: "skipped",
      reason: "missing_table",
    });
    continue;
  }

  const groupBy = check.columns.map((column) => `"${column}"`).join(", ");
  const notNullClause = check.columns
    .map((column) => `"${column}" is not null`)
    .join(" and ");

  const duplicateGroups = await client.execute({
    sql: `
      select ${groupBy}, count(*) as duplicate_count
      from "${check.table}"
      where deleted_at is null
        and ${notNullClause}
      group by ${groupBy}
      having count(*) > 1
      order by duplicate_count desc
      limit 10
    `,
  });

  const duplicateCount = await client.execute({
    sql: `
      select count(*) as value
      from (
        select 1
        from "${check.table}"
        where deleted_at is null
          and ${notNullClause}
        group by ${groupBy}
        having count(*) > 1
      ) groups
    `,
  });

  results.push({
    ...check,
    status: "ok",
    duplicateGroupCount: Number(duplicateCount.rows[0]?.value ?? 0),
    sampleGroups: duplicateGroups.rows,
  });
}

console.log(
  JSON.stringify(
    {
      url,
      results,
      nonZero: results.filter(
        (result) =>
          result.status === "ok" &&
          "duplicateGroupCount" in result &&
          result.duplicateGroupCount > 0,
      ),
    },
    null,
    2,
  ),
);
