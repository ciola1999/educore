import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { FinanceRuntimeNotice } from "../finance-runtime-notice";
import { getApprovalRequestsAction, getFinancePeriodsAction } from "../queries";
import { isFinanceDesktopEmbeddedRuntime } from "../runtime-policy";
import { PeriodsClient } from "./periods-client";

export const dynamic = "force-dynamic";

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

/**
 * 2026 Elite Financial Control Center
 * Centralized governance for fiscal periods and transaction approvals.
 */

export default async function PeriodsPage() {
  if (isFinanceDesktopEmbeddedRuntime()) {
    return <FinanceRuntimeNotice />;
  }

  const [periods, approvals] = await Promise.all([
    getFinancePeriodsAction(),
    getApprovalRequestsAction(),
  ]);

  return (
    <div className="space-y-10">
      <Suspense fallback={<ControlCenterSkeleton />}>
        <PeriodsClient
          initialPeriods={periods as unknown as Period[]}
          initialApprovals={approvals as unknown as ApprovalRequest[]}
        />
      </Suspense>
    </div>
  );
}

function ControlCenterSkeleton() {
  return (
    <div className="space-y-10">
      <Skeleton className="h-24 w-full rounded-3xl bg-zinc-100" />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-40 w-full rounded-3xl bg-zinc-100" />
          <Skeleton className="h-40 w-full rounded-3xl bg-zinc-100" />
          <Skeleton className="h-40 w-full rounded-3xl bg-zinc-100" />
        </div>
        <div className="space-y-8">
          <Skeleton className="h-80 w-full rounded-[2.5rem] bg-zinc-100" />
          <Skeleton className="h-64 w-full rounded-[2.5rem] bg-zinc-100" />
        </div>
      </div>
    </div>
  );
}
