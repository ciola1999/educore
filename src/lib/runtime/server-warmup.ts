import { getDatabase } from "@/core/db/connection";

let serverWarmupPromise: Promise<void> | null = null;

export function primeServerRuntimeWarmup() {
  if (typeof window !== "undefined") {
    return;
  }

  if (serverWarmupPromise) {
    return;
  }

  serverWarmupPromise = getDatabase()
    .then(() => undefined)
    .catch((error) => {
      console.warn("[SERVER_WARMUP] Runtime warmup failed", error);
      serverWarmupPromise = null;
    });
}
