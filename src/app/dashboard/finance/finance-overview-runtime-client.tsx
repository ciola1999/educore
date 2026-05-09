"use client";

import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { runFullSync } from "@/lib/sync/actions";
import { FinanceOverviewClient } from "./finance-overview-client";
import { FinanceRuntimePanel } from "./finance-runtime-panel";
import type { FinanceSummaryView } from "./types";
import { useFinanceRuntimeData } from "./use-finance-runtime-data";

export function FinanceOverviewRuntimeClient({
  initialSummary,
}: {
  initialSummary: FinanceSummaryView;
}) {
  const { data, isLoading, error, desktopRuntime, refresh } =
    useFinanceRuntimeData("/api/finance", initialSummary);
  const attemptedHydrationRef = useRef(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  useEffect(() => {
    if (
      !desktopRuntime ||
      attemptedHydrationRef.current ||
      !data.canManageSync ||
      data.dataState !== "seeded"
    ) {
      return;
    }

    attemptedHydrationRef.current = true;
    let cancelled = false;

    void (async () => {
      setSyncNotice("Sinkronisasi Finance sedang berjalan.");

      try {
        const result = await runFullSync();
        if (cancelled) {
          return;
        }

        if (result.status === "success") {
          const refreshedSummary = await refresh();
          setSyncNotice(
            refreshedSummary?.dataState === "seeded"
              ? "Sinkronisasi selesai, tetapi belum ada transaksi Finance yang tersedia untuk perangkat ini."
              : "Sinkronisasi selesai. Ringkasan Finance sudah diperbarui.",
          );
          return;
        }

        setSyncNotice(
          result.message ||
            "Sinkronisasi belum berhasil. Finance tetap menampilkan data yang tersedia di perangkat ini.",
        );
      } catch (syncError) {
        if (!cancelled) {
          setSyncNotice(
            syncError instanceof Error
              ? syncError.message
              : "Sinkronisasi Finance belum berhasil diproses.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [data.canManageSync, data.dataState, desktopRuntime, refresh]);

  if (isLoading) {
    return (
      <FinanceRuntimePanel
        desktopRuntime={desktopRuntime}
        className="space-y-10"
      >
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl bg-white/5" />
          ))}
        </div>
      </FinanceRuntimePanel>
    );
  }

  return (
    <FinanceRuntimePanel
      desktopRuntime={desktopRuntime}
      error={error}
      className="space-y-10"
    >
      <FinanceOverviewClient summary={data} syncNotice={syncNotice} />
    </FinanceRuntimePanel>
  );
}
