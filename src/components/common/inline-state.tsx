"use client";

import { AlertCircle, Info, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type InlineStateVariant = "error" | "info" | "warning";

const variantStyles: Record<
  InlineStateVariant,
  {
    container: string;
    icon: typeof AlertCircle;
    iconClassName: string;
  }
> = {
  error: {
    container: "border-red-500/20 bg-red-500/5 text-red-100",
    icon: AlertCircle,
    iconClassName: "text-red-300",
  },
  info: {
    container: "border-blue-500/20 bg-blue-500/5 text-blue-100",
    icon: Info,
    iconClassName: "text-blue-300",
  },
  warning: {
    container: "border-amber-500/20 bg-amber-500/5 text-amber-100",
    icon: ShieldAlert,
    iconClassName: "text-amber-300",
  },
};

export function InlineState({
  title,
  description,
  actionLabel,
  onAction,
  variant = "info",
  className,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: InlineStateVariant;
  className?: string;
}) {
  const config = variantStyles[variant];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 sm:p-5",
        config.container,
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", config.iconClassName)} />
        <div className="space-y-1">
          <p className="font-medium">{title}</p>
          <p className="text-sm opacity-80">{description}</p>
          {actionLabel && onAction ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAction}
              className="mt-2 border-current/20 bg-transparent text-current hover:bg-white/5"
            >
              {actionLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
