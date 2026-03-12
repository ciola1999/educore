/**
 * Hybrid Logical Clock (HLC) Implementation for EduCore Sync Engine
 * Based on 2026 Elite Sync Pattern
 */

export interface HLC {
  ts: number; // physical time (ms)
  count: number; // logical counter
  nodeId: string; // unique node identifier
}

/**
 * Packs HLC into a sortable string: <ts-hex>:<count-hex>:<nodeId>
 */
export const packHLC = (hlc: HLC): string => {
  return `${hlc.ts.toString(16).padStart(12, "0")}:${hlc.count.toString(16).padStart(4, "0")}:${hlc.nodeId}`;
};

/**
 * Unpacks HLC string
 */
export const unpackHLC = (s: string): HLC => {
  const parts = s.split(":");
  return {
    ts: parseInt(parts[0], 16),
    count: parseInt(parts[1], 16),
    nodeId: parts[2],
  };
};

let lastHLC: HLC = {
  ts: 0,
  count: 0,
  nodeId: "unknown",
};

/**
 * Generates a new HLC timestamp
 */
export const getNextHLC = (nodeId: string): string => {
  const now = Date.now();

  if (now > lastHLC.ts) {
    lastHLC = { ts: now, count: 0, nodeId };
  } else {
    lastHLC = { ts: lastHLC.ts, count: lastHLC.count + 1, nodeId };
  }

  return packHLC(lastHLC);
};

/**
 * Receives an HLC from another node and updates local state
 */
export const recvHLC = (remoteHLCStr: string, localNodeId: string): string => {
  const remote = unpackHLC(remoteHLCStr);
  const now = Date.now();

  const nextTs = Math.max(now, Math.max(lastHLC.ts, remote.ts));

  let nextCount: number;
  if (nextTs === lastHLC.ts && nextTs === remote.ts) {
    nextCount = Math.max(lastHLC.count, remote.count) + 1;
  } else if (nextTs === lastHLC.ts) {
    nextCount = lastHLC.count + 1;
  } else if (nextTs === remote.ts) {
    nextCount = remote.count + 1;
  } else {
    nextCount = 0;
  }

  lastHLC = { ts: nextTs, count: nextCount, nodeId: localNodeId };
  return packHLC(lastHLC);
};

/**
 * Compares two HLC strings (sortable)
 */
export const compareHLC = (a: string, b: string): number => {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
};
