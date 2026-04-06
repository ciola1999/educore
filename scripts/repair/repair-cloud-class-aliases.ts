import { createClient } from "@libsql/client";
import {
  canonicalizeClassDisplayName,
  isUuidLikeClassValue,
} from "@/lib/utils/class-name";

type ClassRow = {
  id: string;
  name: string;
  academic_year: string | null;
  deleted_at: number | string | null;
  updated_at: number | string | null;
};

type RefStats = {
  users: number;
  attendance: number;
  guru_mapel: number;
  schedule: number;
  raport: number;
  pengumuman: number;
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

const apply = process.env.APPLY_REPAIR === "1";
const client = createClient({
  url,
  authToken,
});
const nowEpoch = Math.floor(Date.now() / 1000);
const existingTables = new Set<string>();

const tableRows = await client.execute(`
  select name
  from sqlite_master
  where type = 'table'
`);
for (const row of tableRows.rows as Array<{ name?: string }>) {
  if (typeof row.name === "string" && row.name.trim()) {
    existingTables.add(row.name);
  }
}

function hasTable(name: string) {
  return existingTables.has(name);
}

async function queryRefStats(classId: string): Promise<RefStats> {
  return {
    users: hasTable("users")
      ? Number(
          (
            await client.execute({
              sql: `select count(*) as value from users where kelas_id = ? and deleted_at is null`,
              args: [classId],
            })
          ).rows[0]?.value ?? 0,
        )
      : 0,
    attendance: hasTable("attendance")
      ? Number(
          (
            await client.execute({
              sql: `select count(*) as value from attendance where class_id = ? and deleted_at is null`,
              args: [classId],
            })
          ).rows[0]?.value ?? 0,
        )
      : 0,
    guru_mapel: hasTable("guru_mapel")
      ? Number(
          (
            await client.execute({
              sql: `select count(*) as value from guru_mapel where kelas_id = ? and deleted_at is null`,
              args: [classId],
            })
          ).rows[0]?.value ?? 0,
        )
      : 0,
    schedule: hasTable("schedule")
      ? Number(
          (
            await client.execute({
              sql: `select count(*) as value from schedule where class_id = ? and deleted_at is null`,
              args: [classId],
            })
          ).rows[0]?.value ?? 0,
        )
      : 0,
    raport: hasTable("raport")
      ? Number(
          (
            await client.execute({
              sql: `select count(*) as value from raport where kelas_id = ? and deleted_at is null`,
              args: [classId],
            })
          ).rows[0]?.value ?? 0,
        )
      : 0,
    pengumuman: hasTable("pengumuman")
      ? Number(
          (
            await client.execute({
              sql: `select count(*) as value from pengumuman where kelas_id = ? and deleted_at is null`,
              args: [classId],
            })
          ).rows[0]?.value ?? 0,
        )
      : 0,
  };
}

function totalRefs(stats: RefStats) {
  return (
    stats.users +
    stats.attendance +
    stats.guru_mapel +
    stats.schedule +
    stats.raport +
    stats.pengumuman
  );
}

const classResult = await client.execute(`
  select id, name, academic_year, deleted_at, updated_at
  from classes
  where deleted_at is null
  order by name asc, academic_year asc
`);

const classes = classResult.rows as unknown as ClassRow[];
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
  const bucketWithRefs = [];
  for (const row of bucket) {
    bucketWithRefs.push({
      ...row,
      refs: await queryRefStats(row.id),
    });
  }

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
    const aliasRows = aliases.map((row) => ({
      id: row.id,
      name: row.name,
      refs: row.refs,
    }));

    mergePlans.push({
      canonicalName,
      canonicalId: canonicalRow.id,
      aliases: aliasRows,
    });
  }

  if (canonicalName === "UNASSIGNED") {
    for (const row of bucket.filter((item) =>
      isUuidLikeClassValue(item.name),
    )) {
      staleUuidPlans.push({
        id: row.id,
        name: row.name,
        refs: await queryRefStats(row.id),
      });
    }
  }
}

if (apply) {
  for (const plan of mergePlans) {
    for (const alias of plan.aliases) {
      const statements: Array<{ sql: string; args: Array<string | number> }> =
        [];

      if (hasTable("users")) {
        statements.push({
          sql: `
            update users
            set kelas_id = ?, updated_at = ?, sync_status = 'pending'
            where kelas_id = ? and deleted_at is null
          `,
          args: [plan.canonicalId, nowEpoch, alias.id],
        });
      }
      if (hasTable("attendance")) {
        statements.push({
          sql: `
            update attendance
            set class_id = ?, updated_at = ?, sync_status = 'pending'
            where class_id = ? and deleted_at is null
          `,
          args: [plan.canonicalId, nowEpoch, alias.id],
        });
      }
      if (hasTable("guru_mapel")) {
        statements.push({
          sql: `
            update guru_mapel
            set kelas_id = ?, updated_at = ?, sync_status = 'pending'
            where kelas_id = ? and deleted_at is null
          `,
          args: [plan.canonicalId, nowEpoch, alias.id],
        });
      }
      if (hasTable("schedule")) {
        statements.push({
          sql: `
            update schedule
            set class_id = ?, updated_at = ?, sync_status = 'pending'
            where class_id = ? and deleted_at is null
          `,
          args: [plan.canonicalId, nowEpoch, alias.id],
        });
      }
      if (hasTable("raport")) {
        statements.push({
          sql: `
            update raport
            set kelas_id = ?, updated_at = ?, sync_status = 'pending'
            where kelas_id = ? and deleted_at is null
          `,
          args: [plan.canonicalId, nowEpoch, alias.id],
        });
      }
      if (hasTable("pengumuman")) {
        statements.push({
          sql: `
            update pengumuman
            set kelas_id = ?, updated_at = ?, sync_status = 'pending'
            where kelas_id = ? and deleted_at is null
          `,
          args: [plan.canonicalId, nowEpoch, alias.id],
        });
      }

      statements.push({
        sql: `
          update classes
          set deleted_at = ?, updated_at = ?, sync_status = 'pending'
          where id = ? and deleted_at is null
        `,
        args: [nowEpoch, nowEpoch, alias.id],
      });

      await client.batch(
        statements.map((statement) => ({
          sql: statement.sql,
          args: statement.args,
        })),
      );
    }
  }

  for (const stale of staleUuidPlans.filter(
    (item) => totalRefs(item.refs) === 0,
  )) {
    await client.execute({
      sql: `
        update classes
        set deleted_at = ?, updated_at = ?, sync_status = 'pending'
        where id = ? and deleted_at is null
      `,
      args: [nowEpoch, nowEpoch, stale.id],
    });
  }
}

console.log(
  JSON.stringify(
    {
      url,
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
