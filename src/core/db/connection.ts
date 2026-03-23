import type { InValue } from "@libsql/client";
import type Database from "@tauri-apps/plugin-sql";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { isTauri } from "../env";
import {
  type DatabaseLike,
  type MigrationOptions,
  runMigrations,
} from "./migrations";
import * as schema from "./schema";

/**
 * 2026 Elite Database Connection Pattern for EduCore
 * Hybrid Desktop (SQLite) + Web (Turso/libSQL) abstraction
 */

export interface DatabaseConnection {
  select<T>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(
    sql: string,
    params?: unknown[],
  ): Promise<{ rowsAffected: number; insertId: number | string }>;
}

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sqliteRemote: Database | null = null;
let _initializing: Promise<ReturnType<typeof drizzle<typeof schema>>> | null =
  null;

export interface DatabaseInitOptions extends MigrationOptions {}

function shouldUseSharedDbCache(options?: DatabaseInitOptions): boolean {
  return (
    (options?.seedData ?? true) === true &&
    options?.forceResetAdmin === undefined
  );
}

function normalizeLibsqlUrl(url: string): string {
  return url.startsWith("libsql://")
    ? url.replace("libsql://", "https://")
    : url;
}

function resolveServerDatabaseConfig() {
  const url =
    process.env.AUTH_DATABASE_URL ||
    process.env.TURSO_DATABASE_URL ||
    process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Database URL is not configured for server runtime. Set DATABASE_URL, AUTH_DATABASE_URL, or TURSO_DATABASE_URL.",
    );
  }

  return {
    url: normalizeLibsqlUrl(url),
    authToken:
      process.env.AUTH_DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN,
  };
}

function resolveBrowserDatabaseConfig() {
  const url = process.env.NEXT_PUBLIC_DATABASE_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_DATABASE_URL is required for browser runtime database access.",
    );
  }

  return {
    url: normalizeLibsqlUrl(url),
    authToken: undefined,
  };
}

/**
 * Initialize and get the database instance
 */
export const getDatabase = async (options?: DatabaseInitOptions) => {
  const useSharedCache = shouldUseSharedDbCache(options);

  if (useSharedCache && _db) return _db;
  if (useSharedCache && _initializing) return _initializing;

  const initialize = (async () => {
    if (isTauri()) {
      // Desktop: Native SQLite via Tauri Plugin SQL
      const { default: Database } = await import("@tauri-apps/plugin-sql");
      _sqliteRemote = await Database.load("sqlite:educore.db");

      // Set encryption key for SQLCipher (if provided)
      const key = process.env.TAURI_DB_KEY;
      if (key) {
        // Escape single quotes in key to prevent SQL injection
        const safeKey = key.replace(/'/g, "''");
        await _sqliteRemote.execute(`PRAGMA key = '${safeKey}';`);
      } else {
        console.warn(
          "⚠️ [DB] TAURI_DB_KEY not set. Using unencrypted database for development.",
        );
      }

      // Hardening & integrity defaults
      await _sqliteRemote.execute("PRAGMA foreign_keys = ON");
      await _sqliteRemote.execute("PRAGMA journal_mode = WAL");

      // Ensure schema exists before any query execution
      console.info("⚡ [DB] Starting migrations...");
      await runMigrations(_sqliteRemote, options);
      console.info("✅ [DB] Migrations completed successfully.");

      const drizzleDb = drizzle(
        async (sql, params, method) => {
          try {
            if (!_sqliteRemote) throw new Error("DB not loaded");

            if (method === "run") {
              const result = await _sqliteRemote.execute(
                sql,
                params as unknown[],
              );
              const raw = result as {
                changes?: number;
                rowsAffected?: number;
                lastInsertRowid?: number | string;
                lastInsertId?: number | string;
              };
              return {
                rows: [],
                rowsAffected: raw.changes ?? raw.rowsAffected ?? 0,
                insertId: raw.lastInsertRowid ?? raw.lastInsertId ?? 0,
              };
            }

            const rows = await _sqliteRemote.select<Record<string, unknown>[]>(
              sql,
              params as unknown[],
            );

            // ALWAYS return array of arrays (values) for Drizzle proxy
            return { rows: rows.map((row) => Object.values(row)) };
          } catch (e) {
            console.error("❌ [SQL_ERROR_TAURI]", e);
            throw e;
          }
        },
        { schema },
      );

      if (useSharedCache) {
        _db = drizzleDb;
      }

      return drizzleDb;
    } else {
      // Web/Server non-Tauri: libSQL over HTTP(S)
      try {
        const isServerRuntime = typeof window === "undefined";
        const dbConfig = isServerRuntime
          ? resolveServerDatabaseConfig()
          : resolveBrowserDatabaseConfig();

        console.info(
          `🌐 [DB] Connecting to libSQL at: ${dbConfig.url} (runtime: ${
            isServerRuntime ? "server" : "browser"
          }, token: ${dbConfig.authToken ? "present" : "missing"})`,
        );

        const client = isServerRuntime
          ? (await import("@libsql/client")).createClient({
              url: dbConfig.url,
              authToken: dbConfig.authToken,
            })
          : (await import("@libsql/client/web")).createClient({
              url: dbConfig.url,
              authToken: dbConfig.authToken,
            });

        console.info("🌐 [DB] libSQL client created");

        const drizzleDb = drizzle(
          async (sql, params, method) => {
            try {
              if (method === "run") {
                const result = await client.execute({
                  sql,
                  args: params as InValue[],
                });
                return {
                  rows: [],
                  rowsAffected: result.rowsAffected,
                  insertId: result.lastInsertRowid?.toString() ?? 0,
                };
              }

              const result = await client.execute({
                sql,
                args: params as InValue[],
              });
              return {
                rows: result.rows.map((row) =>
                  Object.values(row as Record<string, unknown>),
                ),
              };
            } catch (e) {
              console.error("❌ [SQL_ERROR_WEB]", e);
              throw e;
            }
          },
          { schema },
        );

        if (useSharedCache) {
          _db = drizzleDb;
        }

        // Run migrations for web too
        const dbLike: DatabaseLike = {
          execute: async (sql, params) => {
            const res = await client.execute({
              sql,
              args: (params || []) as InValue[],
            });
            return {
              rowsAffected: res.rowsAffected,
              lastInsertId: res.lastInsertRowid?.toString() || 0,
              rows: res.rows as unknown[],
            };
          },
          select: async <T>(sql: string, params?: unknown[]): Promise<T[]> => {
            const res = await client.execute({
              sql,
              args: (params || []) as InValue[],
            });
            return res.rows as T[];
          },
        };

        try {
          await runMigrations(dbLike, options);
        } catch (migrationError) {
          console.error(
            "❌ [DB_MIGRATION_WEB_ERROR] Could not run migrations on web.",
            migrationError,
          );
        }

        return drizzleDb;
      } catch (e) {
        console.error("❌ [DB_INIT_WEB_ERROR]", e);
        // Fallback or error
        throw e;
      }
    }
  })();

  if (useSharedCache) {
    _initializing = initialize;
  }

  try {
    const db = await initialize;

    if (!db) {
      throw new Error("Failed to initialize database connection");
    }

    return db;
  } finally {
    if (useSharedCache) {
      _initializing = null;
    }
  }
};

/**
 * Compatibility export for older getDb calls
 */
export const getDb = getDatabase;
