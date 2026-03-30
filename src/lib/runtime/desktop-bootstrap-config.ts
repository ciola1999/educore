import { isTauri } from "@/core/env";
import { STARTUP_HEALTH_ENDPOINT } from "@/lib/runtime/app-bootstrap";

export type DesktopRuntimeBootstrapConfig = {
  strategy: string;
  loopbackHost: string;
  preferredPort: number;
  healthPath: string;
  warmupPath: string;
  expectedRuntime: string;
  releaseReady: boolean;
};

export type DesktopRuntimeBootstrapHealth = {
  ok: boolean;
  statusCode: number | null;
  url: string;
  message: string;
};

export async function getDesktopRuntimeBootstrapConfig(): Promise<DesktopRuntimeBootstrapConfig | null> {
  if (!isTauri()) {
    return null;
  }

  const { invoke } = await import("@tauri-apps/api/core");
  const result = await invoke<{
    strategy: string;
    loopback_host: string;
    preferred_port: number;
    health_path: string;
    warmup_path: string;
    expected_runtime: string;
    release_ready: boolean;
  }>("get_runtime_bootstrap_config");

  return {
    strategy: result.strategy,
    loopbackHost: result.loopback_host,
    preferredPort: result.preferred_port,
    healthPath: result.health_path || STARTUP_HEALTH_ENDPOINT,
    warmupPath: result.warmup_path,
    expectedRuntime: result.expected_runtime,
    releaseReady: result.release_ready,
  };
}

export async function probeDesktopRuntimeBootstrapHealth(): Promise<DesktopRuntimeBootstrapHealth | null> {
  if (!isTauri()) {
    return null;
  }

  const { invoke } = await import("@tauri-apps/api/core");
  const result = await invoke<{
    ok: boolean;
    status_code?: number | null;
    url: string;
    message: string;
  }>("probe_runtime_bootstrap_health");

  return {
    ok: result.ok,
    statusCode: result.status_code ?? null,
    url: result.url,
    message: result.message,
  };
}
