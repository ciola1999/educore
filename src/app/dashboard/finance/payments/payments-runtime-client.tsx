"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { FinanceRuntimePanel } from "../finance-runtime-panel";
import type { FinancePaymentMethodView } from "../types";
import { useFinanceRuntimeData } from "../use-finance-runtime-data";
import { PaymentsClient } from "./payments-client";

export function PaymentsRuntimeClient({
  initialMethods,
}: {
  initialMethods: FinancePaymentMethodView[];
}) {
  const { data, isLoading, error, desktopRuntime } = useFinanceRuntimeData(
    "/api/finance/payment-methods",
    initialMethods,
  );

  if (isLoading) {
    return (
      <FinanceRuntimePanel
        desktopRuntime={desktopRuntime}
        className="space-y-6"
      >
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <Skeleton className="h-[600px] rounded-3xl bg-white/5" />
          <div className="space-y-8 lg:col-span-2">
            <Skeleton className="h-20 w-full rounded-3xl bg-white/5" />
            <Skeleton className="h-40 w-full rounded-[2rem] bg-white/5" />
          </div>
        </div>
      </FinanceRuntimePanel>
    );
  }

  return (
    <FinanceRuntimePanel
      desktopRuntime={desktopRuntime}
      error={error}
      className="space-y-6"
    >
      <PaymentsClient
        initialMethods={data}
        desktopRuntime={desktopRuntime}
        allowMutation={desktopRuntime || undefined}
      />
    </FinanceRuntimePanel>
  );
}
