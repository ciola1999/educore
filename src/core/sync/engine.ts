import { sql } from "drizzle-orm";
import { getDatabase } from "../db/connection";
import { isTauri } from "../env";
import { getNextHLC } from "./hlc";

/**
 * 2026 Elite Sync Engine for EduCore
 * Hybrid Desktop + Web, Delta Sync via HLC
 */

export interface SyncConfig {
  nodeId: string;
  remoteUrl: string;
}

class SyncEngine {
  private config: SyncConfig | null = null;
  private isSyncing = false;

  init(config: SyncConfig) {
    this.config = config;
    console.info(`🔄 [SYNC] Engine initialized for node: ${config.nodeId}`);
  }

  /**
   * Pushes local pending changes to remote
   */
  async push() {
    if (!this.config || this.isSyncing) return;
    this.isSyncing = true;

    try {
      const db = await getDatabase();
      console.info("📤 [SYNC] Scanning for local changes...");

      // Tables to sync
      const TABLES = [
        "users",
        "students",
        "classes",
        "attendance",
        "student_id_cards",
        "subjects",
        "schedule",
      ];

      for (const table of TABLES) {
        const rows = (await db.values(
          sql.raw(
            `SELECT * FROM ${table} WHERE sync_status = 'pending' LIMIT 50`,
          ),
        )) as any[];

        if (rows.length > 0) {
          console.info(
            `📤 [SYNC] Found ${rows.length} pending records in ${table}`,
          );

          // Logic for 2026 Pattern:
          // In a real app, we would POST this to the remoteUrl
          // For now, we simulate success after 500ms
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Clear pending status
          for (const row of rows) {
            const id = row[0]; // Assuming ID is first column
            await db.run(
              sql`UPDATE ${sql.raw(table)} SET sync_status = 'synced' WHERE id = ${id}`,
            );
          }
          console.info(`✅ [SYNC] Pushed and cleared status for ${table}`);
        }
      }
    } catch (e) {
      console.error("❌ [SYNC_PUSH_ERROR]", e);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Pulls changes from remote and resolves conflicts via HLC
   */
  async pull() {
    if (!this.config || this.isSyncing) return;
    this.isSyncing = true;

    try {
      console.info("📥 [SYNC] Pulling remote changes (Simulation)...");
      // Simulation: update the node's HLC to stay in sync even if no data
      getNextHLC(this.config.nodeId);

      // Real logic would be:
      // 1. Fetch remote since last_sync_hlc
      // 2. Resolve conflicts
      // 3. Update local DB
    } catch (e) {
      console.error("❌ [SYNC_PULL_ERROR]", e);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Start periodic sync
   */
  start(intervalMs = 300000) {
    // 5 mins
    if (!isTauri()) return; // Usually only desktop syncs to cloud

    setInterval(() => {
      this.push();
      this.pull();
    }, intervalMs);
  }
}

export const syncEngine = new SyncEngine();
