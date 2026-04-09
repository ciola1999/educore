"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileDown,
  Loader2,
  Plus,
  Search,
  XCircle,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { BatchInvoiceModal } from "@/components/dashboard/finance/batch-invoice-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { cn, formatCurrency } from "@/lib/utils";
import { updateInvoiceStatusAction } from "../actions";
import type { FinanceInvoiceListItemView } from "../types";

const tabs = [
  { id: "ALL", name: "All Invoices" },
  { id: "OPEN", name: "Outstanding", icon: Clock },
  { id: "PAID", name: "Settled", icon: CheckCircle2 },
  { id: "OVERDUE", name: "Overdue", icon: AlertCircle },
  { id: "VOID", name: "Voided", icon: XCircle },
];

function parseStudentSnapshot(snapshot: string | null) {
  if (!snapshot) {
    return { fullName: "Unknown Student", className: "-" };
  }

  try {
    const parsed = JSON.parse(snapshot) as {
      fullName?: string;
      className?: string;
    };

    return {
      fullName: parsed.fullName?.trim() || "Unknown Student",
      className: parsed.className?.trim() || "-",
    };
  } catch {
    return { fullName: "Unknown Student", className: "-" };
  }
}

export function InvoicesClient({
  initialInvoices,
}: {
  initialInvoices: FinanceInvoiceListItemView[];
}) {
  const [activeTab, setActiveTab] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const { user } = useAuth();

  const filteredInvoices = initialInvoices.filter((inv) => {
    const status = inv.status;
    const matchesTab = activeTab === "ALL" || status === activeTab;

    const studentName = parseStudentSnapshot(inv.studentSnapshot).fullName;

    const matchesSearch =
      studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const handleVoid = async (id: string) => {
    if (!user?.id) return;
    if (!confirm("Are you sure you want to VOID this invoice?")) return;

    startTransition(async () => {
      try {
        const result = await updateInvoiceStatusAction(user.id, id, "VOID");
        if (result.status === "PENDING_APPROVAL") {
          toast.success("Permintaan VOID dikirim ke approval gate.");
          return;
        }

        toast.success("Invoice voided successfully");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to void invoice",
        );
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* Search & Actions Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            placeholder="Search student or invoice number..."
            className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-zinc-500 rounded-xl focus:ring-finance-teal/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="border-white/10 bg-white/5 text-white hover:bg-white/10 rounded-xl"
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <BatchInvoiceModal>
            <Button className="bg-finance-teal hover:bg-finance-teal/90 text-white rounded-xl shadow-lg shadow-finance-teal/20">
              <Plus className="mr-2 h-4 w-4" />
              Generate Batch
            </Button>
          </BatchInvoiceModal>
        </div>
      </div>

      {/* Glass Tabs */}
      <div className="flex flex-wrap gap-2 p-1 bg-white/5 border border-white/5 rounded-2xl w-fit">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative px-4 py-2 text-sm font-medium transition-all duration-300 rounded-xl flex items-center gap-2",
                isActive ? "text-white" : "text-zinc-400 hover:text-zinc-200",
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="tab-pill"
                  className="absolute inset-0 bg-white/10 ring-1 ring-white/10 rounded-xl"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              {tab.icon && (
                <tab.icon
                  className={cn(
                    "h-4 w-4 z-10",
                    isActive && "text-finance-teal",
                  )}
                />
              )}
              <span className="z-10">{tab.name}</span>
            </button>
          );
        })}
      </div>

      {/* Invoice Ledger Table */}
      <Card className="overflow-hidden border-white/5 bg-white/5 backdrop-blur-xl rounded-2xl">
        <Table>
          <TableHeader className="bg-white/5">
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="text-zinc-400 font-mono font-bold tracking-tight py-5">
                INVOICE NO
              </TableHead>
              <TableHead className="text-zinc-400 font-mono font-bold tracking-tight">
                STUDENT / CLASS
              </TableHead>
              <TableHead className="text-zinc-400 font-mono font-bold tracking-tight text-right">
                AMOUNT
              </TableHead>
              <TableHead className="text-zinc-400 font-mono font-bold tracking-tight text-right">
                OUTSTANDING
              </TableHead>
              <TableHead className="text-zinc-400 font-mono font-bold tracking-tight text-center">
                STATUS
              </TableHead>
              <TableHead className="text-zinc-400 font-mono font-bold tracking-tight text-right pr-8">
                ACTIONS
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence mode="popLayout">
              {filteredInvoices.map((inv, idx) => {
                const student = parseStudentSnapshot(inv.studentSnapshot);

                return (
                  <motion.tr
                    key={inv.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.05 }}
                    className="group border-white/5 hover:bg-white/3 transition-colors cursor-pointer"
                  >
                    <TableCell className="font-mono text-zinc-300 py-6">
                      {inv.invoiceNo}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-white">
                          {student.fullName}
                        </span>
                        <span className="text-xs text-zinc-500 uppercase tracking-wider">
                          {student.className || "-"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold text-white">
                      {formatCurrency(inv.totalAmount)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <span
                        className={cn(
                          "font-semibold",
                          inv.outstanding > 0
                            ? "text-rose-400"
                            : "text-emerald-400",
                        )}
                      >
                        {formatCurrency(inv.outstanding)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={
                          inv.status === "PAID"
                            ? "success"
                            : inv.status === "OPEN"
                              ? "info"
                              : inv.status === "OVERDUE"
                                ? "destructive"
                                : "outline"
                        }
                      >
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin text-finance-teal" />
                        ) : (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg"
                            >
                              <FileDown className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleVoid(inv.id)}
                              className="h-8 w-8 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </TableBody>
        </Table>

        {filteredInvoices.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center text-zinc-500 bg-white/2">
            <Search className="h-12 w-12 opacity-20 mb-4" />
            <p className="font-mono text-sm tracking-widest text-zinc-600">
              No invoices found matching criteria.
            </p>
          </div>
        )}
      </Card>

      {/* Pagination Footer (Glassmorphism) */}
      <div className="flex items-center justify-between px-6 py-4 bg-white/5 border border-white/5 rounded-2xl backdrop-blur-md">
        <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">
          Showing{" "}
          <span className="text-white font-bold">
            {filteredInvoices.length}
          </span>{" "}
          of {initialInvoices.length} items
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 border-white/10 bg-transparent text-white rounded-lg opacity-50"
            disabled
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 border-white/10 bg-white/10 text-white rounded-lg"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
