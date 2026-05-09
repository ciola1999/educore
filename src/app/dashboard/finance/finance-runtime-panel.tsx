import type { ReactNode } from "react";

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
      {desktopRuntime ? (
        <div className="flex justify-end">
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200">
            Desktop Local
          </span>
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
          {error}
        </div>
      ) : null}
      {children}
    </div>
  );
}
