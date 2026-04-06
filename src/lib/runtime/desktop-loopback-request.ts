export const DESKTOP_LOOPBACK_SESSION_COOKIE = "educore.desktop.loopback";
export const DESKTOP_LOOPBACK_RUNTIME_COOKIE = "educore.desktop.runtime";
export const DESKTOP_LOOPBACK_QUERY_TOKEN = "educore_desktop_token";
export const DESKTOP_LOOPBACK_ENV_TOKEN = "EDUCORE_DESKTOP_LOOPBACK_TOKEN";

type DesktopLoopbackRequestMeta = {
  hostHeader?: string | null;
  userAgent?: string | null;
};

function normalizeHostHeader(hostHeader?: string | null) {
  return hostHeader?.trim().toLowerCase() ?? "";
}

export function isLoopbackHostname(hostHeader?: string | null) {
  const normalizedHost = normalizeHostHeader(hostHeader);
  if (!normalizedHost) {
    return false;
  }

  const hostname = normalizedHost.split(":")[0];
  return hostname === "127.0.0.1" || hostname === "localhost";
}

export function isDesktopLoopbackRequest(meta: DesktopLoopbackRequestMeta) {
  if (!isLoopbackHostname(meta.hostHeader)) {
    return false;
  }

  const userAgent = meta.userAgent?.trim() ?? "";
  if (!userAgent) {
    return false;
  }

  return userAgent.includes("Tauri");
}

export function hasDesktopLoopbackSessionToken(params: {
  cookieValue?: string | null;
  queryValue?: string | null;
  expectedToken?: string | null;
}) {
  const expectedToken = params.expectedToken?.trim() ?? "";
  if (!expectedToken) {
    return false;
  }

  return (
    params.cookieValue?.trim() === expectedToken ||
    params.queryValue?.trim() === expectedToken
  );
}
