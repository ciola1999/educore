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

const sourceClassId = process.env.SOURCE_CLASS_ID?.trim();
const targetClassName = process.env.TARGET_CLASS_NAME?.trim();
const apply = process.env.APPLY_REPAIR === "1";

if (!sourceClassId) {
  throw new Error("SOURCE_CLASS_ID is required");
}

if (!targetClassName) {
  throw new Error("TARGET_CLASS_NAME is required");
}

const dbPath = resolveDesktopDbPath();
const db = new Database(dbPath);
const nowEpoch = Math.floor(Date.now() / 1000);

const sourceBefore = db
  .query(
    `
      select id, name, deleted_at, updated_at, sync_status
      from classes
      where id = ?
      limit 1
    `,
  )
  .get(sourceClassId);

const targetClass = db
  .query(
    `
      select id, name
      from classes
      where name = ?
        and deleted_at is null
      limit 1
    `,
  )
  .get(targetClassName) as { id?: string; name?: string } | undefined;

const targetClassId = targetClass?.id;
if (!targetClassId) {
  throw new Error(`Target class ${targetClassName} not found`);
}

const beforeRefs = db
  .query(
    `
      select count(*) as attendance_count
      from attendance
      where class_id = ?
        and deleted_at is null
    `,
  )
  .get(sourceClassId) as { attendance_count?: number } | undefined;

let updateRows = 0;
let deleteRows = 0;

if (apply) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const updateResult = db
      .query(
        `
          update attendance
          set class_id = ?, updated_at = ?, sync_status = 'pending'
          where class_id = ?
            and deleted_at is null
        `,
      )
      .run(targetClassId, nowEpoch, sourceClassId);
    updateRows = Number(updateResult.changes ?? 0);

    const deleteResult = db
      .query(
        `
          update classes
          set deleted_at = ?, updated_at = ?, sync_status = 'pending'
          where id = ?
            and deleted_at is null
        `,
      )
      .run(nowEpoch, nowEpoch, sourceClassId);
    updateRows = Number(updateResult.changes ?? 0);
    deleteRows = Number(deleteResult.changes ?? 0);

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

const afterRefs = db
  .query(
    `
      select
        (select count(*) from attendance where class_id = ? and deleted_at is null) as source_attendance_count,
        (select count(*) from attendance where class_id = ? and deleted_at is null) as target_attendance_count
    `,
  )
  .get(sourceClassId, targetClassId);

const sourceAfter = db
  .query(
    `
      select id, name, deleted_at, updated_at, sync_status
      from classes
      where id = ?
      limit 1
    `,
  )
  .get(sourceClassId);

db.close();

console.log(
  JSON.stringify(
    {
      dbPath,
      apply,
      sourceClassId,
      targetClassId,
      targetClassName,
      beforeClass: sourceBefore ?? null,
      beforeAttendanceCount: beforeRefs?.attendance_count ?? 0,
      updateRows,
      deleteRows,
      afterClass: sourceAfter ?? null,
      afterRefs: afterRefs ?? null,
    },
    null,
    2,
  ),
);
