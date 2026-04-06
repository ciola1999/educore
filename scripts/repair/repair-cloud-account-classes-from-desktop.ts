// @ts-nocheck
import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@libsql/client";

const UUID_LIKE_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuidLike(value: string | null | undefined) {
  return UUID_LIKE_PATTERN.test((value || "").trim());
}

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

const cloudUrl =
  process.env.SYNC_DATABASE_URL ||
  process.env.TURSO_DATABASE_URL ||
  process.env.DATABASE_URL;
const cloudAuthToken =
  process.env.SYNC_DATABASE_AUTH_TOKEN ||
  process.env.TURSO_AUTH_TOKEN ||
  process.env.DATABASE_AUTH_TOKEN;

if (!cloudUrl) {
  throw new Error("Missing cloud database URL env");
}

const apply = process.env.APPLY_REPAIR === "1";
const manualNis = process.env.MANUAL_NIS?.trim() || "";
const manualClassName = process.env.MANUAL_CLASS_NAME?.trim() || "";
const desktopDbPath = resolveDesktopDbPath();
const desktopDb = new Database(desktopDbPath, { readonly: true });
const cloud = createClient({
  url: cloudUrl,
  authToken: cloudAuthToken,
});

const desktopRows = desktopDb
  .query(`
    select
      s.id as student_id,
      s.nis,
      s.full_name,
      s.grade as student_grade,
      u.email as account_email,
      u.kelas_id as user_kelas_id,
      c.name as joined_class_name
    from students s
    join users u
      on u.id = s.id
     and u.role = 'student'
     and u.deleted_at is null
     and u.is_active = 1
    left join classes c
      on c.id = u.kelas_id
     and c.deleted_at is null
    where s.deleted_at is null
    order by s.full_name asc, s.nis asc
  `)
  .all() as Array<{
  student_id: string;
  nis: string | null;
  full_name: string;
  student_grade: string | null;
  account_email: string | null;
  user_kelas_id: string | null;
  joined_class_name: string | null;
}>;

const desktopByNis = new Map(
  desktopRows
    .filter((row) => {
      const grade = row.student_grade?.trim() || "";
      const className = row.joined_class_name?.trim() || "";
      const usableClass = className && !isUuidLike(className);
      const usableGrade = grade && grade !== "UNASSIGNED" && !isUuidLike(grade);
      return Boolean(row.nis?.trim()) && (usableClass || usableGrade);
    })
    .map((row) => [row.nis?.trim(), row]),
);

const cloudResult = await cloud.execute(`
  select
    s.id as student_id,
    s.nis,
    s.full_name,
    s.grade as student_grade,
    s.updated_at as student_updated_at,
    u.email as account_email,
    u.kelas_id as user_kelas_id,
    u.updated_at as user_updated_at,
    c.name as joined_class_name,
    c.academic_year as joined_class_academic_year,
    c.deleted_at as joined_class_deleted_at
  from students s
  join users u
    on u.id = s.id
   and u.role = 'student'
   and u.deleted_at is null
   and u.is_active = 1
  left join classes c
    on c.id = u.kelas_id
   and c.deleted_at is null
  where s.deleted_at is null
  order by s.full_name asc, s.nis asc
`);

const nowEpoch = Math.floor(Date.now() / 1000);
const repairPlan: Array<{
  nis: string;
  studentId: string;
  fullName: string;
  targetClassName: string;
  targetClassId: string;
  currentStudentGrade: string | null;
  currentUserKelasId: string | null;
  currentJoinedClassName: string | null;
  source: string;
}> = [];

for (const row of cloudResult.rows as Array<{
  student_id: string;
  nis: string | null;
  full_name: string;
  student_grade: string | null;
  account_email: string | null;
  user_kelas_id: string | null;
  joined_class_name: string | null;
  joined_class_academic_year: string | null;
}>) {
  const nis = row.nis?.trim();
  if (!nis) continue;

  const isManualTarget = Boolean(
    manualNis &&
      manualClassName &&
      nis === manualNis &&
      manualClassName !== "UNASSIGNED" &&
      !isUuidLike(manualClassName),
  );
  const desktopRow = desktopByNis.get(nis);
  if (!desktopRow && !isManualTarget) {
    continue;
  }

  const currentGrade = row.student_grade?.trim() || null;
  const currentClassName = row.joined_class_name?.trim() || null;
  const cloudLooksBroken =
    !currentClassName ||
    currentClassName === "UNASSIGNED" ||
    isUuidLike(currentClassName) ||
    !currentGrade ||
    currentGrade === "UNASSIGNED" ||
    isUuidLike(currentGrade);

  if (!cloudLooksBroken) {
    continue;
  }

  const targetClassName = isManualTarget
    ? manualClassName
    : desktopRow?.joined_class_name?.trim() ||
      desktopRow?.student_grade?.trim() ||
      "";
  if (
    !targetClassName ||
    targetClassName === "UNASSIGNED" ||
    isUuidLike(targetClassName)
  ) {
    continue;
  }

  const classLookup = await cloud.execute({
    sql: `
      select id
      from classes
      where name = ?
        and deleted_at is null
      order by updated_at desc
      limit 1
    `,
    args: [targetClassName],
  });

  let targetClassId = (classLookup.rows[0]?.id as string | undefined) ?? null;

  if (!targetClassId) {
    targetClassId =
      !isManualTarget &&
      desktopRow?.user_kelas_id?.trim() &&
      !isUuidLike(desktopRow.joined_class_name)
        ? desktopRow.user_kelas_id.trim()
        : crypto.randomUUID();

    if (apply) {
      await cloud.execute({
        sql: `
          insert into classes (
            id,
            name,
            academic_year,
            is_active,
            created_at,
            updated_at,
            sync_status
          ) values (?, ?, ?, 1, ?, ?, 'pending')
        `,
        args: [targetClassId, targetClassName, "2026/2027", nowEpoch, nowEpoch],
      });
    }
  }

  repairPlan.push({
    nis,
    studentId: row.student_id,
    fullName: row.full_name,
    targetClassName,
    targetClassId,
    currentStudentGrade: currentGrade,
    currentUserKelasId: row.user_kelas_id?.trim() || null,
    currentJoinedClassName: currentClassName,
    source: isManualTarget ? "manual-env" : desktopDbPath,
  });

  if (!apply) {
    continue;
  }

  await cloud.execute({
    sql: `
      update students
      set grade = ?,
          updated_at = ?,
          sync_status = 'pending'
      where id = ?
        and deleted_at is null
    `,
    args: [targetClassName, nowEpoch, row.student_id],
  });

  await cloud.execute({
    sql: `
      update users
      set kelas_id = ?,
          updated_at = ?,
          sync_status = 'pending'
      where id = ?
        and role = 'student'
        and deleted_at is null
    `,
    args: [targetClassId, nowEpoch, row.student_id],
  });
}

console.log(
  JSON.stringify(
    {
      apply,
      cloudUrl,
      desktopDbPath,
      candidateCount: repairPlan.length,
      repairs: repairPlan,
    },
    null,
    2,
  ),
);
