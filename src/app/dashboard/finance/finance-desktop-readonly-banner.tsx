import { MonitorSmartphone } from "lucide-react";
import { Card } from "@/components/ui/card";

export function FinanceDesktopRuntimeBanner() {
  return (
    <Card className="border-sky-500/20 bg-sky-500/10 p-5 text-sky-50 backdrop-blur-xl">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-sky-500/20 p-3 text-sky-300">
          <MonitorSmartphone className="h-5 w-5" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-sm font-bold uppercase tracking-widest text-sky-100">
            Finance Desktop Runtime
          </h2>
          <p className="text-sm text-sky-100/90">
            Runtime desktop sekarang sudah memakai jalur local finance yang aman
            untuk baca data inti dan mutasi finance. Approval, period control,
            dan manual adjustment sudah aktif khusus admin finance/super admin
            dengan audit trail wajib, sementara role lain tetap read-only pada
            area governance sensitif.
          </p>
        </div>
      </div>
    </Card>
  );
}

export const FinanceDesktopReadonlyBanner = FinanceDesktopRuntimeBanner;
