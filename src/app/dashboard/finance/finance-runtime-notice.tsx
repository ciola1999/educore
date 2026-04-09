import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getFinanceDesktopGuardMessage } from "./runtime-policy";

export function FinanceRuntimeNotice() {
  return (
    <Card className="border-amber-500/20 bg-amber-500/10 p-8 text-amber-50 backdrop-blur-xl">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-amber-500/20 p-3 text-amber-300">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight">
            Finance Belum Tersedia di Runtime Desktop
          </h2>
          <p className="max-w-2xl text-sm text-amber-100/90">
            {getFinanceDesktopGuardMessage()}
          </p>
          <p className="text-xs font-mono uppercase tracking-widest text-amber-200/80">
            Status runtime matrix: needs-audit for desktop dev and desktop
            release.
          </p>
        </div>
      </div>
    </Card>
  );
}
