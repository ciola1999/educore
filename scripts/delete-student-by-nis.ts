// @ts-nocheck
import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@libsql/client";

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
    process.env.TURSO_DATABASE_TURSO_AUTH_TOKEN ||
    process.env.DATABASE_AUTH_TOKEN;

  if (!url) {
    throw new Error("Cloud database URL is not configured");
  }

  return createClient({
    url: url.replace("libsql://", "https://"),
    authToken,
  });
}

function isUuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim(),
  );
}

async function deleteFromDesktop(nis, nowEpoch) {
  const dbPath = resolveDesktopDbPath();
  const db = new Database(dbPath);

  const row = db
    .query(
      `
        select
          s.id as student_id,
          s.nis,
          s.full_name,
          u.id as user_id,
          u.kelas_id,
          c.name as class_name
        from students s
        left join users u on u.id = s.id and u.deleted_at is null
        left join classes c on c.id = u.kelas_id and c.deleted_at is null
        where s.nis = ? and s.deleted_at is null
        limit 1
      `,
    )
    .get(nis);

  if (!row) {
    db.close();
    return { found: false, deleted: false, classCleaned: false };
  }

  db.run(
    `
      update students
      set deleted_at = ?, updated_at = ?, sync_status = 'pending'
      where id = ? and deleted_at is null
    `,
    [nowEpoch, nowEpoch, row.student_id],
  );

  db.run(
    `
      update users
      set deleted_at = ?, updated_at = ?, sync_status = 'pending'
      where id = ? and deleted_at is null
    `,
    [nowEpoch, nowEpoch, row.student_id],
  );

  let classCleaned = false;
  if (row.kelas_id && isUuidLike(row.class_name)) {
    const refs = db
      .query(
        `
          select
            (select count(*) from users where kelas_id = ? and deleted_at is null) as users_count,
            (select count(*) from attendance where class_id = ? and deleted_at is null) as attendance_count,
            (select count(*) from guru_mapel where kelas_id = ? and deleted_at is null) as guru_mapel_count,
            (select count(*) from raport where kelas_id = ? and deleted_at is null) as raport_count,
          (select count(*) from pengumuman where kelas_id = ? and deleted_at is null) as pengumuman_count
        `,
      )
      .get([
        row.kelas_id,
        row.kelas_id,
        row.kelas_id,
        row.kelas_id,
        row.kelas_id,
      ]);

    const totalRefs =
      Number(refs?.users_count || 0) +
      Number(refs?.attendance_count || 0) +
      Number(refs?.guru_mapel_count || 0) +
      Number(refs?.raport_count || 0) +
      Number(refs?.pengumuman_count || 0);

    if (totalRefs === 0) {
      db.run(
        `
          update classes
          set deleted_at = ?, updated_at = ?, sync_status = 'pending'
          where id = ? and deleted_at is null
        `,
        [nowEpoch, nowEpoch, row.kelas_id],
      );
      classCleaned = true;
    }
  }

  db.close();

  return {
    found: true,
    deleted: true,
    classCleaned,
    row,
  };
}

async function deleteFromCloud(nis, nowEpoch) {
  const client = resolveCloudClient();
  const result = await client.execute({
    sql: `
      select
        s.id as student_id,
        s.nis,
        s.full_name,
        u.id as user_id,
        u.kelas_id,
        c.name as class_name
      from students s
      left join users u on u.id = s.id and u.deleted_at is null
      left join classes c on c.id = u.kelas_id and c.deleted_at is null
      where s.nis = ? and s.deleted_at is null
      limit 1
    `,
    args: [nis],
  });

  const row = result.rows?.[0];
  if (!row) {
    return { found: false, deleted: false, classCleaned: false };
  }

  await client.batch(
    [
      {
        sql: `
          update students
          set deleted_at = ?, updated_at = ?, sync_status = 'pending'
          where id = ? and deleted_at is null
        `,
        args: [nowEpoch, nowEpoch, row.student_id],
      },
      {
        sql: `
          update users
          set deleted_at = ?, updated_at = ?, sync_status = 'pending'
          where id = ? and deleted_at is null
        `,
        args: [nowEpoch, nowEpoch, row.student_id],
      },
    ],
    "write",
  );

  let classCleaned = false;
  if (row.kelas_id && isUuidLike(row.class_name)) {
    const refs = await client.execute({
      sql: `
        select
          (select count(*) from users where kelas_id = ? and deleted_at is null) as users_count,
          (select count(*) from attendance where class_id = ? and deleted_at is null) as attendance_count,
          (select count(*) from guru_mapel where kelas_id = ? and deleted_at is null) as guru_mapel_count,
          (select count(*) from raport where kelas_id = ? and deleted_at is null) as raport_count,
          (select count(*) from pengumuman where kelas_id = ? and deleted_at is null) as pengumuman_count
      `,
      args: [
        row.kelas_id,
        row.kelas_id,
        row.kelas_id,
        row.kelas_id,
        row.kelas_id,
      ],
    });
    const refRow = refs.rows?.[0] || {};
    const totalRefs =
      Number(refRow.users_count || 0) +
      Number(refRow.attendance_count || 0) +
      Number(refRow.guru_mapel_count || 0) +
      Number(refRow.raport_count || 0) +
      Number(refRow.pengumuman_count || 0);

    if (totalRefs === 0) {
      await client.execute({
        sql: `
          update classes
          set deleted_at = ?, updated_at = ?, sync_status = 'pending'
          where id = ? and deleted_at is null
        `,
        args: [nowEpoch, nowEpoch, row.kelas_id],
      });
      classCleaned = true;
    }
  }

  return {
    found: true,
    deleted: true,
    classCleaned,
    row,
  };
}

const nis = process.env.STUDENT_NIS?.trim();
const target = process.env.DELETE_TARGET?.trim().toLowerCase() || "both";

if (!nis) {
  throw new Error("STUDENT_NIS is required");
}

if (!["desktop", "cloud", "both"].includes(target)) {
  throw new Error("DELETE_TARGET must be one of: desktop, cloud, both");
}

const nowEpoch = Math.floor(Date.now() / 1000);
const output = {
  nis,
  target,
  desktop: null,
  cloud: null,
};

if (target === "desktop" || target === "both") {
  output.desktop = await deleteFromDesktop(nis, nowEpoch);
}

if (target === "cloud" || target === "both") {
  output.cloud = await deleteFromCloud(nis, nowEpoch);
}

console.log(JSON.stringify(output, null, 2));
