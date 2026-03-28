import { describe, expect, it } from "vitest";
import { getApiErrorMessage, readApiResponse } from "./client";

describe("getApiErrorMessage", () => {
  it("maps generic forbidden payload to user-friendly message", () => {
    const response = new Response(null, { status: 403 });
    const message = getApiErrorMessage(response, "fallback", {
      success: false,
      error: "Forbidden",
    });

    expect(message).toBe("Kamu tidak punya izin untuk melakukan aksi ini.");
  });

  it("maps generic unauthorized payload to user-friendly message", () => {
    const response = new Response(null, { status: 401 });
    const message = getApiErrorMessage(response, "fallback", {
      success: false,
      error: "Unauthorized",
    });

    expect(message).toBe("Sesi login berakhir. Silakan login kembali.");
  });

  it("keeps invalid credential message for login failures", () => {
    const response = new Response(null, { status: 401 });
    const message = getApiErrorMessage(response, "fallback", {
      success: false,
      error: "Email atau password salah",
      code: "INVALID_CREDENTIALS",
    });

    expect(message).toBe("Email atau password salah");
  });

  it("keeps specific backend message when it is not generic auth error", () => {
    const response = new Response(null, { status: 400 });
    const message = getApiErrorMessage(response, "fallback", {
      success: false,
      error: "classId dan date wajib diisi",
    });

    expect(message).toBe("classId dan date wajib diisi");
  });

  it("returns a friendly failure payload for empty responses", async () => {
    const response = new Response("", { status: 500 });
    const payload = await readApiResponse(response);

    expect(payload).toEqual({
      success: false,
      error: "Server mengembalikan respons kosong.",
      code: "EMPTY_RESPONSE",
    });
  });

  it("returns a friendly failure payload for invalid json responses", async () => {
    const response = new Response("<html>oops</html>", { status: 500 });
    const payload = await readApiResponse(response);

    expect(payload).toEqual({
      success: false,
      error: "Server mengembalikan respons yang tidak valid.",
      code: "INVALID_RESPONSE_FORMAT",
    });
  });
});
