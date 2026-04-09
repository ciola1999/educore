"use client";

import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CircleDollarSign,
  History,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";

type FinanceSummary = {
  revenue: number;
  receivables: number;
  collectionRate: number;
  invoiceCount: number;
};

export function FinanceOverviewClient({
  summary,
}: {
  summary: FinanceSummary;
}) {
  const stats = [
    {
      name: "Revenue (Month)",
      value: summary.revenue,
      change: "+0.0%", // Change logic can be added later
      trend: "up",
      icon: CircleDollarSign,
      color: "text-emerald-400",
    },
    {
      name: "Total Receivables",
      value: summary.receivables,
      change: "Stable",
      trend: "up",
      icon: Receipt,
      color: "text-sky-400",
    },
    {
      name: "Collection Rate",
      value: `${(summary.collectionRate * 100).toFixed(1)}%`,
      change: "Active",
      trend: "up",
      icon: TrendingUp,
      color: "text-finance-teal",
    },
    {
      name: "Open Invoices",
      value: summary.invoiceCount,
      change: "Live",
      trend: "up",
      icon: AlertCircle,
      color: "text-rose-400",
    },
  ];

  return (
    <div className="space-y-10">
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
                  {typeof stat.value === "number"
                    ? formatCurrency(stat.value)
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
            <div className="flex gap-2">
              <div className="h-2 w-8 rounded-full bg-finance-teal/40" />
              <div className="h-2 w-8 rounded-full bg-zinc-700" />
            </div>
          </div>
          <div className="mt-12 flex h-64 items-end justify-between gap-4">
            {[45, 62, 58, 85, 72, 90, 82].map((height, i) => (
              <motion.div
                key={`collection-bar-${i}-${height}`}
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
              </motion.div>
            ))}
          </div>
          <div className="mt-4 flex justify-between text-xs font-medium text-zinc-500">
            <span>OCT</span>
            <span>NOV</span>
            <span>DEC</span>
            <span>JAN</span>
            <span>FEB</span>
            <span>MAR</span>
            <span>APR</span>
          </div>
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
                className="flex w-full cursor-pointer items-center justify-between rounded-xl bg-finance-teal px-5 py-4 font-semibold text-white transition-all hover:brightness-110 active:scale-95"
              >
                New Payment
                <Wallet className="h-5 w-5" />
              </button>
              <button
                type="button"
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
            <h4 className="mt-2 text-2xl font-bold text-white">APRIL 2026</h4>
            <div className="mt-4 flex items-center gap-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              <span className="text-xs font-semibold text-emerald-400 uppercase">
                Live & Unlocked
              </span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
