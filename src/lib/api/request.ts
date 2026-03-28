import { getApiTimeoutMs } from "@/lib/runtime/app-bootstrap";
import { handleDesktopLocalApiRequest } from "@/lib/runtime/desktop-local-api";
import {
  type ApiResponse,
  getApiErrorMessage,
  readApiResponse,
} from "./client";

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  timeoutMs?: number;
};

async function requestJson<T>(
  input: string,
  init?: RequestOptions,
): Promise<T> {
  const controller = new AbortController();
  const method = init?.method?.toUpperCase() ?? "GET";
  const timeoutMs = getApiTimeoutMs(input, init?.timeoutMs, method);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const headers = new Headers(init?.headers);

  let body: BodyInit | undefined;
  if (init?.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.body);
  }

  console.debug(`[API] Fetching ${input}...`);
  try {
    const desktopResponse = await handleDesktopLocalApiRequest(input, {
      method,
      body: init?.body,
    });
    const response =
      desktopResponse ??
      (await fetch(input, {
        ...init,
        headers,
        body,
        signal: controller.signal,
        credentials: init?.credentials ?? "include",
      }));

    clearTimeout(timeoutId);
    console.debug(
      `[API] Response from ${input}: ${response.status} ${response.statusText}`,
    );

    let payload: ApiResponse<T>;
    try {
      payload = (await readApiResponse<T>(response)) as ApiResponse<T>;
    } catch (error) {
      console.error(`[API] Failed to parse response from ${input}`, error);
      throw new Error(`Gagal membaca feedback server (${response.status})`);
    }

    if (!response.ok || !payload.success) {
      const errorMsg = getApiErrorMessage(
        response,
        "Request failed",
        payload.success ? undefined : payload,
      );
      console.warn(`[API] Request to ${input} failed: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    return payload.data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      console.error(`[API] Request to ${input} timed out after ${timeoutMs}ms`);
      throw new Error(
        "Koneksi ke server timeout. Silakan cek koneksi atau coba lagi.",
      );
    }
    throw error;
  }
}

export function apiGet<T>(input: string, init?: Omit<RequestOptions, "body">) {
  return requestJson<T>(input, { ...init, method: "GET" });
}

export function apiPost<T>(
  input: string,
  body?: unknown,
  init?: RequestOptions,
) {
  return requestJson<T>(input, { ...init, method: "POST", body });
}

export function apiPatch<T>(
  input: string,
  body?: unknown,
  init?: RequestOptions,
) {
  return requestJson<T>(input, { ...init, method: "PATCH", body });
}

export function apiPut<T>(
  input: string,
  body?: unknown,
  init?: RequestOptions,
) {
  return requestJson<T>(input, { ...init, method: "PUT", body });
}

export function apiDelete<T>(
  input: string,
  init?: Omit<RequestOptions, "body">,
) {
  return requestJson<T>(input, { ...init, method: "DELETE" });
}
