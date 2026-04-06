import { createClient } from "@libsql/client";

type CandidateRow = {
  id: string;
  nis: string | null;
  full_name: string;
  grade: string | null;
};

const PRUNE_TIMESTAMP = 1775384665;

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

const profile = (process.env.RESTORE_PROFILE || "preview").trim();
const apply = process.env.APPLY_RESTORE === "1";

async function queryAll<T>(sql: string) {
  const result = await client.execute(sql);
  return result.rows as T[];
}

async function loadTrueOrphans() {
  return queryAll<CandidateRow>(`
    select
      s.id,
      s.nis,
      s.full_name,
      s.grade
    from students s
    left join users u
      on u.nis = s.nis
     and u.role = 'student'
     and u.deleted_at = ${PRUNE_TIMESTAMP}
    where s.deleted_at = ${PRUNE_TIMESTAMP}
      and u.id is null
    order by s.grade asc, s.nis asc, s.full_name asc
  `);
}

function buildProfiles(rows: CandidateRow[]) {
  const safe29 = rows.filter(
    (row) => row.grade !== "KELAS 7" && row.grade !== "X-RPL-1",
  );
  const plusKelas7 = rows.filter((row) => row.grade !== "X-RPL-1");
  const allTrueOrphans = rows;

  return {
    safe29,
    plusKelas7,
    allTrueOrphans,
  };
}

async function getActiveStandaloneCount() {
  const result = await client.execute(`
    select count(*) as value
    from students s
    left join users u
      on u.id = s.id
     and u.role = 'student'
     and u.deleted_at is null
     and u.is_active = 1
    where s.deleted_at is null
      and u.id is null
  `);
  return Number(result.rows[0]?.value ?? 0);
}

const trueOrphans = await loadTrueOrphans();
const profiles = buildProfiles(trueOrphans);
const activeStandaloneCount = await getActiveStandaloneCount();

const summary = Object.fromEntries(
  Object.entries(profiles).map(([key, rows]) => [
    key,
    {
      candidateCount: rows.length,
      projectedStandaloneTotal: activeStandaloneCount + rows.length,
      sample: rows.slice(0, 10),
    },
  ]),
);

if (profile === "preview") {
  console.log(
    JSON.stringify(
      {
        url,
        pruneTimestamp: PRUNE_TIMESTAMP,
        activeStandaloneCount,
        profiles: summary,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const selectedRows = profiles[profile as keyof typeof profiles];

if (!selectedRows) {
  throw new Error(
    `Unknown RESTORE_PROFILE=${profile}. Use preview, safe29, plusKelas7, or allTrueOrphans.`,
  );
}

if (!apply) {
  console.log(
    JSON.stringify(
      {
        url,
        pruneTimestamp: PRUNE_TIMESTAMP,
        mode: profile,
        applyRestore: false,
        candidateCount: selectedRows.length,
        projectedStandaloneTotal: activeStandaloneCount + selectedRows.length,
        candidates: selectedRows,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const nowEpoch = Math.floor(Date.now() / 1000);
let restored = 0;

for (const row of selectedRows) {
  const result = await client.execute({
    sql: `
      update students
      set deleted_at = null,
          updated_at = ?,
          sync_status = 'pending'
      where id = ?
        and deleted_at = ?
    `,
    args: [nowEpoch, row.id, PRUNE_TIMESTAMP],
  });

  restored += result.rowsAffected ?? 0;
}

console.log(
  JSON.stringify(
    {
      url,
      pruneTimestamp: PRUNE_TIMESTAMP,
      mode: profile,
      applyRestore: true,
      candidateCount: selectedRows.length,
      restored,
      projectedStandaloneTotal: activeStandaloneCount + restored,
    },
    null,
    2,
  ),
);
