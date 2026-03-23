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
  return (await response.json()) as ApiResponse<T>;
}

export function getApiErrorMessage(
  response: Response,
  fallback: string,
  payload?: ApiFailure,
) {
  const rawMessage = payload?.error?.trim();
  const normalizedMessage = rawMessage?.toLowerCase();

  if (
    response.status === 401 ||
    normalizedMessage === "unauthorized" ||
    normalizedMessage === "unauthenticated"
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
