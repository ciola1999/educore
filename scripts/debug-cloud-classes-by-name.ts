import { createClient } from "@libsql/client";

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
const className = process.env.CLASS_NAME?.trim();

if (!url) {
  throw new Error("Missing cloud database URL env");
}

if (!className) {
  throw new Error("CLASS_NAME is required");
}

const client = createClient({
  url: url.replace("libsql://", "https://"),
  authToken,
});

const result = await client.execute({
  sql: `
    select id, name, academic_year, deleted_at, updated_at, sync_status
    from classes
    where name = ?
    order by deleted_at asc, updated_at desc
  `,
  args: [className],
});

console.log(
  JSON.stringify(
    {
      className,
      count: result.rows.length,
      rows: result.rows,
    },
    null,
    2,
  ),
);
