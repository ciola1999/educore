import { cn } from "@/lib/utils";
import {
  historyCardShellClass,
  historyPanelCompactClass,
  historySoftPanelClass,
} from "./history-ui";

type HistoryLoadingSkeletonProps = {
  density: "comfortable" | "compact";
  grouped?: boolean;
};

function SkeletonCard({ density }: { density: "comfortable" | "compact" }) {
  const compact = density === "compact";

  return (
    <div
      aria-hidden="true"
      className={cn(
        historyCardShellClass,
        compact ? "rounded-2xl p-3" : "rounded-3xl p-4",
      )}
    >
      <div className="animate-pulse space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="h-4 w-36 rounded-full bg-zinc-800/90" />
            <div className="h-3 w-52 rounded-full bg-zinc-900" />
          </div>
          <div className="space-y-2 sm:text-right">
            <div className="ml-auto h-4 w-20 rounded-full bg-zinc-800/90" />
            <div className="ml-auto h-3 w-28 rounded-full bg-zinc-900" />
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="h-3 rounded-full bg-zinc-900" />
          <div className="h-3 rounded-full bg-zinc-900" />
          <div className="h-3 rounded-full bg-zinc-900" />
        </div>
      </div>
    </div>
  );
}

function SkeletonGroup({ density }: { density: "comfortable" | "compact" }) {
  return (
    <div className={historyPanelCompactClass}>
      <div
        className={cn(
          historySoftPanelClass,
          "mb-3 flex items-center justify-between px-3 py-2",
        )}
      >
        <div className="h-4 w-28 animate-pulse rounded-full bg-zinc-800/90" />
        <div className="h-3 w-16 animate-pulse rounded-full bg-zinc-900" />
      </div>
      <div className="space-y-3">
        <SkeletonCard density={density} />
        <SkeletonCard density={density} />
      </div>
    </div>
  );
}

export function HistoryLoadingSkeleton({
  density,
  grouped = false,
}: HistoryLoadingSkeletonProps) {
  if (grouped) {
    return (
      <div className="space-y-4">
        <span className="sr-only">Memuat riwayat attendance terkelompok.</span>
        <SkeletonGroup density={density} />
        <SkeletonGroup density={density} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <span className="sr-only">Memuat riwayat attendance.</span>
      <SkeletonCard density={density} />
      <SkeletonCard density={density} />
      <SkeletonCard density={density} />
      <SkeletonCard density={density} />
    </div>
  );
}
