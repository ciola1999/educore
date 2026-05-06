"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { FinanceRuntimePanel } from "../finance-runtime-panel";
import type { FinanceInvoiceListItemView } from "../types";
import { useFinanceRuntimeData } from "../use-finance-runtime-data";
import { InvoicesClient } from "./invoices-client";

export function InvoicesRuntimeClient({
  initialInvoices,
  autoOpenBatchGeneration = false,
}: {
  initialInvoices: FinanceInvoiceListItemView[];
  autoOpenBatchGeneration?: boolean;
}) {
  const { data, isLoading, error, desktopRuntime } = useFinanceRuntimeData(
    "/api/finance/invoices",
    initialInvoices,
  );

  if (isLoading) {
    return (
      <FinanceRuntimePanel
        desktopRuntime={desktopRuntime}
        className="space-y-8"
      >
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1 rounded-xl bg-white/5" />
          <Skeleton className="h-10 w-32 rounded-xl bg-white/5" />
          <Skeleton className="h-10 w-32 rounded-xl bg-white/5" />
        </div>
        <Skeleton className="h-96 w-full rounded-2xl bg-white/5" />
      </FinanceRuntimePanel>
    );
  }

  return (
    <FinanceRuntimePanel
      desktopRuntime={desktopRuntime}
      error={error}
      className="space-y-8"
    >
      <InvoicesClient
        initialInvoices={data}
        allowBatchGeneration={desktopRuntime || undefined}
        allowStatusActions={desktopRuntime || undefined}
        autoOpenBatchGeneration={autoOpenBatchGeneration}
      />
    </FinanceRuntimePanel>
  );
}
