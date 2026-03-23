"use client";

import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { InlineState } from "./inline-state";

type PhaseBoundaryAction = {
  href: string;
  label: string;
  variant?: "default" | "outline";
};

export function PhaseBoundary({
  bannerTitle = "Boundary fase 1 aktif",
  bannerDescription,
  lockTitle,
  lockDescription,
  actions = [],
}: {
  bannerTitle?: string;
  bannerDescription: string;
  lockTitle?: string;
  lockDescription?: string;
  actions?: PhaseBoundaryAction[];
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-100">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-300" />
          <div className="space-y-1">
            <p className="font-medium">{bannerTitle}</p>
            <p className="text-amber-200/80">{bannerDescription}</p>
          </div>
        </div>
      </div>

      {lockTitle && lockDescription ? (
        <InlineState
          title={lockTitle}
          description={lockDescription}
          variant="warning"
        />
      ) : null}

      {actions.length > 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
          <p className="mb-3 font-semibold text-zinc-200">
            Navigasi alternatif fase
          </p>
          <div className="flex flex-wrap gap-3">
            {actions.map((action) => (
              <Button
                key={`${action.href}-${action.label}`}
                asChild
                variant={action.variant === "outline" ? "outline" : "default"}
                className={
                  action.variant === "outline"
                    ? "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                    : "bg-blue-600 hover:bg-blue-500"
                }
              >
                <Link href={action.href}>{action.label}</Link>
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
