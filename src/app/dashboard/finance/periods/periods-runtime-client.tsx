"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { FinanceRuntimePanel } from "../finance-runtime-panel";
import { useFinanceRuntimeData } from "../use-finance-runtime-data";
import { PeriodsClient } from "./periods-client";

interface Period {
  id: string;
  name: string;
  startDate: string | Date;
  endDate: string | Date;
  status: "OPEN" | "SOFT_CLOSED" | "CLOSED";
}

interface ApprovalRequest {
  id: string;
  type: string;
  targetId: string;
  targetType: string;
  status: string;
  requestedBy: {
    fullName: string;
  };
  createdAt: string | Date;
  payload?: string;
}

type PeriodsPayload = {
  periods: Period[];
  approvals: ApprovalRequest[];
};

export function PeriodsRuntimeClient({
  initialPayload,
}: {
  initialPayload: PeriodsPayload;
}) {
  const { data, isLoading, error, desktopRuntime } = useFinanceRuntimeData(
    "/api/finance/periods",
    initialPayload,
  );

  if (isLoading) {
    return (
      <FinanceRuntimePanel
        desktopRuntime={desktopRuntime}
        className="space-y-10"
      >
        <Skeleton className="h-24 w-full rounded-3xl bg-zinc-100" />
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-40 w-full rounded-3xl bg-zinc-100" />
            <Skeleton className="h-40 w-full rounded-3xl bg-zinc-100" />
          </div>
          <div className="space-y-8">
            <Skeleton className="h-80 w-full rounded-[2.5rem] bg-zinc-100" />
          </div>
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
      <PeriodsClient
        initialPeriods={data.periods}
        initialApprovals={data.approvals}
      />
    </FinanceRuntimePanel>
  );
}
