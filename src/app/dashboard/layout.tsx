import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen w-full flex bg-zinc-950 text-white overflow-hidden font-sans">
      {/* Sidebar Tetap (Fixed Width) */}
      <DashboardSidebar />

      {/* Area Konten Utama (Scrollable) */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}