"use client";

import { useEffect, useState } from "react";
import { isTauri } from "@/core/env";
import { apiGet } from "@/lib/api/request";

type RuntimeDataState<T> = {
  data: T;
  isLoading: boolean;
  error: string | null;
  desktopRuntime: boolean;
  refresh: () => Promise<T | null>;
};

export function useFinanceRuntimeData<T>(
  endpoint: string,
  initialData: T,
): RuntimeDataState<T> {
  const [data, setData] = useState(initialData);
  const [isLoading, setIsLoading] = useState(isTauri());
  const [error, setError] = useState<string | null>(null);
  const desktopRuntime = isTauri();

  async function refresh() {
    if (!desktopRuntime) {
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await apiGet<T>(endpoint);
      setData(result);
      return result;
    } catch (runtimeError) {
      setError(
        runtimeError instanceof Error
          ? runtimeError.message
          : "Gagal memuat data Finance desktop.",
      );
      return null;
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!desktopRuntime) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await apiGet<T>(endpoint);
        if (!cancelled) {
          setData(result);
        }
      } catch (runtimeError) {
        if (!cancelled) {
          setError(
            runtimeError instanceof Error
              ? runtimeError.message
              : "Gagal memuat data Finance desktop.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [desktopRuntime, endpoint]);

  return {
    data,
    isLoading,
    error,
    desktopRuntime,
    refresh,
  };
}
