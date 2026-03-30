import { checkPermission } from "@/lib/auth/rbac";
import { useStore } from "@/lib/store/use-store";
import { fullSync, pullFromCloud, pushToCloud } from "@/lib/sync/turso-sync";
import {
  apiError,
  apiOk,
  type DesktopApiResponse,
} from "./desktop-route-response";

function ensureDesktopSyncPermission() {
  const user = useStore.getState().user;
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  if (!checkPermission(user, "settings:manage")) {
    return apiError("Forbidden", 403);
  }

  return null;
}

export async function handleDesktopSyncRoute(
  pathname: string,
  method: string,
): Promise<DesktopApiResponse> {
  const guard = ensureDesktopSyncPermission();
  if (guard) {
    return guard;
  }

  if (method !== "POST") {
    return apiError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  if (pathname === "/api/sync/push") {
    return apiOk(await pushToCloud());
  }

  if (pathname === "/api/sync/pull") {
    return apiOk(await pullFromCloud());
  }

  if (pathname === "/api/sync/full") {
    return apiOk(await fullSync());
  }

  return null;
}
