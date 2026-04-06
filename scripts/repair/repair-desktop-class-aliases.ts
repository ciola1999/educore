// @ts-nocheck
import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  canonicalizeClassDisplayName,
  isUuidLikeClassValue,
} from "@/lib/utils/class-name";

type ClassRow = {
  id: string;
  name: string;
  academicYear: string | null;
};

type RefStats = {
  users: number;
  attendance: number;
  guruMapel: number;
  jadwal: number;
  raport: number;
  pengumuman: number;
};

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

function totalRefs(stats: RefStats) {
  return (
    stats.users +
    stats.attendance +
    stats.guruMapel +
    stats.jadwal +
    stats.raport +
    stats.pengumuman
  );
}

const apply = process.env.APPLY_REPAIR === "1";
const dbPath = resolveDesktopDbPath();
const db = new Database(dbPath);
const nowEpoch = Math.floor(Date.now() / 1000);

const tableRows = db
  .query(`
    select name
    from sqlite_master
    where type = 'table'
  `)
  .all() as Array<{ name?: string }>;
const existingTables = new Set(
  tableRows
    .map((row) => row.name)
    .filter((value): value is string => typeof value === "string" && !!value),
);

function hasTable(name: string) {
  return existingTables.has(name);
}

function queryCount(sqlText: string, arg: string) {
  return Number((db.query(sqlText).get(arg) as { value?: number })?.value ?? 0);
}

function queryRefStats(classId: string): RefStats {
  return {
    users: hasTable("users")
      ? queryCount(
          `
            select count(*) as value
            from users
            where kelas_id = ?
              and deleted_at is null
          `,
          classId,
        )
      : 0,
    attendance: hasTable("attendance")
      ? queryCount(
          `
            select count(*) as value
            from attendance
            where class_id = ?
              and deleted_at is null
          `,
          classId,
        )
      : 0,
    guruMapel: hasTable("guru_mapel")
      ? queryCount(
          `
            select count(*) as value
            from guru_mapel
            where kelas_id = ?
              and deleted_at is null
          `,
          classId,
        )
      : 0,
    jadwal:
      hasTable("jadwal") && hasTable("guru_mapel")
        ? queryCount(
            `
              select count(*) as value
              from jadwal j
              join guru_mapel gm on gm.id = j.guru_mapel_id
              where gm.kelas_id = ?
                and j.deleted_at is null
                and gm.deleted_at is null
            `,
            classId,
          )
        : 0,
    raport: hasTable("raport")
      ? queryCount(
          `
            select count(*) as value
            from raport
            where kelas_id = ?
              and deleted_at is null
          `,
          classId,
        )
      : 0,
    pengumuman: hasTable("pengumuman")
      ? queryCount(
          `
            select count(*) as value
            from pengumuman
            where kelas_id = ?
              and deleted_at is null
          `,
          classId,
        )
      : 0,
  };
}

const classes = db
  .query(`
    select id, name, academic_year as academicYear
    from classes
    where deleted_at is null
    order by name asc, academic_year asc
  `)
  .all() as ClassRow[];

const groups = new Map<string, ClassRow[]>();
for (const row of classes) {
  const key = canonicalizeClassDisplayName(row.name);
  const bucket = groups.get(key) ?? [];
  bucket.push(row);
  groups.set(key, bucket);
}

const mergePlans: Array<{
  canonicalName: string;
  canonicalId: string;
  aliases: Array<{ id: string; name: string; refs: RefStats }>;
}> = [];
const staleUuidPlans: Array<{ id: string; name: string; refs: RefStats }> = [];

