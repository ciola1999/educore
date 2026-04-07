"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api/request";
import { dedupeCanonicalClassOptions } from "@/lib/utils/class-name";

type MasterClassRow = {
  id: string;
  name: string;
};

export type StudentClassOption = {
  id: string;
  name: string;
};

export function useStudentClassOptions() {
  const [options, setOptions] = useState<StudentClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await apiGet<MasterClassRow[]>("/api/classes");
        if (cancelled) {
          return;
        }
        setOptions(dedupeCanonicalClassOptions(data));
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Gagal memuat master kelas",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(
    () => ({
      options,
      loading,
      error,
    }),
    [error, loading, options],
  );
}
