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

type RefCheck = {
  key: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn?: string;
  where?: string;
};

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

const dbPath = resolveDesktopDbPath();
const db = new Database(dbPath, { readonly: true });

const tableRows = db
  .query(
    `
      select name
      from sqlite_master
      where type = 'table'
    `,
  )
  .all() as Array<{ name?: string }>;

const existingTables = new Set(
  tableRows
    .map((row) => row.name)
    .filter((value): value is string => typeof value === "string" && !!value),
);

function hasTable(name: string) {
  return existingTables.has(name);
}

const results = [];

for (const check of CHECKS) {
  if (!hasTable(check.sourceTable) || !hasTable(check.targetTable)) {
    results.push({
      ...check,
      status: "skipped",
      reason: "missing_table",
    });
    continue;
  }

  const whereSql = check.where ? `where ${check.where}` : "";
  const countRow = db
    .query(
      `
        select count(*) as value
        from ${check.sourceTable} src
        left join ${check.targetTable} ref
          on ref.${check.targetColumn ?? "id"} = src.${check.sourceColumn}
        ${whereSql}
          and src.${check.sourceColumn} is not null
          and ref.${check.targetColumn ?? "id"} is null
      `,
    )
    .get() as { value?: number } | undefined;

  const sampleRows = db
    .query(
      `
        select src.*
        from ${check.sourceTable} src
        left join ${check.targetTable} ref
          on ref.${check.targetColumn ?? "id"} = src.${check.sourceColumn}
        ${whereSql}
          and src.${check.sourceColumn} is not null
          and ref.${check.targetColumn ?? "id"} is null
        limit 5
      `,
    )
    .all();

  results.push({
    ...check,
    status: "ok",
    orphanCount: Number(countRow?.value ?? 0),
    sampleRows,
  });
}

db.close();

console.log(
  JSON.stringify(
    {
      dbPath,
      results,
      nonZero: results.filter(
        (result) => result.status === "ok" && result.orphanCount > 0,
      ),
    },
    null,
    2,
  ),
);
