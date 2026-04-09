import { Info } from "lucide-react";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FinanceRuntimeNotice } from "../finance-runtime-notice";
import { getJournalEntriesAction } from "../queries";
import { isFinanceDesktopEmbeddedRuntime } from "../runtime-policy";
import { AccountingClient } from "./accounting-client";

export const dynamic = "force-dynamic";

/**
 * 2026 Elite Financial Ledger
 * Professional-grade double-entry accounting view.
 * All entries are pre-fetched on the Server to ensure total
 * visibility of financial history before client hydration begins.
 */

export default async function AccountingPage() {
  if (isFinanceDesktopEmbeddedRuntime()) {
    return <FinanceRuntimeNotice />;
  }

  const entries = await getJournalEntriesAction();

  return (
    <div className="space-y-10">
      {/* Transactional Summary Information */}
      <Card className="p-8 bg-zinc-900/50 backdrop-blur-3xl rounded-[2.5rem] flex items-start gap-6 border-finance-teal/20 border-l-4 border-t border-r border-b">
        <div className="p-4 rounded-2xl bg-finance-teal/10">
          <Info className="h-6 w-6 text-finance-teal" />
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-bold text-white tracking-tight">
            Ledger Integrity
          </h3>
          <p className="text-sm text-zinc-500 leading-relaxed max-w-2xl">
            This General Ledger contains all manual and automatic double-entry
            postings for the current financial period. All entries are immutable
            and form the authoritative audit trail for the EduCore Finance
            Engine. Values shown are in Indonesian Rupiah (IDR).
          </p>
        </div>
      </Card>

      <Suspense fallback={<LedgerSkeleton />}>
        <AccountingClient entries={entries} />
      </Suspense>
    </div>
  );
}

function LedgerSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-12 w-96 rounded-xl bg-white/5" />
        <Skeleton className="h-12 w-48 rounded-xl bg-white/5" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-[2rem] bg-white/5" />
        <Skeleton className="h-32 w-full rounded-[2rem] bg-white/5" />
        <Skeleton className="h-32 w-full rounded-[2rem] bg-white/5" />
      </div>
    </div>
  );
}
