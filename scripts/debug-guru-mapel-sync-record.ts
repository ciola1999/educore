// @ts-nocheck
import { createClient } from "@libsql/client";
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

function resolveCloudClient() {
  const url =
    process.env.AUTH_DATABASE_URL ||
    process.env.TURSO_DATABASE_URL ||
    process.env.DATABASE_URL;
  const authToken =
    process.env.AUTH_DATABASE_AUTH_TOKEN ||
    process.env.TURSO_AUTH_TOKEN ||
    process.env.TURSO_DATABASE_AUTH_TOKEN ||
    process.env.TURSO_DATABASE_TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error("Cloud database credentials are not configured");
  }

  return createClient({
    url: url.replace("libsql://", "https://"),
    authToken,
  });
}

async function queryCloudOne(client, sql, args = []) {
  const result = await client.execute({ sql, args });
  return result.rows?.[0] ?? null;
}

async function queryCloudAll(client, sql, args = []) {
  const result = await client.execute({ sql, args });
  return result.rows ?? [];
}

const recordId = process.argv[2];

if (!recordId) {
  throw new Error("Usage: bun run scripts/debug-guru-mapel-sync-record.ts <guru_mapel_id>");
}

const dbPath = resolveDesktopDbPath();
const db = new Database(dbPath, { readonly: true });
const cloud = resolveCloudClient();

const localAssignment = db
  .query(
    `
      select *
      from guru_mapel
      where id = ?
      limit 1
    `,
  )
  .get(recordId);

if (!localAssignment) {
  throw new Error(`Local guru_mapel record not found: ${recordId}`);
}

const localGuru = db
  .query(`select * from users where id = ? limit 1`)
  .get(localAssignment.guru_id);
const localSubject = db
  .query(`select * from subjects where id = ? limit 1`)
  .get(localAssignment.mata_pelajaran_id);
const localClass = db
  .query(`select * from classes where id = ? limit 1`)
  .get(localAssignment.kelas_id);
const localSemester = db
  .query(`select * from semester where id = ? limit 1`)
  .get(localAssignment.semester_id);
const localAcademicYear = localSemester?.tahun_ajaran_id
  ? db
      .query(`select * from tahun_ajaran where id = ? limit 1`)
      .get(localSemester.tahun_ajaran_id)
  : null;

const cloudById = {
  guru: await queryCloudOne(
    cloud,
    `select id, email, full_name, deleted_at from users where id = ? limit 1`,
    [localAssignment.guru_id],
  ),
  subject: await queryCloudOne(
    cloud,
    `select id, code, name, deleted_at from subjects where id = ? limit 1`,
    [localAssignment.mata_pelajaran_id],
  ),
  class: await queryCloudOne(
    cloud,
    `select id, name, academic_year, deleted_at from classes where id = ? limit 1`,
    [localAssignment.kelas_id],
  ),
  semester: await queryCloudOne(
    cloud,
    `select id, tahun_ajaran_id, nama, deleted_at from semester where id = ? limit 1`,
    [localAssignment.semester_id],
  ),
};

const cloudByIdentity = {
  guruByEmail: localGuru?.email
    ? await queryCloudAll(
        cloud,
        `select id, email, full_name, deleted_at
         from users
         where email = ? and deleted_at is null
         limit 5`,
        [localGuru.email],
      )
    : [],
  subjectByCode: localSubject?.code
    ? await queryCloudAll(
        cloud,
        `select id, code, name, deleted_at
         from subjects
         where code = ? and deleted_at is null
         limit 5`,
        [localSubject.code],
      )
    : [],
  classByLogicalKey:
    localClass?.name && localClass?.academic_year
      ? await queryCloudAll(
          cloud,
          `select id, name, academic_year, deleted_at
           from classes
           where name = ? and academic_year = ?
           limit 5`,
          [localClass.name, localClass.academic_year],
        )
      : [],
  classByName: localClass?.name
    ? await queryCloudAll(
        cloud,
        `select id, name, academic_year, deleted_at
         from classes
         where name = ? and deleted_at is null
         limit 5`,
        [localClass.name],
      )
    : [],
  academicYearByName: localAcademicYear?.nama
    ? await queryCloudAll(
        cloud,
        `select id, nama, deleted_at
         from tahun_ajaran
         where nama = ? and deleted_at is null
         limit 5`,
        [localAcademicYear.nama],
      )
    : [],
  semesterByLogicalKey:
    localAcademicYear?.nama && localSemester?.nama
      ? await queryCloudAll(
          cloud,
          `select s.id, s.tahun_ajaran_id, s.nama, s.deleted_at
           from semester s
           join tahun_ajaran ta on ta.id = s.tahun_ajaran_id
           where ta.nama = ? and s.nama = ?
           limit 5`,
          [localAcademicYear.nama, localSemester.nama],
        )
      : [],
  semesterByName: localSemester?.nama
    ? await queryCloudAll(
        cloud,
        `select id, tahun_ajaran_id, nama, deleted_at
         from semester
         where nama = ? and deleted_at is null
         limit 5`,
        [localSemester.nama],
      )
    : [],
  guruMapelByLogicalKey: await queryCloudAll(
    cloud,
    `select id, guru_id, mata_pelajaran_id, kelas_id, semester_id, deleted_at
     from guru_mapel
     where guru_id = ? and mata_pelajaran_id = ? and kelas_id = ? and semester_id = ?
     limit 5`,
    [
      localAssignment.guru_id,
      localAssignment.mata_pelajaran_id,
      localAssignment.kelas_id,
      localAssignment.semester_id,
    ],
  ),
};

db.close();

console.log(
  JSON.stringify(
    {
      dbPath,
      recordId,
      localAssignment,
      localParents: {
        guru: localGuru,
        subject: localSubject,
        class: localClass,
        semester: localSemester,
        academicYear: localAcademicYear,
      },
      cloudById,
      cloudByIdentity,
    },
    null,
    2,
  ),
);
