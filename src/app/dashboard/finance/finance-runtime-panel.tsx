import type { ReactNode } from "react";
import { FinanceDesktopRuntimeBanner } from "./finance-desktop-readonly-banner";

export function FinanceRuntimePanel({
  children,
  desktopRuntime,
  error,
  className = "space-y-6",
}: {
  children: ReactNode;
  desktopRuntime: boolean;
  error?: string | null;
  className?: string;
}) {
  return (
    <div className={className}>
      {desktopRuntime ? <FinanceDesktopRuntimeBanner /> : null}
      {error ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
          {error}
        </div>
      ) : null}
      {children}
    </div>
  );
}
