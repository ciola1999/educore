import { Suspense } from "react";
import { DashboardAccessGate } from "@/components/dashboard/dashboard-access-gate";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-zinc-950 font-sans text-white">
      <Suspense
        fallback={
          <aside className="hidden w-64 border-r border-zinc-800 bg-zinc-900 md:flex" />
        }
      >
        <DashboardSidebar />
      </Suspense>

      <main className="relative flex-1 overflow-y-auto">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.08),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.08),transparent_26%)]" />
        <DashboardAccessGate>
          <div className="relative mx-auto max-w-[90rem] px-4 pb-10 pt-20 sm:px-5 md:px-8 md:pb-12">
            {children}
          </div>
        </DashboardAccessGate>
      </main>
    </div>
  );
}
