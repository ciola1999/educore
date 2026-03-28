export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiFailure = {
  success: false;
  error: string;
  code?: string;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export async function readApiResponse<T>(
  response: Response,
): Promise<ApiResponse<T>> {
  const raw = await response.text();
  const trimmed = raw.trim();

  if (!trimmed) {
    return {
      success: false,
      error: "Server mengembalikan respons kosong.",
      code: "EMPTY_RESPONSE",
    };
  }

  try {
    return JSON.parse(trimmed) as ApiResponse<T>;
  } catch {
    return {
      success: false,
      error: "Server mengembalikan respons yang tidak valid.",
      code: "INVALID_RESPONSE_FORMAT",
    };
  }
}

export function getApiErrorMessage(
  response: Response,
  fallback: string,
  payload?: ApiFailure,
) {
  const rawMessage = payload?.error?.trim();
  const normalizedMessage = rawMessage?.toLowerCase();
  const code = payload?.code?.trim().toUpperCase();
  const isGenericUnauthorizedMessage =
    normalizedMessage === "unauthorized" ||
    normalizedMessage === "unauthenticated";

  if (response.status === 401 && code === "INVALID_CREDENTIALS") {
    return rawMessage || "Email atau password salah";
  }

  if (
    response.status === 401 &&
    rawMessage &&
    !isGenericUnauthorizedMessage &&
    code !== "UNAUTHORIZED"
  ) {
    return rawMessage;
  }

  if (
    response.status === 401 ||
    isGenericUnauthorizedMessage ||
    code === "UNAUTHORIZED"
  ) {
    return "Sesi login berakhir. Silakan login kembali.";
  }

  if (response.status === 403 || normalizedMessage === "forbidden") {
    return "Kamu tidak punya izin untuk melakukan aksi ini.";
  }

  if (rawMessage) {
    return rawMessage;
  }

  if (response.status >= 500) {
    return "Terjadi kesalahan sistem. Coba lagi beberapa saat.";
  }

  return fallback;
}
