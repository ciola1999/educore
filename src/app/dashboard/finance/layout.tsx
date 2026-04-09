"use client";

import { motion } from "framer-motion";
import {
  BookText,
  CalendarRange,
  FileText,
  History,
  LayoutDashboard,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Overview", href: "/dashboard/finance", icon: LayoutDashboard },
  {
    name: "General Ledger",
    href: "/dashboard/finance/accounting",
    icon: BookText,
  },
  { name: "Invoices", href: "/dashboard/finance/invoices", icon: FileText },
  { name: "Payments", href: "/dashboard/finance/payments", icon: Wallet },
  { name: "Periods", href: "/dashboard/finance/periods", icon: CalendarRange },
  { name: "Audit Logs", href: "/dashboard/finance/audit", icon: History },
];

export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-8">
      {/* Header with Glass Navigation */}
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-mono text-3xl font-bold tracking-tight text-white md:text-4xl">
            Finance<span className="text-finance-teal">Engine</span>
          </h1>
          <p className="mt-2 text-zinc-400">
            Automated billing, payment allocation, and double-entry accounting.
          </p>
        </div>

        <nav className="flex items-center gap-1 rounded-2xl border border-white/5 bg-white/5 p-1.5 backdrop-blur-xl">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "text-white"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-tab"
                    className="absolute inset-0 rounded-xl bg-linear-to-r from-finance-teal/20 to-finance-teal/10 ring-1 ring-finance-teal/30"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <item.icon
                  className={cn(
                    "z-10 h-4 w-4",
                    isActive && "text-finance-teal",
                  )}
                />
                <span className="z-10 hidden sm:inline">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="relative">
        {/* Subtle Glow Effect for Main Content */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-finance-teal/10 blur-[80px]" />
        {children}
      </div>
    </div>
  );
}