for (const [canonicalName, bucket] of groups.entries()) {
  const bucketWithRefs = bucket.map((row) => ({
    ...row,
    refs: queryRefStats(row.id),
  }));

  const canonicalRow =
    bucketWithRefs.slice().sort((left, right) => {
      const refDelta = totalRefs(right.refs) - totalRefs(left.refs);
      if (refDelta !== 0) {
        return refDelta;
      }

      const leftCanonical =
        left.name === canonicalName || !isUuidLikeClassValue(left.name) ? 1 : 0;
      const rightCanonical =
        right.name === canonicalName || !isUuidLikeClassValue(right.name)
          ? 1
          : 0;
      if (rightCanonical !== leftCanonical) {
        return rightCanonical - leftCanonical;
      }

      return left.id.localeCompare(right.id);
    })[0] ?? bucketWithRefs[0];

  const aliases =
    canonicalName === "UNASSIGNED"
      ? bucketWithRefs.filter(
          (row) =>
            row.id !== canonicalRow.id &&
            !isUuidLikeClassValue(row.name) &&
            row.name === canonicalRow.name,
        )
      : bucketWithRefs.filter((row) => row.id !== canonicalRow.id);

  if (aliases.length > 0) {
    mergePlans.push({
      canonicalName,
      canonicalId: canonicalRow.id,
      aliases: aliases.map((row) => ({
        id: row.id,
        name: row.name,
        refs: row.refs,
      })),
    });
  }

  if (canonicalName === "UNASSIGNED") {
    for (const row of bucket.filter((item) =>
      isUuidLikeClassValue(item.name),
    )) {
      staleUuidPlans.push({
        id: row.id,
        name: row.name,
        refs: queryRefStats(row.id),
      });
    }
  }
}

if (apply) {
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const plan of mergePlans) {
      for (const alias of plan.aliases) {
        if (hasTable("users")) {
          db.query(
            `
              update users
              set kelas_id = ?, updated_at = ?, sync_status = 'pending'
              where kelas_id = ?
                and deleted_at is null
            `,
          ).run(plan.canonicalId, nowEpoch, alias.id);
        }

        if (hasTable("attendance")) {
          db.query(
            `
              update attendance
              set class_id = ?, updated_at = ?, sync_status = 'pending'
              where class_id = ?
                and deleted_at is null
            `,
          ).run(plan.canonicalId, nowEpoch, alias.id);
        }

        if (hasTable("guru_mapel")) {
          db.query(
            `
              update guru_mapel
              set kelas_id = ?, updated_at = ?, sync_status = 'pending'
              where kelas_id = ?
                and deleted_at is null
            `,
          ).run(plan.canonicalId, nowEpoch, alias.id);
        }

        if (hasTable("raport")) {
          db.query(
            `
              update raport
              set kelas_id = ?, updated_at = ?, sync_status = 'pending'
              where kelas_id = ?
                and deleted_at is null
            `,
          ).run(plan.canonicalId, nowEpoch, alias.id);
        }

        if (hasTable("pengumuman")) {
          db.query(
            `
              update pengumuman
              set kelas_id = ?, updated_at = ?, sync_status = 'pending'
              where kelas_id = ?
                and deleted_at is null
            `,
          ).run(plan.canonicalId, nowEpoch, alias.id);
        }

        db.query(
          `
            update classes
            set deleted_at = ?, updated_at = ?, sync_status = 'pending'
            where id = ?
              and deleted_at is null
          `,
        ).run(nowEpoch, nowEpoch, alias.id);
      }
    }

    for (const stale of staleUuidPlans.filter(
      (item) => totalRefs(item.refs) === 0,
    )) {
      db.query(
        `
          update classes
          set deleted_at = ?, updated_at = ?, sync_status = 'pending'
          where id = ?
            and deleted_at is null
        `,
      ).run(nowEpoch, nowEpoch, stale.id);
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

console.log(
  JSON.stringify(
    {
      dbPath,
      apply,
      existingTables: [...existingTables].sort(),
      mergePlans,
      staleUuidPlans,
      safeUuidDeletes: staleUuidPlans.filter(
        (item) => totalRefs(item.refs) === 0,
      ),
      blockedUuidDeletes: staleUuidPlans.filter(
        (item) => totalRefs(item.refs) > 0,
      ),
    },
    null,
    2,
  ),
);
