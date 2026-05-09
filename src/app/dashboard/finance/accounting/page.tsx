import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { auth } from "@/lib/auth/web/auth";
import { getFinanceAccountsAction, getJournalEntriesAction } from "../queries";
import { isFinanceDesktopRequestRuntime } from "../runtime-policy";
import { AccountingRuntimeClient } from "./accounting-runtime-client";

export const dynamic = "force-dynamic";

/**
 * 2026 Elite Financial Ledger
 * Professional-grade double-entry accounting view.
 * All entries are pre-fetched on the Server to ensure total
 * visibility of financial history before client hydration begins.
 */

export default async function AccountingPage() {
  const desktopRuntime = await isFinanceDesktopRequestRuntime();
  const session = desktopRuntime ? null : await auth();
  const hasWebSession = Boolean(session?.user?.id);
  const [entries, accounts] =
    desktopRuntime || !hasWebSession
      ? [[], []]
      : await Promise.all([
          getJournalEntriesAction(),
          getFinanceAccountsAction(),
        ]);

  return (
    <div className="space-y-10">
      <Suspense fallback={<LedgerSkeleton />}>
        <AccountingRuntimeClient initialPayload={{ entries, accounts }} />
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
