import type Database from "@tauri-apps/plugin-sql";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { isTauri } from "../env";
import { type DatabaseLike, runMigrations } from "./migrations";
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

/**
 * Initialize and get the database instance
 */
export const getDatabase = async () => {
  if (_db) return _db;
  if (_initializing) return _initializing;

  _initializing = (async () => {
    if (isTauri()) {
      // Desktop: Native SQLite via Tauri Plugin SQL
      const { default: Database } = await import("@tauri-apps/plugin-sql");
      _sqliteRemote = await Database.load("sqlite:educore_v4.db");

      // Hardening & integrity defaults
      await _sqliteRemote.execute("PRAGMA foreign_keys = ON");
      await _sqliteRemote.execute("PRAGMA journal_mode = WAL");

      // Ensure schema exists before any query execution
      await runMigrations(_sqliteRemote);

      _db = drizzle(
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
    } else {
      // Web: libSQL WASM for local-first in browser
      try {
        const { createClient } = await import("@libsql/client/web");
        let url = process.env.NEXT_PUBLIC_DATABASE_URL || "libsql://local.db";
        const authToken = process.env.NEXT_PUBLIC_DATABASE_AUTH_TOKEN;

        // Elite 2026 Web Pattern: Always use https for Turso in browser to avoid protocol issues
        if (url.startsWith("libsql://")) {
          url = url.replace("libsql://", "https://");
        }

        console.info(
          `🌐 [DB] Connecting to libSQL at: ${url} (Token: ${authToken ? "Present" : "Missing"})`,
        );

        const client = createClient({
          url: url,
          authToken: authToken,
        });

        if (url === "libsql://local.db") {
          console.warn(
            "⚠️ [DB] Using default local.db URL on web. This WILL FAIL to fetch unless a local sqld server is running and accessible.",
          );
        }

        _db = drizzle(
          async (sql, params, method) => {
            try {
              if (method === "run") {
                const result = await client.execute({
                  sql,
                  args: params as any[],
                });
                return {
                  rows: [],
                  rowsAffected: result.rowsAffected,
                  insertId: result.lastInsertRowid?.toString() ?? 0,
                };
              }

              const result = await client.execute({
                sql,
                args: params as any[],
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

        // Run migrations for web too
        const dbLike: DatabaseLike = {
          execute: async (sql, params) => {
            const res = await client.execute({
              sql,
              args: (params || []) as any[],
            });
            return {
              rowsAffected: res.rowsAffected,
              lastInsertId: res.lastInsertRowid?.toString() || 0,
              rows: res.rows as any[],
            };
          },
          select: async (sql, params) => {
            const res = await client.execute({
              sql,
              args: (params || []) as any[],
            });
            return res.rows as any[];
          },
        };

        try {
          await runMigrations(dbLike);
        } catch (migrationError) {
          console.error(
            "❌ [DB_MIGRATION_WEB_ERROR] Could not run migrations on web.",
            migrationError,
          );
        }
      } catch (e) {
        console.error("❌ [DB_INIT_WEB_ERROR]", e);
        // Fallback or error
        throw e;
      }
    }

    if (!_db) {
      throw new Error("Failed to initialize database connection");
    }

    return _db;
  })();

  try {
    return await _initializing;
  } finally {
    _initializing = null;
  }
};

/**
 * Compatibility export for older getDb calls
 */
export const getDb = getDatabase;
