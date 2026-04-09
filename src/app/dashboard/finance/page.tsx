import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { FinanceOverviewClient } from "./finance-overview-client";
import { FinanceRuntimeNotice } from "./finance-runtime-notice";
import { getFinanceDashboardSummary } from "./queries";
import { isFinanceDesktopEmbeddedRuntime } from "./runtime-policy";

export const dynamic = "force-dynamic";

/**
 * 2026 Elite Finance Overview Page
 * Hybrid Server-First Strategy:
 * - Data fetching happens on the Server (RSC) for security and speed.
 * - Interactive Bento UI happens on the Client (ROC) for animations.
 */

export default async function FinanceOverviewPage() {
  if (isFinanceDesktopEmbeddedRuntime()) {
    return <FinanceRuntimeNotice />;
  }

  // Fetch dynamic summary from the Unified Finance Engine
  const summary = await getFinanceDashboardSummary();

  return (
    <Suspense fallback={<FinanceOverviewSkeleton />}>
      <FinanceOverviewClient summary={summary} />
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
