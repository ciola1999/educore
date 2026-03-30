import { apiError, type DesktopApiResponse } from "./desktop-route-response";

type DesktopAttendanceRouteDeps = {
  handleAttendance: (
    url: URL,
    method: string,
    pathSegments: string[],
    body: unknown,
  ) => Promise<DesktopApiResponse>;
};

export async function handleDesktopAttendanceRoute(
  url: URL,
  method: string,
  pathSegments: string[],
  body: unknown,
  deps: DesktopAttendanceRouteDeps,
): Promise<DesktopApiResponse> {
  if (pathSegments[1] !== "attendance") {
    return null;
  }

  const response = await deps.handleAttendance(url, method, pathSegments, body);
  return (
    response ??
    apiError("Route attendance desktop tidak ditemukan", 404, "NOT_FOUND")
  );
}
