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
  Trash2,
  Wallet,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  applyCreditToInvoicesRuntimeAction,
  bulkVoidInvoicesRuntimeAction,
  updateInvoiceStatusRuntimeAction,
} from "@/app/dashboard/finance/client-actions";
import {
  BatchInvoiceModal,
  BatchInvoiceModalAutoOpen,
} from "@/components/dashboard/finance/batch-invoice-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { FinanceInvoiceListItemView } from "../types";

const tabs = [
  { id: "ALL", name: "All Invoices" },
  { id: "NEED_ACTION", name: "Need Action", icon: AlertCircle },
  { id: "COVERED_CREDIT", name: "Covered by Credit", icon: Wallet },
  { id: "OPEN", name: "Outstanding", icon: Clock },
  { id: "PARTIAL", name: "Partial", icon: Clock },
  { id: "PAID", name: "Settled", icon: CheckCircle2 },
  { id: "OVERDUE", name: "Overdue", icon: AlertCircle },
  { id: "VOID", name: "Voided", icon: XCircle },
];

function parseStudentSnapshot(
  snapshot: string | null,
  invoice?: FinanceInvoiceListItemView,
) {
  const fallback = {
    fullName: invoice?.studentName?.trim() || "Unknown Student",
    className: invoice?.studentClassName?.trim() || "-",
    nis: invoice?.studentNis?.trim() || "",
    nisn: invoice?.studentNisn?.trim() || "",
  };

  if (!snapshot) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(snapshot) as {
      fullName?: string;
      className?: string;
      grade?: string;
      nis?: string;
      nisn?: string;
    };

    return {
      fullName: parsed.fullName?.trim() || fallback.fullName,
      className:
        parsed.className?.trim() ||
        invoice?.studentClassName?.trim() ||
        parsed.grade?.trim() ||
        "-",
      nis: parsed.nis?.trim() || fallback.nis,
      nisn: parsed.nisn?.trim() || fallback.nisn,
    };
  } catch {
    return fallback;
  }
}

function buildInvoiceDownloadContent(invoice: FinanceInvoiceListItemView) {
  const student = parseStudentSnapshot(invoice.studentSnapshot, invoice);
  const netDue = Math.max(
    invoice.outstanding - (invoice.studentCreditBalance ?? 0),
    0,
  );
  const dueDate =
    invoice.dueDate instanceof Date
      ? invoice.dueDate.toLocaleDateString("id-ID")
      : new Date(invoice.dueDate).toLocaleDateString("id-ID");

  return [
    "EDUCORE FINANCE INVOICE",
    `Invoice No: ${invoice.invoiceNo}`,
    `Student: ${student.fullName}`,
    `Class: ${student.className}`,
    `Status: ${invoice.status}`,
    `Total Amount: ${formatCurrency(invoice.totalAmount)}`,
    `Credit/Deposit: ${formatCurrency(invoice.studentCreditBalance ?? 0)}`,
    `Outstanding: ${formatCurrency(invoice.outstanding)}`,
    `Net Due: ${formatCurrency(netDue)}`,
    `Due Date: ${dueDate}`,
  ].join("\n");
}

function getInvoiceNetDue(invoice: FinanceInvoiceListItemView) {
  return Math.max(invoice.outstanding - (invoice.studentCreditBalance ?? 0), 0);
}

function getInvoiceBadge(invoice: FinanceInvoiceListItemView) {
  if (
    invoice.outstanding > 0 &&
    (invoice.studentCreditBalance ?? 0) >= invoice.outstanding
  ) {
    return {
      label: "COVERED BY CREDIT",
      className: "bg-amber-300 text-black border-amber-300",
    };
  }

  if (invoice.status === "PAID") {
    return {
      label: "PAID",
      className: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    };
  }

  if (invoice.status === "PARTIAL") {
    return {
      label: "PARTIAL",
      className: "bg-sky-500/10 text-sky-300 border-sky-500/20",
    };
  }

  if (invoice.status === "OVERDUE") {
    return {
      label: "OVERDUE",
      className: "bg-rose-500/10 text-rose-300 border-rose-500/20",
    };
  }

  if (invoice.status === "VOID" || invoice.status === "WRITEOFF") {
    return {
      label: invoice.status,
      className: "bg-zinc-500/10 text-zinc-300 border-zinc-500/20",
    };
  }

  return {
    label: invoice.status,
    className: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
  };
}

