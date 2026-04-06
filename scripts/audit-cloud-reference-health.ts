import { createClient } from "@libsql/client";

type RefCheck = {
  key: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn?: string;
  where?: string;
};

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

const CHECKS: RefCheck[] = [
  {
    key: "users.kelas_id -> classes.id",
    sourceTable: "users",
    sourceColumn: "kelas_id",
    targetTable: "classes",
    where: "src.deleted_at is null and ref.deleted_at is null",
  },
  {
    key: "attendance.student_id -> students.id",
    sourceTable: "attendance",
    sourceColumn: "student_id",
    targetTable: "students",
    where: "src.deleted_at is null and ref.deleted_at is null",
  },
  {
    key: "attendance.class_id -> classes.id",
    sourceTable: "attendance",
    sourceColumn: "class_id",
    targetTable: "classes",
    where: "src.deleted_at is null and ref.deleted_at is null",
  },
  {
    key: "guru_mapel.guru_id -> users.id",
    sourceTable: "guru_mapel",
    sourceColumn: "guru_id",
    targetTable: "users",
    where: "src.deleted_at is null and ref.deleted_at is null",
  },
  {
    key: "guru_mapel.mata_pelajaran_id -> subjects.id",
    sourceTable: "guru_mapel",
    sourceColumn: "mata_pelajaran_id",
    targetTable: "subjects",
    where: "src.deleted_at is null and ref.deleted_at is null",
  },
  {
    key: "guru_mapel.kelas_id -> classes.id",
    sourceTable: "guru_mapel",
    sourceColumn: "kelas_id",
    targetTable: "classes",
    where: "src.deleted_at is null and ref.deleted_at is null",
  },
  {
    key: "guru_mapel.semester_id -> semester.id",
    sourceTable: "guru_mapel",
    sourceColumn: "semester_id",
    targetTable: "semester",
    where: "src.deleted_at is null and ref.deleted_at is null",
  },
  {
    key: "jadwal.guru_mapel_id -> guru_mapel.id",
    sourceTable: "jadwal",
    sourceColumn: "guru_mapel_id",
    targetTable: "guru_mapel",
    where: "src.deleted_at is null and ref.deleted_at is null",
  },
  {
    key: "student_daily_attendance.student_id -> students.id",
    sourceTable: "student_daily_attendance",
    sourceColumn: "student_id",
    targetTable: "students",
    where: "src.deleted_at is null and ref.deleted_at is null",
  },
  {
    key: "nilai.siswa_id -> users.id",
    sourceTable: "nilai",
    sourceColumn: "siswa_id",
    targetTable: "users",
    where: "src.deleted_at is null and ref.deleted_at is null",
  },
  {
    key: "nilai.guru_mapel_id -> guru_mapel.id",
    sourceTable: "nilai",
    sourceColumn: "guru_mapel_id",
    targetTable: "guru_mapel",
    where: "src.deleted_at is null and ref.deleted_at is null",
  },
  {
    key: "raport.siswa_id -> users.id",
    sourceTable: "raport",
    sourceColumn: "siswa_id",
    targetTable: "users",
    where: "src.deleted_at is null and ref.deleted_at is null",
  },
  {
    key: "raport.kelas_id -> classes.id",
    sourceTable: "raport",
    sourceColumn: "kelas_id",
    targetTable: "classes",
    where: "src.deleted_at is null and ref.deleted_at is null",
  },
  {
    key: "raport.semester_id -> semester.id",
    sourceTable: "raport",
    sourceColumn: "semester_id",
    targetTable: "semester",
    where: "src.deleted_at is null and ref.deleted_at is null",
  },
  {
    key: "raport.tahun_ajaran_id -> tahun_ajaran.id",
    sourceTable: "raport",
    sourceColumn: "tahun_ajaran_id",
    targetTable: "tahun_ajaran",
    where: "src.deleted_at is null and ref.deleted_at is null",
  },
  {
    key: "pengumuman.kelas_id -> classes.id",
    sourceTable: "pengumuman",
    sourceColumn: "kelas_id",
    targetTable: "classes",
    where: "src.deleted_at is null and ref.deleted_at is null",
  },
  {
    key: "pengumuman.created_by -> users.id",
    sourceTable: "pengumuman",
    sourceColumn: "created_by",
    targetTable: "users",
    where: "src.deleted_at is null and ref.deleted_at is null",
  },
  {
    key: "notifikasi.user_id -> users.id",
    sourceTable: "notifikasi",
    sourceColumn: "user_id",
    targetTable: "users",
    where: "src.deleted_at is null and ref.deleted_at is null",
  },
];

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

const existingTableResults = await Promise.all(
  [
    ...new Set(
      CHECKS.flatMap((check) => [check.sourceTable, check.targetTable]),
    ),
  ].map(
    async (tableName) => [tableName, await tableExists(tableName)] as const,
  ),
);
const existingTables = new Map(existingTableResults);

const results = [];

for (const check of CHECKS) {
  if (
    !existingTables.get(check.sourceTable) ||
    !existingTables.get(check.targetTable)
  ) {
    results.push({
      ...check,
      status: "skipped",
      reason: "missing_table",
    });
    continue;
  }

  const whereSql = check.where ? `where ${check.where}` : "where 1 = 1";

  const countResult = await client.execute({
    sql: `
      select count(*) as value
      from ${check.sourceTable} src
      left join ${check.targetTable} ref
        on ref.${check.targetColumn ?? "id"} = src.${check.sourceColumn}
      ${whereSql}
        and src.${check.sourceColumn} is not null
        and ref.${check.targetColumn ?? "id"} is null
    `,
  });

  const sampleResult = await client.execute({
    sql: `
      select src.*
      from ${check.sourceTable} src
      left join ${check.targetTable} ref
        on ref.${check.targetColumn ?? "id"} = src.${check.sourceColumn}
      ${whereSql}
        and src.${check.sourceColumn} is not null
        and ref.${check.targetColumn ?? "id"} is null
      limit 5
    `,
  });

  results.push({
    ...check,
    status: "ok",
    orphanCount: Number(countResult.rows[0]?.value ?? 0),
    sampleRows: sampleResult.rows,
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
          "orphanCount" in result &&
          result.orphanCount > 0,
      ),
    },
    null,
    2,
  ),
);
