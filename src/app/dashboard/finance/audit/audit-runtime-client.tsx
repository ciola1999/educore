"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { FinanceRuntimePanel } from "../finance-runtime-panel";
import type { FinanceAuditLogView } from "../types";
import { useFinanceRuntimeData } from "../use-finance-runtime-data";
import { AuditClient } from "./audit-client";

export function AuditRuntimeClient({
  initialLogs,
}: {
  initialLogs: FinanceAuditLogView[];
}) {
  const { data, isLoading, error, desktopRuntime } = useFinanceRuntimeData(
    "/api/finance/audit",
    initialLogs,
  );

  if (isLoading) {
    return (
      <FinanceRuntimePanel
        desktopRuntime={desktopRuntime}
        className="space-y-6"
      >
        <Skeleton className="h-12 w-96 rounded-xl bg-white/5" />
        <Skeleton className="h-24 w-full rounded-3xl bg-white/5" />
      </FinanceRuntimePanel>
    );
  }

  return (
    <FinanceRuntimePanel
      desktopRuntime={desktopRuntime}
      error={error}
      className="space-y-6"
    >
      <AuditClient logs={data} />
    </FinanceRuntimePanel>
  );
}
