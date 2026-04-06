import { createClient } from "@libsql/client";

const url =
  process.env.SYNC_DATABASE_URL ||
  process.env.TURSO_DATABASE_URL ||
  process.env.DATABASE_URL;
const authToken =
  process.env.SYNC_DATABASE_AUTH_TOKEN ||
  process.env.TURSO_AUTH_TOKEN ||
  process.env.DATABASE_AUTH_TOKEN;
const sourceClassId = process.env.SOURCE_CLASS_ID?.trim();
const targetClassName = process.env.TARGET_CLASS_NAME?.trim();
const apply = process.env.APPLY_REPAIR === "1";

if (!url) {
  throw new Error("Missing cloud database URL env");
}

if (!sourceClassId) {
  throw new Error("SOURCE_CLASS_ID is required");
}

if (!targetClassName) {
  throw new Error("TARGET_CLASS_NAME is required");
}

const client = createClient({
  url,
  authToken,
});
const nowEpoch = Math.floor(Date.now() / 1000);

const sourceBefore = await client.execute({
  sql: `
    select id, name, deleted_at, updated_at, sync_status
    from classes
    where id = ?
    limit 1
  `,
  args: [sourceClassId],
});

const targetClass = await client.execute({
  sql: `
    select id, name
    from classes
    where name = ?
      and deleted_at is null
    limit 1
  `,
  args: [targetClassName],
});

const targetClassId = targetClass.rows[0]?.id;
if (typeof targetClassId !== "string" || !targetClassId.trim()) {
  throw new Error(`Target class ${targetClassName} not found`);
}

const beforeRefs = await client.execute({
  sql: `
    select count(*) as attendance_count
    from attendance
    where class_id = ?
      and deleted_at is null
  `,
  args: [sourceClassId],
});

let updateRows = 0;
let deleteRows = 0;

if (apply) {
  const updateResult = await client.execute({
    sql: `
      update attendance
      set class_id = ?, updated_at = ?, sync_status = 'pending'
      where class_id = ?
        and deleted_at is null
    `,
    args: [targetClassId, nowEpoch, sourceClassId],
  });
  updateRows = updateResult.rowsAffected ?? 0;

  const deleteResult = await client.execute({
    sql: `
      update classes
      set deleted_at = ?, updated_at = ?, sync_status = 'pending'
      where id = ?
        and deleted_at is null
    `,
    args: [nowEpoch, nowEpoch, sourceClassId],
  });
  deleteRows = deleteResult.rowsAffected ?? 0;
}

const afterRefs = await client.execute({
  sql: `
    select
      (select count(*) from attendance where class_id = ? and deleted_at is null) as source_attendance_count,
      (select count(*) from attendance where class_id = ? and deleted_at is null) as target_attendance_count
  `,
  args: [sourceClassId, targetClassId],
});

const sourceAfter = await client.execute({
  sql: `
    select id, name, deleted_at, updated_at, sync_status
    from classes
    where id = ?
    limit 1
  `,
  args: [sourceClassId],
});

console.log(
  JSON.stringify(
    {
      url,
      apply,
      sourceClassId,
      targetClassId,
      targetClassName,
      beforeClass: sourceBefore.rows[0] ?? null,
      beforeAttendanceCount: beforeRefs.rows[0]?.attendance_count ?? 0,
      updateRows,
      deleteRows,
      afterClass: sourceAfter.rows[0] ?? null,
      afterRefs: afterRefs.rows[0] ?? null,
    },
    null,
    2,
  ),
);
