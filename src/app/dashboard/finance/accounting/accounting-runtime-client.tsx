"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { FinanceRuntimePanel } from "../finance-runtime-panel";
import type { FinanceAccountView, FinanceJournalEntryView } from "../types";
import { useFinanceRuntimeData } from "../use-finance-runtime-data";
import { AccountingClient } from "./accounting-client";

type AccountingPayload = {
  entries: FinanceJournalEntryView[];
  accounts: FinanceAccountView[];
};

export function AccountingRuntimeClient({
  initialPayload,
}: {
  initialPayload: AccountingPayload;
}) {
  const { data, isLoading, error, desktopRuntime } = useFinanceRuntimeData(
    "/api/finance/accounting",
    initialPayload,
  );

  if (isLoading) {
    return (
      <FinanceRuntimePanel
        desktopRuntime={desktopRuntime}
        className="space-y-6"
      >
        <div className="flex items-center justify-between">
          <Skeleton className="h-12 w-96 rounded-xl bg-white/5" />
          <Skeleton className="h-12 w-48 rounded-xl bg-white/5" />
        </div>
        <Skeleton className="h-32 w-full rounded-[2rem] bg-white/5" />
      </FinanceRuntimePanel>
    );
  }

  return (
    <FinanceRuntimePanel
      desktopRuntime={desktopRuntime}
      error={error}
      className="space-y-6"
    >
      <AccountingClient
        entries={data.entries}
        accounts={data.accounts}
        desktopRuntime={desktopRuntime}
      />
    </FinanceRuntimePanel>
  );
}
