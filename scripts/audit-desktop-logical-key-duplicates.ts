// @ts-nocheck
import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";

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

const results = [];

for (const check of CHECKS) {
  if (!existingTables.has(check.table)) {
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

  const duplicateGroups = db
    .query(
      `
        select ${groupBy}, count(*) as duplicate_count
        from "${check.table}"
        where deleted_at is null
          and ${notNullClause}
        group by ${groupBy}
        having count(*) > 1
        order by duplicate_count desc
      `,
    )
    .all();

  results.push({
    ...check,
    status: "ok",
    duplicateGroupCount: duplicateGroups.length,
    sampleGroups: duplicateGroups.slice(0, 10),
  });
}

db.close();

console.log(
  JSON.stringify(
    {
      dbPath,
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
