import type Database from "@tauri-apps/plugin-sql";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { isTauri } from "../env";
import { runMigrations } from "./migrations";
import * as schema from "./schema";

/**
 * 2026 Elite Database Connection Pattern for EduCore
 * Hybrid Desktop (SQLite) + Web (Supabase/Proxy) abstraction
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
      // Web: Supabase/Proxy connection logic (placeholder for 2026 pattern)
      // In production, this would connect to Turso or a Supabase Edge Function
      console.warn("⚠️ [DB] Web mode connection - using simplified proxy");

      _db = drizzle(
        async (sql, _params, method) => {
          // This part would normally call an API endpoint
          // For now, we use a placeholder that throws or logs
          console.info(`[DB_WEB_STUB] ${method}: ${sql}`);
          return { rows: [] };
        },
        { schema },
      );
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
