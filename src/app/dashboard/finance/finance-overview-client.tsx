"use client";

import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CircleDollarSign,
  DatabaseZap,
  History,
  Receipt,
  RefreshCcw,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";
import type { FinanceSummaryView } from "./types";

export function FinanceOverviewClient({
  summary,
  syncNotice,
}: {
  summary: FinanceSummaryView;
  syncNotice?: string | null;
}) {
  const router = useRouter();
  const stats = [
    {
      name: "Revenue (Month)",
      value: summary.revenue,
      valueType: "currency",
      change: "+0.0%", // Change logic can be added later
      trend: "up",
      icon: CircleDollarSign,
      color: "text-emerald-400",
    },
    {
      name: "Total Receivables",
      value: summary.receivables,
      valueType: "currency",
      change: "Stable",
      trend: "up",
      icon: Receipt,
      color: "text-sky-400",
    },
    {
      name: "Collection Rate",
      value: `${(summary.collectionRate * 100).toFixed(1)}%`,
      valueType: "text",
      change: "Active",
      trend: "up",
      icon: TrendingUp,
      color: "text-finance-teal",
    },
    {
      name: "Open Invoices",
      value: summary.invoiceCount,
      valueType: "count",
      change: "Live",
      trend: "up",
      icon: AlertCircle,
      color: "text-rose-400",
    },
  ];
  const maxTrendAmount = Math.max(
    1,
    ...summary.revenueTrend.map((point) => point.amount),
  );
  const hasTrendData = summary.revenueTrend.some((point) => point.amount > 0);
  const activePeriodTone =
    summary.activePeriodStatus === "CLOSED"
      ? "text-rose-400"
      : summary.activePeriodStatus === "SOFT_CLOSED"
        ? "text-amber-400"
        : "text-emerald-400";
  const activePeriodDot =
    summary.activePeriodStatus === "CLOSED"
      ? "bg-rose-400"
      : summary.activePeriodStatus === "SOFT_CLOSED"
        ? "bg-amber-400"
        : "bg-emerald-400";
  const seededStateMessage =
    summary.dataState === "seeded"
      ? summary.canManageSync
        ? "Data transaksi Finance di perangkat ini belum lengkap. Jalankan sinkronisasi agar ringkasan memakai data sekolah terbaru."
        : "Data transaksi Finance di perangkat ini belum lengkap. Minta admin menjalankan sinkronisasi."
      : null;
  const pendingSyncMessage = summary.pendingSync
    ? "Ada perubahan Finance lokal yang masih menunggu sinkronisasi cloud."
    : null;

  return (
    <div className="space-y-10">
      {seededStateMessage || pendingSyncMessage || syncNotice ? (
        <div className="space-y-3">
          {seededStateMessage ? (
            <Card className="border-amber-500/20 bg-amber-500/10 p-5 text-amber-50">
              <div className="flex items-start gap-3">
                <DatabaseZap className="mt-0.5 h-5 w-5 text-amber-300" />
                <p className="text-sm leading-6 text-amber-100/95">
                  {seededStateMessage}
                </p>
              </div>
            </Card>
          ) : null}
          {pendingSyncMessage ? (
            <Card className="border-sky-500/20 bg-sky-500/10 p-5 text-sky-50">
              <div className="flex items-start gap-3">
                <RefreshCcw className="mt-0.5 h-5 w-5 text-sky-300" />
                <p className="text-sm leading-6 text-sky-100/95">
                  {pendingSyncMessage}
                </p>
              </div>
            </Card>
          ) : null}
          {syncNotice ? (
            <Card className="border-emerald-500/20 bg-emerald-500/10 p-5 text-emerald-50">
              <div className="flex items-start gap-3">
                <RefreshCcw className="mt-0.5 h-5 w-5 text-emerald-300" />
                <p className="text-sm leading-6 text-emerald-100/95">
                  {syncNotice}
                </p>
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}

      {/* Metrics Bento Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1, duration: 0.5 }}
          >
            <Card className="group relative overflow-hidden border-white/5 bg-white/5 p-6 backdrop-blur-xl transition-all duration-300 hover:bg-white/8 hover:shadow-2xl hover:shadow-finance-teal/5">
              <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-finance-teal/5 blur-3xl transition-opacity group-hover:opacity-100" />

              <div className="flex items-center justify-between">
                <div className={cn("rounded-xl bg-white/5 p-2", stat.color)}>
                  <stat.icon className="h-6 w-6" />
                </div>
                <div
                  className={cn(
                    "flex items-center gap-1 text-sm font-medium",
                    stat.trend === "up" ? "text-emerald-400" : "text-rose-400",
                  )}
                >
                  {stat.change}
                  {stat.trend === "up" ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" />
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-1">
                <p className="text-sm font-medium text-zinc-400">{stat.name}</p>
                <p className="font-mono text-2xl font-bold text-white">
                  {stat.valueType === "currency" &&
                  typeof stat.value === "number"
                    ? formatCurrency(stat.value)
                    : stat.valueType === "count" &&
                        typeof stat.value === "number"
                      ? stat.value.toLocaleString("id-ID")
                      : stat.value}
                </p>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Main Content Area: Bento Charts & Actions */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Collection Graph */}
        <Card className="col-span-1 border-white/5 bg-white/5 p-8 backdrop-blur-xl lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-lg font-bold text-white">
              Collection Trend
            </h3>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
              {hasTrendData ? "6 Bulan Terakhir" : "Menunggu transaksi"}
            </p>
          </div>
          {hasTrendData ? (
            <>
              <div className="mt-12 flex h-64 items-end justify-between gap-4">
                {summary.revenueTrend.map((point, i) => {
                  const height = Math.max(
                    10,
                    Math.round((point.amount / maxTrendAmount) * 100),
                  );

                  return (
                    <motion.div
                      key={`collection-bar-${point.label}`}
                      initial={{ height: 0 }}
                      animate={{ height: `${height}%` }}
                      transition={{
                        delay: 0.5 + i * 0.05,
                        duration: 0.8,
                        ease: "easeOut",
                      }}
                      className="relative w-full rounded-t-lg bg-linear-to-t from-finance-teal/40 to-finance-teal/10 group cursor-pointer"
                    >
                      <div className="absolute inset-0 bg-finance-teal opacity-0 blur-md transition-opacity group-hover:opacity-20" />
                      <div className="absolute -top-8 left-1/2 hidden -translate-x-1/2 rounded-full border border-white/10 bg-zinc-950/90 px-2 py-1 text-[10px] font-semibold text-zinc-100 group-hover:block">
                        {formatCurrency(point.amount)}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              <div className="mt-4 flex justify-between text-xs font-medium text-zinc-500">
                {summary.revenueTrend.map((point) => (
                  <span key={`collection-label-${point.label}`}>
                    {point.label}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-10 rounded-2xl border border-dashed border-white/10 bg-black/10 p-8 text-sm leading-6 text-zinc-400">
              Tren pembayaran akan muncul setelah desktop ini memiliki transaksi
              Finance yang nyata. Saat ini sistem hanya bisa menampilkan
              ringkasan dari data lokal yang tersedia.
            </div>
          )}
        </Card>

        {/* Quick Actions Side Bento */}
        <div className="space-y-6">
          <Card className="border-white/5 bg-white/5 p-8 backdrop-blur-xl">
            <h3 className="font-mono text-lg font-bold text-white">
              Quick Actions
            </h3>
            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => router.push("/dashboard/finance/payments")}
                className="flex w-full cursor-pointer items-center justify-between rounded-xl bg-finance-teal px-5 py-4 font-semibold text-white transition-all hover:brightness-110 active:scale-95"
              >
                New Payment
                <Wallet className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/dashboard/finance/invoices?action=generate-batch",
                  )
                }
                className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-white/5 px-5 py-4 font-semibold text-white transition-all hover:bg-white/10 active:scale-95"
              >
                Generate Invoices
                <History className="h-5 w-5" />
              </button>
            </div>
          </Card>

          <Card className="relative overflow-hidden border-white/5 bg-zinc-950 p-8 shadow-inner shadow-finance-teal/5">
            <div className="absolute -right-6 -top-6 h-12 w-12 rounded-full bg-finance-teal opacity-20 blur-2xl" />
            <p className="text-sm font-medium text-zinc-500 uppercase tracking-widest">
              Active Period
            </p>
            <h4 className="mt-2 text-2xl font-bold text-white">
              {summary.activePeriodLabel ?? "Belum ada periode aktif"}
            </h4>
            <div className="mt-4 flex items-center gap-2">
              <div
                className={cn(
                  "h-2 w-2 animate-pulse rounded-full",
                  activePeriodDot,
                )}
              />
              <span
                className={cn(
                  "text-xs font-semibold uppercase",
                  activePeriodTone,
                )}
              >
                {summary.activePeriodStatus === "SOFT_CLOSED"
                  ? "Soft Closed"
                  : summary.activePeriodStatus === "CLOSED"
                    ? "Closed"
                    : summary.activePeriodStatus === "OPEN"
                      ? "Open"
                      : "No Active Period"}
              </span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
