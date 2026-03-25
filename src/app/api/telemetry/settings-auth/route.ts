import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";
import { createAuthDbClient } from "@/lib/auth/web/db";

const telemetryEventSchema = z.object({
  id: z.string().min(1).max(64),
  at: z.string().datetime(),
  action: z.enum([
    "sync",
    "change-password",
    "session-refresh",
    "logout",
    "sync-config-load",
    "sync-config-save",
  ]),
  status: z.enum(["info", "success", "warning", "error"]),
  runtime: z.enum(["desktop", "web"]),
  detail: z.string().min(1).max(400),
});

const telemetryEnvelopeSchema = z.object({
  page: z.literal("dashboard/settings"),
  sessionStatus: z.string().min(1).max(32),
  authSource: z.string().min(1).max(32),
  activeRole: z.string().min(1).max(32).nullable(),
  event: telemetryEventSchema,
});

const requestBodySchema = z.object({
  events: z.array(telemetryEnvelopeSchema).min(1).max(20),
});

const telemetrySummaryQuerySchema = z.object({
  hours: z.coerce.number().int().min(1).max(168).optional().default(24),
});

const TELEMETRY_TABLE = "settings_auth_telemetry_events";
const TELEMETRY_RETENTION_SECONDS = 14 * 24 * 60 * 60;

function sanitizeTelemetryText(input: string): string {
  const normalized = input.trim();
  const redactedBearer = normalized.replace(
    /bearer\s+[a-z0-9\-._~+/]+=*/gi,
    "bearer [redacted]",
  );
  const redactedJwt = redactedBearer.replace(
    /\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g,
    "[jwt-redacted]",
  );
  return redactedJwt.slice(0, 400);
}

type SessionUserLike = {
  id?: string;
  email?: string | null;
};

async function ensureTelemetryTable() {
  const client = createAuthDbClient();
  await client.execute({
    sql: `CREATE TABLE IF NOT EXISTS ${TELEMETRY_TABLE} (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_email TEXT,
      page TEXT NOT NULL,
      session_status TEXT NOT NULL,
      auth_source TEXT NOT NULL,
      active_role TEXT,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      runtime TEXT NOT NULL,
      detail TEXT NOT NULL,
      event_at TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER))
    )`,
  });
}

async function enforceTelemetryRetention() {
  const cutoff = Math.floor(Date.now() / 1000) - TELEMETRY_RETENTION_SECONDS;
  const client = createAuthDbClient();
  await client.execute({
    sql: `DELETE FROM ${TELEMETRY_TABLE} WHERE created_at < ?`,
    args: [cutoff],
  });
}

export async function POST(request: Request) {
  const session = await auth();
  const user = session?.user as SessionUserLike | undefined;
  const userId = user?.id;

  if (!userId) {
    return apiError("Unauthorized", 401, "UNAUTHORIZED");
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError("Invalid payload", 400, "INVALID_PAYLOAD");
  }

  const validation = requestBodySchema.safeParse(payload);
  if (!validation.success) {
    return apiError("Invalid telemetry payload", 400, "INVALID_TELEMETRY");
  }

  const events = validation.data.events.map((entry) => ({
    ...entry,
    event: {
      ...entry.event,
      detail: sanitizeTelemetryText(entry.event.detail),
    },
  }));

  try {
    await ensureTelemetryTable();
    const client = createAuthDbClient();
    await enforceTelemetryRetention();

    for (const entry of events) {
      await client.execute({
        sql: `INSERT INTO ${TELEMETRY_TABLE} (
          id,
          user_id,
          user_email,
          page,
          session_status,
          auth_source,
          active_role,
          action,
          status,
          runtime,
          detail,
          event_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          entry.event.id,
          userId,
          user?.email ?? null,
          entry.page,
          entry.sessionStatus,
          entry.authSource,
          entry.activeRole,
          entry.event.action,
          entry.event.status,
          entry.event.runtime,
          entry.event.detail,
          entry.event.at,
        ],
      });
    }
  } catch (error) {
    console.error("[OBS][settings-auth] persist failed", error);
    return apiError(
      "Telemetry persistence failed",
      500,
      "TELEMETRY_PERSISTENCE_FAILED",
    );
  }

  console.info("[OBS][settings-auth]", {
    at: new Date().toISOString(),
    userId,
    userEmail: user?.email ?? null,
    events,
  });

  return apiOk({ accepted: events.length });
}

export async function GET(request: Request) {
  const session = await auth();
  const user = session?.user as SessionUserLike | undefined;
  const userId = user?.id;

  if (!userId) {
    return apiError("Unauthorized", 401, "UNAUTHORIZED");
  }

  const parsedUrl = new URL(request.url);
  const queryValidation = telemetrySummaryQuerySchema.safeParse({
    hours: parsedUrl.searchParams.get("hours") ?? undefined,
  });
  if (!queryValidation.success) {
    return apiError("Invalid query", 400, "INVALID_QUERY");
  }

  try {
    await ensureTelemetryTable();
    await enforceTelemetryRetention();
    const client = createAuthDbClient();

    const windowStart =
      Math.floor(Date.now() / 1000) - queryValidation.data.hours * 60 * 60;
    const summaryRows = await client.execute({
      sql: `SELECT
              COUNT(*) AS total_events,
              SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS total_errors,
              SUM(CASE WHEN status = 'warning' THEN 1 ELSE 0 END) AS total_warnings,
              SUM(CASE WHEN detail LIKE '%incident-escalation:%' THEN 1 ELSE 0 END) AS total_escalations,
              SUM(CASE WHEN runtime = 'web' THEN 1 ELSE 0 END) AS web_events,
              SUM(CASE WHEN runtime = 'desktop' THEN 1 ELSE 0 END) AS desktop_events
            FROM ${TELEMETRY_TABLE}
            WHERE user_id = ?
              AND created_at >= ?`,
      args: [userId, windowStart],
    });

    const row = (summaryRows.rows?.[0] ?? {}) as Record<string, unknown>;
    const numberValue = (input: unknown) => {
      if (typeof input === "number") return input;
      if (typeof input === "string") {
        const parsed = Number(input);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      return 0;
    };

    return apiOk({
      hours: queryValidation.data.hours,
      totalEvents: numberValue(row.total_events),
      totalErrors: numberValue(row.total_errors),
      totalWarnings: numberValue(row.total_warnings),
      totalEscalations: numberValue(row.total_escalations),
      runtimeBreakdown: {
        web: numberValue(row.web_events),
        desktop: numberValue(row.desktop_events),
      },
    });
  } catch (error) {
    console.error("[OBS][settings-auth] summary failed", error);
    return apiError(
      "Telemetry summary failed",
      500,
      "TELEMETRY_SUMMARY_FAILED",
    );
  }
}
