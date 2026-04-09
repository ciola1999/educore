import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { FinanceRuntimeNotice } from "../finance-runtime-notice";
import { getPaymentMethodsAction } from "../queries";
import { isFinanceDesktopEmbeddedRuntime } from "../runtime-policy";
import { PaymentsClient } from "./payments-client";

export const dynamic = "force-dynamic";

/**
 * 2026 Elite Payments Processor
 * Hybrid Server-First Strategy:
 * - Payment methods and available gateways are fetched on the Server.
 * - Intelligent FIFO Waterfall Allocation and Student Registry lookup happen on the Client.
 */

export default async function PaymentsPage() {
  if (isFinanceDesktopEmbeddedRuntime()) {
    return <FinanceRuntimeNotice />;
  }

  // Pre-fetch supported methods on the server
  const methods = await getPaymentMethodsAction();

  return (
    <div className="space-y-6">
      <Suspense fallback={<PaymentsSkeleton />}>
        <PaymentsClient initialMethods={methods} />
      </Suspense>
    </div>
  );
}

function PaymentsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <Skeleton className="h-[600px] rounded-3xl bg-white/5" />
      <div className="lg:col-span-2 space-y-8">
        <Skeleton className="h-20 w-full rounded-3xl bg-white/5" />
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-[2rem] bg-white/5" />
          <Skeleton className="h-40 w-full rounded-[2rem] bg-white/5" />
          <Skeleton className="h-40 w-full rounded-[2rem] bg-white/5" />
        </div>
      </div>
    </div>
  );
}
