import { Suspense } from "react";
import { DashboardAccessGate } from "@/components/dashboard/dashboard-access-gate";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen w-full flex bg-zinc-950 text-white overflow-hidden font-sans">
      <Suspense
        fallback={
          <aside className="hidden w-64 border-r border-zinc-800 bg-zinc-900 md:flex" />
        }
      >
        <DashboardSidebar />
      </Suspense>

      <main className="flex-1 overflow-y-auto">
        <DashboardAccessGate>
          <div className="mx-auto max-w-7xl p-4 pt-20 md:p-8">{children}</div>
        </DashboardAccessGate>
      </main>
    </div>
  );
}
