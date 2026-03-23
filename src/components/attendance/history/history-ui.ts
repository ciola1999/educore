const panelBase =
  "relative overflow-hidden rounded-3xl border border-zinc-800/90 bg-linear-to-br from-zinc-950/80 via-zinc-950/68 to-zinc-900/48 shadow-sm shadow-black/15 backdrop-blur-sm before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-linear-to-r before:from-transparent before:via-white/12 before:to-transparent";

const softPanelBase =
  "relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-linear-to-br from-zinc-950/72 to-zinc-900/36 shadow-sm shadow-black/10 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-linear-to-r before:from-transparent before:via-white/10 before:to-transparent";

const insetPanelBase =
  "rounded-2xl border border-zinc-800 bg-zinc-950/70 shadow-sm shadow-black/10";

const neutralButtonBase =
  "rounded-xl border border-zinc-700 !bg-zinc-900/90 !text-zinc-100 shadow-sm shadow-black/10 transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-500 hover:!bg-zinc-800 hover:!text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/35 focus-visible:ring-offset-0";

const ghostToggleBase =
  "rounded-lg border border-transparent !bg-transparent !text-zinc-300 shadow-none transition-colors hover:!bg-zinc-900/80 hover:!text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/35 focus-visible:ring-offset-0";

export const historyFocusRingClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/35 focus-visible:ring-offset-0";
export const historyCardShellClass =
  "relative overflow-hidden border border-zinc-800 bg-linear-to-br from-zinc-900/55 to-zinc-950/75 shadow-sm shadow-black/10 transition-all duration-200 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-linear-to-r before:from-transparent before:via-white/10 before:to-transparent hover:-translate-y-0.5 hover:border-zinc-700 hover:shadow-md hover:shadow-black/20";
export const historyCardMetaLabelClass =
  "text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500";
export const historyCardMutedCopyClass = "text-zinc-500";

function gradientButtonByTone(
  tone: "sky" | "emerald" | "amber" | "red" | "violet" | "zinc",
) {
  switch (tone) {
    case "sky":
      return "border-sky-400/45 !bg-linear-to-br !from-sky-500 !to-cyan-500 shadow-sm shadow-sky-950/25 hover:border-sky-300/70 hover:!from-sky-400 hover:!to-cyan-400";
    case "emerald":
      return "border-emerald-400/45 !bg-linear-to-br !from-emerald-500 !to-emerald-600 shadow-sm shadow-emerald-950/25 hover:border-emerald-300/70 hover:!from-emerald-400 hover:!to-emerald-500";
    case "amber":
      return "border-amber-400/50 !bg-linear-to-br !from-amber-500 !to-orange-500 shadow-sm shadow-amber-950/25 hover:border-amber-300/70 hover:!from-amber-400 hover:!to-orange-400";
    case "red":
      return "border-red-400/45 !bg-linear-to-br !from-red-500 !to-rose-500 shadow-sm shadow-red-950/25 hover:border-red-300/70 hover:!from-red-400 hover:!to-rose-400";
    case "violet":
      return "border-violet-400/45 !bg-linear-to-br !from-violet-500 !to-fuchsia-500 shadow-sm shadow-violet-950/25 hover:border-violet-300/70 hover:!from-violet-400 hover:!to-fuchsia-400";
    case "zinc":
      return "border-zinc-500/60 !bg-linear-to-br !from-zinc-700 !to-zinc-800 shadow-sm shadow-black/20 hover:border-zinc-400/80 hover:!from-zinc-600 hover:!to-zinc-700";
  }
}

export const historyPanelClass = `${panelBase} p-4`;
export const historyPanelCompactClass = `${panelBase} p-3`;
export const historySoftPanelClass = `${softPanelBase} p-4`;
export const historyInsetPanelClass = `${insetPanelBase} p-3`;
export const historyBadgeClass =
  "rounded-full border border-zinc-800 bg-zinc-950/70 px-4 py-2 text-xs uppercase tracking-[0.18em] text-zinc-400 shadow-sm shadow-black/10";
export const historySectionEyebrowClass =
  "text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500";
export const historySectionTitleClass =
  "mt-2 text-base font-semibold tracking-tight text-zinc-100";
export const historySectionCopyClass = "mt-1 text-xs leading-5 text-zinc-500";
export const historyMetricCardClass =
  "relative overflow-hidden rounded-2xl border border-zinc-800 bg-linear-to-br from-zinc-900/70 to-zinc-950/75 p-4 shadow-sm shadow-black/10 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-linear-to-r before:from-transparent before:via-white/10 before:to-transparent";
export const historyNeutralButtonClass = neutralButtonBase;
export const historyGhostToggleClass = ghostToggleBase;
export const historyQuickRangeInactiveClass = neutralButtonBase;

export function historyGradientButtonClass(
  tone: "sky" | "emerald" | "amber" | "red" | "violet" | "zinc",
) {
  return `rounded-xl border !text-white transition-all duration-200 hover:-translate-y-0.5 hover:!text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/35 focus-visible:ring-offset-0 ${gradientButtonByTone(tone)}`;
}

export function historyToggleButtonClass(
  tone: "sky" | "emerald" | "amber",
  active: boolean,
) {
  if (!active) {
    return historyGhostToggleClass;
  }

  const mappedTone =
    tone === "amber" ? "amber" : tone === "emerald" ? "emerald" : "sky";
  return `rounded-lg border !text-white transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/35 focus-visible:ring-offset-0 ${gradientButtonByTone(mappedTone)}`;
}

export function historyOutlineButtonClass(tone: "sky" | "red") {
  if (tone === "red") {
    return "border-red-700 text-red-300 hover:bg-red-950/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/35 focus-visible:ring-offset-0";
  }

  return "border-sky-700 text-sky-300 hover:bg-sky-950/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/35 focus-visible:ring-offset-0";
}
