import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { auth } from "@/lib/auth/web/auth";
import { FinanceOverviewRuntimeClient } from "./finance-overview-runtime-client";
import { getFinanceDashboardSummary } from "./queries";
import { isFinanceDesktopRequestRuntime } from "./runtime-policy";
import type { FinanceSummaryView } from "./types";

export const dynamic = "force-dynamic";

/**
 * 2026 Elite Finance Overview Page
 * Hybrid Server-First Strategy:
 * - Data fetching happens on the Server (RSC) for security and speed.
 * - Interactive Bento UI happens on the Client (ROC) for animations.
 */

export default async function FinanceOverviewPage() {
  const desktopRuntime = await isFinanceDesktopRequestRuntime();
  const session = desktopRuntime ? null : await auth();
  const hasWebSession = Boolean(session?.user?.id);
  const emptySummary: FinanceSummaryView = {
    revenue: 0,
    receivables: 0,
    collectionRate: 0,
    invoiceCount: 0,
    paymentCount: 0,
    activePeriodLabel: null,
    activePeriodStatus: null,
    revenueTrend: [],
    dataState: "seeded",
    pendingSync: false,
  };
  const summary = desktopRuntime
    ? emptySummary
    : !hasWebSession
      ? emptySummary
      : await getFinanceDashboardSummary();

  return (
    <Suspense fallback={<FinanceOverviewSkeleton />}>
      <FinanceOverviewRuntimeClient initialSummary={summary} />
    </Suspense>
  );
}

function FinanceOverviewSkeleton() {
  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 rounded-2xl bg-white/5" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <Skeleton className="col-span-1 h-80 rounded-2xl bg-white/5 lg:col-span-2" />
        <div className="space-y-6">
          <Skeleton className="h-40 rounded-2xl bg-white/5" />
          <Skeleton className="h-32 rounded-2xl bg-white/5" />
        </div>
      </div>
    </div>
  );
}
