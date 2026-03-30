import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleDesktopAuthRoute } from "./desktop-auth-route";

describe("desktop auth route", () => {
  const logoutMock = vi.fn();
  const loginMock = vi.fn();
  const changePasswordMock = vi.fn();

  beforeEach(() => {
    logoutMock.mockReset();
    loginMock.mockReset();
    changePasswordMock.mockReset();
  });

  it("delegates desktop login to the provided handler", async () => {
    loginMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );

    const response = await handleDesktopAuthRoute(
      "/api/auth/login",
      "POST",
      { email: "admin@educore.school", password: "secret123" },
      {
        logout: logoutMock,
        handleLogin: loginMock,
        handleChangePassword: changePasswordMock,
      },
    );

    expect(loginMock).toHaveBeenCalledWith({
      email: "admin@educore.school",
      password: "secret123",
    });
    expect(response?.status).toBe(200);
  });

  it("delegates change password to the provided handler", async () => {
    changePasswordMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );

    const payload = {
      currentPassword: "oldpass123",
      newPassword: "newpass123",
      confirmPassword: "newpass123",
    };
    const response = await handleDesktopAuthRoute(
      "/api/auth/change-password",
      "POST",
      payload,
      {
        logout: logoutMock,
        handleLogin: loginMock,
        handleChangePassword: changePasswordMock,
      },
    );

    expect(changePasswordMock).toHaveBeenCalledWith(payload);
    expect(response?.status).toBe(200);
  });

  it("handles desktop logout locally", async () => {
    const response = await handleDesktopAuthRoute(
      "/api/auth/logout",
      "POST",
      undefined,
      {
        logout: logoutMock,
        handleLogin: loginMock,
        handleChangePassword: changePasswordMock,
      },
    );

    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(await response?.json()).toMatchObject({
      success: true,
      data: { message: "Logout berhasil" },
    });
  });

  it("rejects non-post auth methods", async () => {
    const response = await handleDesktopAuthRoute(
      "/api/auth/login",
      "GET",
      undefined,
      {
        logout: logoutMock,
        handleLogin: loginMock,
        handleChangePassword: changePasswordMock,
      },
    );

    expect(loginMock).not.toHaveBeenCalled();
    expect(response?.status).toBe(405);
    expect(await response?.json()).toMatchObject({
      success: false,
      code: "METHOD_NOT_ALLOWED",
    });
  });
});
