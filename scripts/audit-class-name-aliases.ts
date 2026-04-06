import { createClient } from "@libsql/client";
import {
  canonicalizeClassDisplayName,
  isUuidLikeClassValue,
} from "@/lib/utils/class-name";

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

const client = createClient({
  url,
  authToken,
});

const result = await client.execute(`
  select id, name, academic_year
  from classes
  where deleted_at is null
  order by name asc, academic_year asc
`);

const rows = result.rows as unknown as Array<{
  id: string;
  name: string;
  academic_year: string | null;
}>;

const uuidNamed = rows.filter((row) => isUuidLikeClassValue(row.name));
const grouped = new Map<
  string,
  Array<{ id: string; name: string; academicYear: string | null }>
>();

for (const row of rows) {
  const key = canonicalizeClassDisplayName(row.name);
  const bucket = grouped.get(key) ?? [];
  bucket.push({
    id: row.id,
    name: row.name,
    academicYear: row.academic_year,
  });
  grouped.set(key, bucket);
}

const aliases = [...grouped.entries()]
  .filter(([, bucket]) => new Set(bucket.map((item) => item.name)).size > 1)
  .map(([canonicalName, bucket]) => ({
    canonicalName,
    variants: bucket,
  }));

console.log(
  JSON.stringify(
    {
      url,
      totalClasses: rows.length,
      uuidNamedClasses: uuidNamed,
      aliasGroups: aliases,
    },
    null,
    2,
  ),
);
