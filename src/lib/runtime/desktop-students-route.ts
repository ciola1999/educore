import { apiError, type DesktopApiResponse } from "./desktop-route-response";

type DesktopStudentsRouteDeps = {
  handleStudents: (
    url: URL,
    method: string,
    pathSegments: string[],
    body: unknown,
  ) => Promise<DesktopApiResponse>;
};

export async function handleDesktopStudentsRoute(
  url: URL,
  method: string,
  pathSegments: string[],
  body: unknown,
  deps: DesktopStudentsRouteDeps,
): Promise<DesktopApiResponse> {
  if (pathSegments[1] !== "students") {
    return null;
  }

  const response = await deps.handleStudents(url, method, pathSegments, body);
  return (
    response ??
    apiError("Route students desktop tidak ditemukan", 404, "NOT_FOUND")
  );
}
