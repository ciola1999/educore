import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { auth } from "@/lib/auth/web/auth";
import { getInvoices } from "../queries";
import { isFinanceDesktopRequestRuntime } from "../runtime-policy";
import { InvoicesRuntimeClient } from "./invoices-runtime-client";

export const dynamic = "force-dynamic";

/**
 * 2026 Elite Invoices Ledger
 * Hybrid Server-First Strategy:
 * - Complex SQL querying and role-based data isolation happens on the Server.
 * - Interactive filtering, search, and transactional actions happen on the Client.
 */

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : undefined;
  const search = typeof params.search === "string" ? params.search : undefined;
  const autoOpenBatchGeneration = params.action === "generate-batch";
  const desktopRuntime = await isFinanceDesktopRequestRuntime();
  const session = desktopRuntime ? null : await auth();
  const hasWebSession = Boolean(session?.user?.id);

  const invoices =
    desktopRuntime || !hasWebSession
      ? []
      : await getInvoices({ status, search });

  return (
    <div className="space-y-6">
      <Suspense fallback={<InvoicesSkeleton />}>
        <InvoicesRuntimeClient
          initialInvoices={invoices}
          autoOpenBatchGeneration={autoOpenBatchGeneration}
        />
      </Suspense>
    </div>
  );
}

function InvoicesSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex gap-4">
        <Skeleton className="h-10 flex-1 rounded-xl bg-white/5" />
        <Skeleton className="h-10 w-32 rounded-xl bg-white/5" />
        <Skeleton className="h-10 w-32 rounded-xl bg-white/5" />
      </div>
      <Skeleton className="h-96 w-full rounded-2xl bg-white/5" />
    </div>
  );
}
