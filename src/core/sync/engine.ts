import { pullFromCloud, pushToCloud } from "@/lib/sync/turso-sync";
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
  private intervalId: ReturnType<typeof setInterval> | null = null;

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
      console.info("📤 [SYNC] Pushing pending changes to cloud...");
      await pushToCloud();
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
      console.info("📥 [SYNC] Pulling remote changes...");
      await pullFromCloud();
      getNextHLC(this.config.nodeId);
    } catch (e) {
      console.error("❌ [SYNC_PULL_ERROR]", e);
    } finally {
      this.isSyncing = false;
    }
  }

  private async runCycle() {
    if (!this.config || this.isSyncing) return;

    await this.push();
    await this.pull();
  }

  /**
   * Start periodic sync
   */
  start(intervalMs = 300000) {
    // 5 mins
    if (!isTauri()) return; // Usually only desktop syncs to cloud

    this.stop();
    this.intervalId = setInterval(() => {
      void this.runCycle();
    }, intervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export const syncEngine = new SyncEngine();
