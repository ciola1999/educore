import { ShieldCheck } from "lucide-react";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { auth } from "@/lib/auth/web/auth";
import { getFinanceLogsAction } from "../queries";
import { isFinanceDesktopRequestRuntime } from "../runtime-policy";
import { AuditRuntimeClient } from "./audit-runtime-client";

export const dynamic = "force-dynamic";

/**
 * 2026 Elite Financial Forensic Audit
 * Institutional-grade traceability for all financial events.
 * Automated logs are pre-fetched on the Server to deliver
 * an immediate "Forensic Snapshot".
 */

export default async function AuditPage() {
  const desktopRuntime = await isFinanceDesktopRequestRuntime();
  const session = desktopRuntime ? null : await auth();
  const hasWebSession = Boolean(session?.user?.id);
  const logs =
    desktopRuntime || !hasWebSession ? [] : await getFinanceLogsAction();

  return (
    <div className="space-y-10">
      <Card className="p-8 bg-zinc-950/80 border border-white/5 backdrop-blur-3xl rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-8 border-l-4 border-l-finance-teal shadow-2xl">
        <div className="flex items-center gap-6">
          <div className="h-16 w-16 rounded-3xl bg-finance-teal/20 flex items-center justify-center text-finance-teal shadow-inner">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-white tracking-tighter">
              Institutional Forensic Ledger
            </h3>
            <p className="text-sm text-zinc-500 font-medium">
              Immutable audit trail of all financial interactions in the current
              fiscal period.
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest font-black mb-1">
            Audit Density
          </p>
          <p className="text-3xl font-black text-white tracking-tighter">
            {logs.length}{" "}
            <span className="text-xs text-zinc-500 font-mono">
              Events Recorded
            </span>
          </p>
        </div>
      </Card>

      <Suspense fallback={<AuditSkeleton />}>
        <AuditRuntimeClient initialLogs={logs} />
      </Suspense>
    </div>
  );
}

function AuditSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-96 rounded-xl bg-white/5" />
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-3xl bg-white/5" />
        <Skeleton className="h-24 w-full rounded-3xl bg-white/5" />
        <Skeleton className="h-24 w-full rounded-3xl bg-white/5" />
      </div>
    </div>
  );
}
