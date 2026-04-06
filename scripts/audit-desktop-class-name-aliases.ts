// @ts-nocheck
import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  canonicalizeClassDisplayName,
  isUuidLikeClassValue,
} from "@/lib/utils/class-name";

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

const rows = db
  .query(`
    select id, name, academic_year as academicYear
    from classes
    where deleted_at is null
    order by name asc, academic_year asc
  `)
  .all() as Array<{
  id: string;
  name: string;
  academicYear: string | null;
}>;

const uuidNamedClasses = rows.filter((row) => isUuidLikeClassValue(row.name));
const grouped = new Map<
  string,
  Array<{ id: string; name: string; academicYear: string | null }>
>();

for (const row of rows) {
  const key = canonicalizeClassDisplayName(row.name);
  const bucket = grouped.get(key) ?? [];
  bucket.push(row);
  grouped.set(key, bucket);
}

const aliasGroups = [...grouped.entries()]
  .filter(([, bucket]) => new Set(bucket.map((item) => item.name)).size > 1)
  .map(([canonicalName, bucket]) => ({
    canonicalName,
    variants: bucket,
  }));

console.log(
  JSON.stringify(
    {
      dbPath,
      totalClasses: rows.length,
      uuidNamedClasses,
      aliasGroups,
    },
    null,
    2,
  ),
);
