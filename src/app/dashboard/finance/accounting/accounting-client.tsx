"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  BookText,
  Building2,
  Calendar,
  ChevronRight,
  FileText,
  Layers,
  Search,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { cn, formatCurrency } from "@/lib/utils";
import type { FinanceAccountView, FinanceJournalEntryView } from "../types";
import { ManualAdjustmentDialog } from "./manual-adjustment-dialog";

export function AccountingClient({
  entries,
  accounts,
  desktopRuntime = false,
}: {
  entries: FinanceJournalEntryView[];
  accounts: FinanceAccountView[];
  desktopRuntime?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuth();
  const canManageAdjustments =
    user?.role === "admin" || user?.role === "super_admin";

  const filteredEntries = entries.filter(
    (e) =>
      e.description.toLowerCase().includes(search.toLowerCase()) ||
      e.lines.some(
        (l) =>
          l.account.code.includes(search) ||
          l.account.name.toLowerCase().includes(search.toLowerCase()),
      ),
  );
  const openSourceDocument = async (entry: FinanceJournalEntryView) => {
    if (!entry.referenceId) {
      toast.info("Jurnal ini belum memiliki dokumen sumber.");
      return;
    }

    const referenceType = entry.referenceType?.toUpperCase();
    const referenceQuery = encodeURIComponent(entry.referenceId);

    if (referenceType === "INVOICE") {
      router.push(`/dashboard/finance/invoices?q=${referenceQuery}`);
      return;
    }

    if (referenceType === "PAYMENT") {
      router.push(`/dashboard/finance/audit?q=${referenceQuery}`);
      return;
    }

    try {
      await navigator.clipboard.writeText(entry.referenceId);
      toast.success("Reference ID berhasil disalin.");
    } catch {
      toast.info(`Reference ID: ${entry.referenceId}`);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Search & Filter Header */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-finance-teal transition-colors" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari deskripsi atau kode akun..."
            className="pl-11 h-12 bg-white/5 border-white/10 rounded-xl focus:ring-finance-teal/50 transition-all text-white"
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          {canManageAdjustments && user?.id ? (
            <ManualAdjustmentDialog actorId={user.id} accounts={accounts}>
              <Button className="flex-1 md:flex-none h-12 rounded-xl bg-finance-teal hover:bg-finance-teal/90 font-black gap-2">
                <Layers className="h-4 w-4" /> New Adjustment
              </Button>
            </ManualAdjustmentDialog>
          ) : (
            <div className="flex flex-1 flex-col gap-2 md:flex-none">
              <Button
                className="h-12 rounded-xl bg-finance-teal hover:bg-finance-teal/90 font-black gap-2"
                disabled
              >
                <Layers className="h-4 w-4" /> New Adjustment
              </Button>
              {desktopRuntime ? (
                <p className="text-right text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                  Admin finance only
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Ledger Table */}
      <div className="space-y-4">
        {filteredEntries.length > 0 ? (
          filteredEntries.map((entry, idx) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card
                className={cn(
                  "group overflow-hidden border-white/5 bg-white/5 backdrop-blur-3xl rounded-[2rem] transition-all duration-500",
                  selectedEntry === entry.id
                    ? "ring-2 ring-finance-teal/30 shadow-2xl shadow-finance-teal/5"
                    : "hover:bg-white/8 hover:translate-y-[-2px]",
                )}
              >
                <div
                  className={cn(
                    "p-8 border-none w-full text-left transition-all duration-300 rounded-[2rem]",
                    selectedEntry === entry.id
                      ? "bg-white/5"
                      : "bg-transparent",
                  )}
                >
                  <button
                    type="button"
                    className="w-full text-left flex flex-col lg:flex-row lg:items-center justify-between gap-6 outline-hidden"
                    onClick={() =>
                      setSelectedEntry(
                        selectedEntry === entry.id ? null : entry.id,
                      )
                    }
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      setSelectedEntry(
                        selectedEntry === entry.id ? null : entry.id,
                      )
                    }
                  >
                    <div className="flex items-start gap-6">
                      <div className="p-4 rounded-2xl bg-zinc-900 border border-white/5 shadow-inner">
                        <BookText className="h-6 w-6 text-zinc-500" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <p className="text-[10px] font-mono font-black text-finance-teal uppercase tracking-[0.2em]">
                            {entry.referenceType || "GL"} Entry
                          </p>
                          {entry.isAutoPost && (
                            <Badge
                              variant="outline"
                              className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400 text-[8px] font-black tracking-widest px-2"
                            >
                              AUTO-POST
                            </Badge>
                          )}
                        </div>
                        <h4 className="text-xl font-bold text-white leading-tight">
                          {entry.description}
                        </h4>
                        <div className="flex items-center gap-4 text-xs font-mono text-zinc-500">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3" />{" "}
                            {new Date(entry.date).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Building2 className="h-3 w-3" /> Journal ID:{" "}
                            {entry.id.split("-")[0].toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-12 text-right">
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-mono font-black text-zinc-600 uppercase tracking-widest">
                          Total Value
                        </p>
                        <p className="text-2xl font-black text-white tracking-tighter">
                          {formatCurrency(
                            entry.lines.reduce((sum, l) => sum + l.debit, 0),
                          )}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "h-12 w-12 rounded-2xl flex items-center justify-center transition-all duration-500",
                          selectedEntry === entry.id
                            ? "bg-finance-teal text-white rotate-90"
                            : "bg-white/5 text-zinc-600",
                        )}
                      >
                        <ChevronRight className="h-6 w-6" />
                      </div>
                    </div>
                  </button>
                </div>

                {/* Expandable Journal Lines */}
                <AnimatePresence>
                  {selectedEntry === entry.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-white/5 bg-black/20"
                    >
                      <div className="p-8 space-y-6">
                        <div className="grid grid-cols-12 gap-4 text-[10px] font-mono font-black text-zinc-500 uppercase tracking-widest border-b border-white/5 pb-4">
                          <div className="col-span-5">Akun</div>
                          <div className="col-span-2">Type</div>
                          <div className="col-span-2 text-right">Debit</div>
                          <div className="col-span-2 text-right">Credit</div>
                          <div className="col-span-1 text-right">Status</div>
                        </div>

                        <div className="space-y-2">
                          {entry.lines.map((line) => (
                            <div
                              key={line.id}
                              className="grid grid-cols-12 gap-4 items-center py-3 group/line"
                            >
                              <div className="col-span-5 flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center text-[10px] font-mono font-bold text-zinc-400">
                                  {line.account.code}
                                </div>
                                <span className="font-bold text-zinc-300 group-hover/line:text-white transition-colors">
                                  {line.account.name}
                                </span>
                              </div>
                              <div className="col-span-2">
                                <Badge
                                  variant="outline"
                                  className="border-white/5 text-[9px] text-zinc-500 font-mono italic"
                                >
                                  {line.account.type}
                                </Badge>
                              </div>
                              <div className="col-span-2 text-right">
                                {line.debit > 0 ? (
                                  <div className="flex items-center justify-end gap-2 text-emerald-400 font-mono font-bold">
                                    {formatCurrency(line.debit)}
                                    <ArrowDownLeft className="h-3 w-3" />
                                  </div>
                                ) : (
                                  <span className="text-zinc-800 font-mono">
                                    -
                                  </span>
                                )}
                              </div>
                              <div className="col-span-2 text-right">
                                {line.credit > 0 ? (
                                  <div className="flex items-center justify-end gap-2 text-rose-400 font-mono font-bold">
                                    {formatCurrency(line.credit)}
                                    <ArrowUpRight className="h-3 w-3" />
                                  </div>
                                ) : (
                                  <span className="text-zinc-800 font-mono">
                                    -
                                  </span>
                                )}
                              </div>
                              <div className="col-span-1 text-right">
                                <Badge className="border-white/5 bg-white/5 text-[9px] font-mono text-zinc-500">
                                  Posted
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Audit Tail */}
                        <div className="flex items-center justify-between pt-6 border-t border-white/5">
                          <div className="flex items-center gap-4">
                            <BadgeCheck className="h-5 w-5 text-finance-teal" />
                            <p className="text-xs text-zinc-500 font-medium">
                              Jurnal sudah seimbang dan siap masuk audit trail.
                            </p>
                          </div>
                          {entry.referenceId && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => openSourceDocument(entry)}
                              className="h-10 rounded-xl bg-white/5 border-white/5 text-xs text-zinc-400 hover:text-white gap-2"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              {entry.referenceType?.toUpperCase() === "INVOICE"
                                ? "Open Invoice"
                                : entry.referenceType?.toUpperCase() ===
                                    "PAYMENT"
                                  ? "Open Payment"
                                  : "Copy Reference"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          ))
        ) : (
          <div className="py-32 flex flex-col items-center justify-center text-zinc-700 bg-white/2 border border-white/5 rounded-[3rem]">
            <BookText className="h-20 w-20 opacity-10 mb-8" />
            <div className="space-y-4 text-center max-w-sm">
              <p className="font-black text-3xl text-zinc-800 tracking-tighter">
                Belum Ada Jurnal
              </p>
              <p className="text-zinc-600 text-sm font-medium leading-relaxed">
                Belum ada jurnal yang cocok dengan pencarian. Posting otomatis
                akan muncul setelah invoice dibuat atau pembayaran diproses.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
