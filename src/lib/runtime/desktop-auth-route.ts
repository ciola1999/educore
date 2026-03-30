import {
  apiError,
  apiOk,
  type DesktopApiResponse,
} from "./desktop-route-response";

type DesktopAuthRouteDeps = {
  logout: () => void;
  handleLogin: (body: unknown) => Promise<Response>;
  handleChangePassword: (body: unknown) => Promise<Response>;
};

export async function handleDesktopAuthRoute(
  pathname: string,
  method: string,
  body: unknown,
  deps: DesktopAuthRouteDeps,
): Promise<DesktopApiResponse> {
  if (pathname === "/api/auth/logout") {
    if (method !== "POST") {
      return apiError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
    }

    deps.logout();
    return apiOk({ message: "Logout berhasil" });
  }

  if (pathname === "/api/auth/login") {
    if (method !== "POST") {
      return apiError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
    }

    return deps.handleLogin(body);
  }

  if (pathname === "/api/auth/change-password") {
    if (method !== "POST") {
      return apiError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
    }

    return deps.handleChangePassword(body);
  }

  return null;
}