export function InvoicesClient({
  initialInvoices,
  allowBatchGeneration = true,
  allowStatusActions = true,
  autoOpenBatchGeneration = false,
}: {
  initialInvoices: FinanceInvoiceListItemView[];
  allowBatchGeneration?: boolean;
  allowStatusActions?: boolean;
  autoOpenBatchGeneration?: boolean;
}) {
  const [activeTab, setActiveTab] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [previewInvoice, setPreviewInvoice] =
    useState<FinanceInvoiceListItemView | null>(null);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [bulkVoidOpen, setBulkVoidOpen] = useState(false);
  const [bulkVoidMode, setBulkVoidMode] = useState<"selected" | "visible">(
    "selected",
  );
  const [bulkVoidReason, setBulkVoidReason] = useState("");
  const router = useRouter();
  const { user } = useAuth();
  const canManageSensitiveStatus =
    user?.role === "admin" || user?.role === "super_admin";

  const filteredInvoices = initialInvoices.filter((inv) => {
    const status = inv.status;
    const netDue = getInvoiceNetDue(inv);
    const isCoveredByCredit =
      inv.outstanding > 0 && (inv.studentCreditBalance ?? 0) >= inv.outstanding;
    const matchesTab =
      activeTab === "ALL" ||
      status === activeTab ||
      (activeTab === "NEED_ACTION" &&
        inv.outstanding > 0 &&
        inv.baseStatus !== "VOID" &&
        inv.baseStatus !== "WRITEOFF") ||
      (activeTab === "COVERED_CREDIT" && isCoveredByCredit) ||
      (activeTab === "PARTIAL" && inv.baseStatus === "PARTIAL" && netDue > 0);

    const student = parseStudentSnapshot(inv.studentSnapshot, inv);

    const matchesSearch =
      student.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.nis.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.nisn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.className.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });
  const isBulkEligible = (invoice: FinanceInvoiceListItemView) =>
    invoice.baseStatus === "OPEN" ||
    (invoice.baseStatus === "PARTIAL" && invoice.outstanding > 0);
  const visibleEligibleInvoiceIds = filteredInvoices
    .filter(isBulkEligible)
    .map((invoice) => invoice.id);
  const selectedEligibleInvoices = filteredInvoices.filter(
    (invoice) =>
      selectedInvoiceIds.includes(invoice.id) && isBulkEligible(invoice),
  );
  const selectedEligibleInvoiceIds = selectedEligibleInvoices.map(
    (invoice) => invoice.id,
  );
  const selectedBulkTotal = selectedEligibleInvoices.reduce(
    (sum, invoice) => sum + invoice.outstanding,
    0,
  );
  const allVisibleSelected =
    visibleEligibleInvoiceIds.length > 0 &&
    visibleEligibleInvoiceIds.every((id) => selectedInvoiceIds.includes(id));

  const toggleInvoiceSelection = (invoiceId: string) => {
    setSelectedInvoiceIds((current) =>
      current.includes(invoiceId)
        ? current.filter((id) => id !== invoiceId)
        : [...current, invoiceId],
    );
  };

  const toggleVisibleSelection = () => {
    setSelectedInvoiceIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !visibleEligibleInvoiceIds.includes(id));
      }

      return Array.from(new Set([...current, ...visibleEligibleInvoiceIds]));
    });
  };

  const openBulkVoidDialog = (mode: "selected" | "visible") => {
    if (!allowStatusActions || !canManageSensitiveStatus) {
      toast.info("Bulk VOID invoice hanya tersedia untuk admin finance.");
      return;
    }

    const targetCount =
      mode === "visible"
        ? visibleEligibleInvoiceIds.length
        : selectedEligibleInvoiceIds.length;
    if (targetCount === 0) {
      toast.info("Tidak ada invoice eligible untuk VOID.");
      return;
    }

    setBulkVoidMode(mode);
    setBulkVoidReason("");
    setBulkVoidOpen(true);
  };

  const handleBulkVoid = async () => {
    if (!user?.id) return;
    const invoiceIds =
      bulkVoidMode === "visible"
        ? visibleEligibleInvoiceIds
        : selectedEligibleInvoiceIds;
    if (invoiceIds.length === 0) {
      toast.info("Tidak ada invoice eligible untuk VOID.");
      return;
    }
    if (bulkVoidReason.trim().length < 5) {
      toast.error("Alasan VOID massal minimal 5 karakter.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await bulkVoidInvoicesRuntimeAction(user.id, {
          invoiceIds,
          reason: bulkVoidReason,
        });
        const skipped =
          result.skippedPaid +
          result.skippedAlreadyFinal +
          result.skippedInvalid;
        toast.success(
          `Processed ${result.processed} VOID request, skipped ${skipped}. Approval ${result.approvalCreated}.`,
          {
            action: {
              label: "Go to Approvals",
              onClick: () =>
                router.push("/dashboard/finance/periods#approval-gate"),
            },
          },
        );
        setSelectedInvoiceIds((current) =>
          current.filter((id) => !invoiceIds.includes(id)),
        );
        setBulkVoidOpen(false);
        setBulkVoidReason("");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Bulk VOID invoice gagal.",
        );
      }
    });
  };

  const handleApplyCredit = (invoice: FinanceInvoiceListItemView) => {
    if (!user?.id) return;
    if ((invoice.studentCreditBalance ?? 0) <= 0 || invoice.outstanding <= 0) {
      toast.info("Invoice ini belum punya credit/deposit yang bisa dipakai.");
      return;
    }
    const student = parseStudentSnapshot(invoice.studentSnapshot, invoice);

    startTransition(async () => {
      try {
        const result = await applyCreditToInvoicesRuntimeAction(user.id, {
          studentId: invoice.studentId,
          invoiceIds: [invoice.id],
          amount: Math.min(
            invoice.studentCreditBalance ?? 0,
            invoice.outstanding,
          ),
          reason: `Apply credit/deposit untuk invoice ${invoice.invoiceNo} (${student.fullName})`,
          requestId: crypto.randomUUID(),
          date: new Date(),
        });

        toast.success(
          `Credit applied ${formatCurrency(result.creditUsed)}. Sisa credit ${formatCurrency(result.creditAfter)}.`,
        );
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Apply credit gagal.",
        );
      }
    });
  };

  const handleVoid = async (id: string) => {
    if (!allowStatusActions) {
      toast.info("Aksi status invoice saat ini belum dibuka di runtime ini.");
      return;
    }
    if (!canManageSensitiveStatus) {
      toast.info("Aksi VOID invoice hanya tersedia untuk admin finance.");
      return;
    }
    if (!user?.id) return;
    if (!confirm("Are you sure you want to VOID this invoice?")) return;

    startTransition(async () => {
      try {
        const result = await updateInvoiceStatusRuntimeAction(
          user.id,
          id,
          "VOID",
        );
        if (result.status === "PENDING_APPROVAL") {
          toast.success("VOID request dikirim ke Approval Gate.", {
            action: {
              label: "Go to Approvals",
              onClick: () =>
                router.push("/dashboard/finance/periods#approval-gate"),
            },
          });
          return;
        }

        toast.success("Invoice status updated.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to void invoice",
        );
      }
    });
  };

  const handleDownload = (invoice: FinanceInvoiceListItemView) => {
    const fileName = `${invoice.invoiceNo.replace(/[^A-Z0-9-_]/gi, "_")}.txt`;
    const content = buildInvoiceDownloadContent(invoice);
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    toast.success("Invoice berhasil diunduh.");
  };

  return (
    <div className="space-y-8">
      {allowBatchGeneration && autoOpenBatchGeneration ? (
        <BatchInvoiceModalAutoOpen />
      ) : null}

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
            className="border-rose-500/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/15 rounded-xl"
            disabled={
              !allowStatusActions ||
              !canManageSensitiveStatus ||
              visibleEligibleInvoiceIds.length === 0
            }
            onClick={() => openBulkVoidDialog("visible")}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Request VOID Visible
          </Button>
          <Button
            variant="outline"
            className="border-white/10 bg-white/5 text-white hover:bg-white/10 rounded-xl"
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          {!allowBatchGeneration ? (
            <Button
              disabled
              className="bg-finance-teal/40 text-white rounded-xl shadow-lg shadow-finance-teal/10"
            >
              <Plus className="mr-2 h-4 w-4" />
              Generate Batch
            </Button>
          ) : (
            <BatchInvoiceModal>
              <Button className="bg-finance-teal hover:bg-finance-teal/90 text-white rounded-xl shadow-lg shadow-finance-teal/20">
                <Plus className="mr-2 h-4 w-4" />
                Generate Batch
              </Button>
            </BatchInvoiceModal>
          )}
        </div>
      </div>

      {selectedEligibleInvoiceIds.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-rose-50 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-mono text-xs font-black uppercase tracking-widest">
              {selectedEligibleInvoiceIds.length} invoice selected
            </p>
            <p className="text-sm text-rose-100/80">
              Total outstanding: {formatCurrency(selectedBulkTotal)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              className="rounded-xl text-rose-100 hover:bg-white/10"
              onClick={() => setSelectedInvoiceIds([])}
            >
              Clear Selection
            </Button>
            <Button
              type="button"
              className="rounded-xl bg-rose-500 text-white hover:bg-rose-500/90"
              disabled={!canManageSensitiveStatus || isPending}
              onClick={() => openBulkVoidDialog("selected")}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Request VOID Selected
            </Button>
          </div>
        </div>
      ) : null}

      {canManageSensitiveStatus && visibleEligibleInvoiceIds.length > 0 ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 text-sm text-amber-100">
          Invoice removal is approval-gated: Request VOID akan masuk ke Approval
          Gate terlebih dahulu, lalu invoice berubah status setelah disetujui.
        </div>
      ) : null}

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
              <TableHead className="w-12 py-5">
                <input
                  type="checkbox"
                  aria-label="Select visible invoices"
                  checked={allVisibleSelected}
                  disabled={visibleEligibleInvoiceIds.length === 0}
                  onChange={toggleVisibleSelection}
                  className="h-4 w-4 rounded border-white/20 bg-white/10 accent-finance-teal"
                />
              </TableHead>
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
              <TableHead className="text-zinc-400 font-mono font-bold tracking-tight text-right">
                CREDIT/DEPOSIT
              </TableHead>
              <TableHead className="text-zinc-400 font-mono font-bold tracking-tight text-right">
                NET DUE
              </TableHead>
              <TableHead className="text-zinc-400 font-mono font-bold tracking-tight text-center">
                STATUS
              </TableHead>
              <TableHead className="sticky right-0 z-10 bg-zinc-950/90 text-zinc-400 font-mono font-bold tracking-tight text-right pr-8">
                REQUESTS
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence mode="popLayout">
              {filteredInvoices.map((inv, idx) => {
                const student = parseStudentSnapshot(inv.studentSnapshot, inv);
                const isEligible = isBulkEligible(inv);
                const isSelected = selectedInvoiceIds.includes(inv.id);
                const netDue = getInvoiceNetDue(inv);
                const badge = getInvoiceBadge(inv);

                return (
                  <motion.tr
                    key={inv.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.05 }}
                    className="group border-white/5 hover:bg-white/3 transition-colors cursor-pointer"
                  >
                    <TableCell className="py-6">
                      <input
                        type="checkbox"
                        aria-label={`Select invoice ${inv.invoiceNo}`}
                        checked={isSelected}
                        disabled={!isEligible}
                        onChange={() => toggleInvoiceSelection(inv.id)}
                        onClick={(event) => event.stopPropagation()}
                        className="h-4 w-4 rounded border-white/20 bg-white/10 accent-finance-teal disabled:opacity-30"
                      />
                    </TableCell>
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
                    <TableCell className="text-right font-mono">
                      <div className="flex flex-col items-end">
                        <span
                          className={cn(
                            "font-semibold",
                            (inv.studentCreditBalance ?? 0) > 0
                              ? "text-amber-300"
                              : "text-zinc-600",
                          )}
                        >
                          {formatCurrency(inv.studentCreditBalance ?? 0)}
                        </span>
                        {(inv.studentCreditBalance ?? 0) > 0 ? (
                          <span className="text-[10px] uppercase tracking-widest text-zinc-500">
                            Available deposit
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <span
                        className={cn(
                          "font-black",
                          netDue === 0 && inv.outstanding > 0
                            ? "text-amber-300"
                            : netDue > 0
                              ? "text-finance-teal"
                              : "text-zinc-500",
                        )}
                      >
                        {formatCurrency(netDue)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-widest",
                          badge.className,
                        )}
                      >
                        {badge.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="sticky right-0 bg-zinc-950/90 text-right pr-6">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin text-finance-teal" />
                        ) : (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setPreviewInvoice(inv)}
                              className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDownload(inv)}
                              className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg"
                            >
                              <FileDown className="h-4 w-4" />
                            </Button>
                            {isEligible &&
                            (inv.studentCreditBalance ?? 0) > 0 ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleApplyCredit(inv)}
                                className="h-8 rounded-lg px-2 text-[10px] font-black uppercase tracking-widest text-amber-300 hover:bg-amber-500/10 hover:text-amber-200"
                              >
                                Apply Credit
                              </Button>
                            ) : null}
                            {!allowStatusActions ? null : (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleVoid(inv.id)}
                                disabled={!canManageSensitiveStatus}
                                className="h-8 w-8 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            )}
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

      <Dialog
        open={bulkVoidOpen}
        onOpenChange={(open) => {
          setBulkVoidOpen(open);
          if (!open) {
            setBulkVoidReason("");
          }
        }}
      >
        <DialogContent className="border-white/10 bg-zinc-950 text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-mono text-xl">
              Confirm Bulk VOID
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-50">
              Aksi ini hanya membuat request VOID untuk{" "}
              <span className="font-black">
                {bulkVoidMode === "visible"
                  ? visibleEligibleInvoiceIds.length
                  : selectedEligibleInvoiceIds.length}
              </span>{" "}
              invoice eligible. Invoice paid/final tidak akan diproses, dan
              status baru berubah setelah approval disetujui.
            </div>
            <div className="space-y-2">
              <label
                htmlFor="bulk-void-reason"
                className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-500"
              >
                Reason
              </label>
              <Input
                id="bulk-void-reason"
                value={bulkVoidReason}
                onChange={(event) => setBulkVoidReason(event.target.value)}
                placeholder="Contoh: Koreksi batch invoice salah bulan"
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              className="rounded-xl text-zinc-400 hover:bg-white/5"
              disabled={isPending}
              onClick={() => setBulkVoidOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl bg-rose-500 text-white hover:bg-rose-500/90"
              disabled={isPending}
              onClick={handleBulkVoid}
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Submit VOID Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={previewInvoice !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewInvoice(null);
          }
        }}
      >
        <DialogContent className="border-white/10 bg-zinc-950 text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-mono text-xl">
              Invoice Preview
            </DialogTitle>
          </DialogHeader>
          {previewInvoice ? (
            <div className="space-y-4 text-sm">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Invoice No</span>
                  <span className="font-mono text-white">
                    {previewInvoice.invoiceNo}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-zinc-400">Student</span>
                  <span className="font-semibold text-white">
                    {
                      parseStudentSnapshot(
                        previewInvoice.studentSnapshot,
                        previewInvoice,
                      ).fullName
                    }
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-zinc-400">Class</span>
                  <span className="text-white">
                    {
                      parseStudentSnapshot(
                        previewInvoice.studentSnapshot,
                        previewInvoice,
                      ).className
                    }
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-zinc-400">Status</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-widest",
                      getInvoiceBadge(previewInvoice).className,
                    )}
                  >
                    {getInvoiceBadge(previewInvoice).label}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-zinc-400">Due Date</span>
                  <span className="text-white">
                    {new Date(previewInvoice.dueDate).toLocaleDateString(
                      "id-ID",
                    )}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-zinc-400">Total</span>
                  <span className="font-mono text-white">
                    {formatCurrency(previewInvoice.totalAmount)}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-zinc-400">Outstanding</span>
                  <span className="font-mono text-rose-300">
                    {formatCurrency(previewInvoice.outstanding)}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-zinc-400">Credit/Deposit</span>
                  <span className="font-mono text-amber-300">
                    {formatCurrency(previewInvoice.studentCreditBalance ?? 0)}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                  <span className="text-zinc-400">Net Due</span>
                  <span className="font-mono text-lg font-black text-finance-teal">
                    {formatCurrency(getInvoiceNetDue(previewInvoice))}
                  </span>
                </div>
              </div>
              {previewInvoice.outstanding > 0 &&
              (previewInvoice.studentCreditBalance ?? 0) >=
                previewInvoice.outstanding ? (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-50">
                  Invoice ini bisa diselesaikan memakai credit/deposit tanpa
                  cash tambahan.
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            {previewInvoice ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                  onClick={() => handleDownload(previewInvoice)}
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  Download
                </Button>
                {isBulkEligible(previewInvoice) &&
                (previewInvoice.studentCreditBalance ?? 0) > 0 ? (
                  <Button
                    type="button"
                    className="bg-amber-300 font-black text-black hover:bg-amber-200"
                    onClick={() => handleApplyCredit(previewInvoice)}
                  >
                    Apply Credit
                  </Button>
                ) : null}
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
