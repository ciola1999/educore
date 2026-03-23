import { describe, expect, it } from "vitest";
import { getApiErrorMessage } from "./client";

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

  it("keeps specific backend message when it is not generic auth error", () => {
    const response = new Response(null, { status: 400 });
    const message = getApiErrorMessage(response, "fallback", {
      success: false,
      error: "classId dan date wajib diisi",
    });

    expect(message).toBe("classId dan date wajib diisi");
  });
});
