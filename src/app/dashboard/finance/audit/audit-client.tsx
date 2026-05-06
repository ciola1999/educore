"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Calendar,
  ClipboardList,
  FileJson,
  Hash,
  Search,
  Shield,
  User,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";
import type { FinanceAuditLogView } from "../types";

type AuditPayload = {
  creditReceiptNo?: string;
  student?: { fullName?: string; nis?: string };
  studentId?: string;
  allocations?: Array<{
    invoiceId?: string;
    invoiceNo?: string;
    amount?: number;
  }>;
  creditAllocations?: Array<{
    invoiceId?: string;
    invoiceNo?: string;
    amount?: number;
  }>;
  invoiceSettlements?: Array<{
    invoiceId?: string;
    invoiceNo?: string;
    cashAmount?: number;
    creditAmount?: number;
    totalSettled?: number;
  }>;
  creditUsed?: number;
  creditBefore?: number;
  creditAfter?: number;
  cashPaid?: number;
  reason?: string;
  paymentNo?: string;
  invoiceNo?: string;
  receiptNo?: string;
  action?: string;
  status?: string;
  fromStatus?: string;
  toStatus?: string;
  oldStatus?: string;
  previousStatus?: string;
  nextStatus?: string;
  requestedStatus?: string;
  processed?: number;
  skippedExisting?: number;
  skippedInvalid?: number;
  count?: number;
};

function parseLogPayload(details: string | null): AuditPayload | null {
  if (!details) return null;
  try {
    return JSON.parse(details) as AuditPayload;
  } catch {
    return null;
  }
}

function formatLogPayload(details: string | null) {
  if (!details) {
    return "No additional payload recorded for this event.";
  }

  try {
    return JSON.stringify(JSON.parse(details), null, 4);
  } catch {
    return details;
  }
}

function getActionBadge(action: string) {
  if (action === "CREDIT_APPLIED") {
    return "bg-amber-500/10 text-amber-300 border-amber-500/20";
  }
  if (action.includes("PAYMENT")) {
    return "bg-emerald-500/10 text-emerald-300 border-emerald-500/20";
  }
  if (action.includes("INVOICE")) {
    return "bg-cyan-500/10 text-cyan-300 border-cyan-500/20";
  }
  if (action.includes("BATCH")) {
    return "bg-violet-500/10 text-violet-300 border-violet-500/20";
  }
  return "border-white/10 text-zinc-300";
}

function getLogSummary(log: FinanceAuditLogView) {
  const payload = parseLogPayload(log.details);
  if (!payload) return null;

  if (log.action === "CREDIT_APPLIED") {
    return {
      title: payload.creditReceiptNo ?? "Credit settlement",
      lines: [
        payload.student?.fullName
          ? `Student: ${payload.student.fullName}`
          : undefined,
        `Used: ${formatCurrency(payload.creditUsed ?? 0)}`,
        `Credit after: ${formatCurrency(payload.creditAfter ?? 0)}`,
        payload.reason ? `Reason: ${payload.reason}` : undefined,
      ].filter((line): line is string => Boolean(line)),
    };
  }

  if (log.action === "PAYMENT_PROCESS") {
    const settlementTotal =
      payload.invoiceSettlements?.reduce(
        (total, settlement) => total + (settlement.totalSettled ?? 0),
        0,
      ) ?? 0;

    return {
      title: payload.paymentNo ?? "Payment processed",
      lines: [
        payload.receiptNo ? `Receipt: ${payload.receiptNo}` : undefined,
        `Cash paid: ${formatCurrency(payload.cashPaid ?? 0)}`,
        `Credit used: ${formatCurrency(payload.creditUsed ?? 0)}`,
        settlementTotal > 0
          ? `Settled: ${formatCurrency(settlementTotal)}`
          : undefined,
        payload.invoiceSettlements?.length
          ? `Invoices: ${payload.invoiceSettlements.length}`
          : undefined,
        `Credit after: ${formatCurrency(payload.creditAfter ?? 0)}`,
      ].filter((line): line is string => Boolean(line)),
    };
  }

  if (log.action === "BATCH_INVOICE_GENERATE") {
    return {
      title: "Batch invoice generated",
      lines: [
        payload.processed !== undefined
          ? `Generated: ${payload.processed}`
          : undefined,
        payload.skippedExisting !== undefined
          ? `Skipped existing: ${payload.skippedExisting}`
          : undefined,
        payload.skippedInvalid !== undefined
          ? `Skipped invalid: ${payload.skippedInvalid}`
          : undefined,
        payload.count !== undefined ? `Count: ${payload.count}` : undefined,
      ].filter((line): line is string => Boolean(line)),
    };
  }

  if (log.action.startsWith("INVOICE_STATUS_")) {
    return {
      title:
        payload.invoiceNo ??
        (log.action.endsWith("_REQUESTED")
          ? "Invoice status request"
          : "Invoice status updated"),
      lines: [
        payload.fromStatus && payload.toStatus
          ? `${payload.fromStatus} -> ${payload.toStatus}`
          : undefined,
        payload.previousStatus && payload.requestedStatus
          ? `${payload.previousStatus} -> ${payload.requestedStatus}`
          : undefined,
        payload.oldStatus && payload.nextStatus
          ? `${payload.oldStatus} -> ${payload.nextStatus}`
          : undefined,
        payload.status ? `Status: ${payload.status}` : undefined,
        payload.requestedStatus
          ? `Requested: ${payload.requestedStatus}`
          : undefined,
        payload.reason ? `Reason: ${payload.reason}` : undefined,
      ].filter((line): line is string => Boolean(line)),
    };
  }

  return null;
}

function getSettlementLines(payload: AuditPayload | null) {
  return (
    payload?.invoiceSettlements?.map((settlement) => {
      const invoiceNo = settlement.invoiceNo ?? settlement.invoiceId ?? "-";
      return `${invoiceNo}: cash ${formatCurrency(
        settlement.cashAmount ?? 0,
      )}, credit ${formatCurrency(
        settlement.creditAmount ?? 0,
      )}, total ${formatCurrency(settlement.totalSettled ?? 0)}`;
    }) ?? []
  );
}

function buildEvidenceContent(log: FinanceAuditLogView) {
  const summary = getLogSummary(log);
  const payload = parseLogPayload(log.details);
  const settlementLines = getSettlementLines(payload);
  return [
    "EDUCORE FINANCE AUDIT EVIDENCE",
    "===============================",
    `Action : ${log.action}`,
    `Actor  : ${log.actor.fullName}`,
    `Date   : ${new Date(log.createdAt).toLocaleString()}`,
    summary ? `Title  : ${summary.title}` : "",
    summary ? summary.lines.join("\n") : "",
    settlementLines.length > 0 ? "" : "",
    settlementLines.length > 0 ? "Invoice Settlement:" : "",
    settlementLines.length > 0 ? settlementLines.join("\n") : "",
    "",
    "Payload:",
    formatLogPayload(log.details),
  ]
    .filter(Boolean)
    .join("\n");
}

function downloadEvidence(log: FinanceAuditLogView) {
  const payload = parseLogPayload(log.details);
  const evidenceNo =
    payload?.creditReceiptNo ||
    payload?.receiptNo ||
    payload?.paymentNo ||
    log.id.split("-")[0];
  const safeName = evidenceNo.replace(/[^A-Z0-9-_]/gi, "_");
  const blob = new Blob([buildEvidenceContent(log)], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeName}.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function AuditClient({ logs }: { logs: FinanceAuditLogView[] }) {
  const [search, setSearch] = useState("");
  const [selectedLog, setSelectedLog] = useState<string | null>(null);

  const filteredLogs = logs.filter(
    (l) =>
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.actor.fullName.toLowerCase().includes(search.toLowerCase()) ||
      l.details?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-finance-teal transition-colors" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events, actors, details..."
            className="pl-11 h-12 bg-white/5 border-white/10 rounded-xl focus:ring-finance-teal/50 transition-all text-white"
          />
        </div>
      </div>

      <div className="space-y-4">
        {filteredLogs.length > 0 ? (
          filteredLogs.map((log, idx) => {
            const summary = getLogSummary(log);
            const payload = parseLogPayload(log.details);
            const settlementLines = getSettlementLines(payload);

            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
              >
                <Card
                  className={cn(
                    "group overflow-hidden border-white/5 bg-white/5 backdrop-blur-3xl rounded-3xl transition-all duration-500",
                    selectedLog === log.id
                      ? "bg-white/10 ring-1 ring-white/20"
                      : "hover:bg-white/8",
                  )}
                >
                  <button
                    type="button"
                    className="p-6 cursor-pointer w-full text-left"
                    onClick={() =>
                      setSelectedLog(selectedLog === log.id ? null : log.id)
                    }
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                      <div className="flex items-center gap-6">
                        <div
                          className={cn(
                            "h-12 w-12 rounded-2xl flex items-center justify-center border transition-all duration-500",
                            log.action.includes("PAYMENT")
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                              : log.action.includes("INVOICE")
                                ? "bg-finance-teal/10 border-finance-teal/20 text-finance-teal"
                                : "bg-zinc-800 border-white/10 text-zinc-400",
                          )}
                        >
                          <Activity className="h-6 w-6" />
                        </div>
                        <div className="space-y-1 text-white">
                          <div className="flex items-center gap-3">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[9px] font-black tracking-widest px-2 py-0.5",
                                getActionBadge(log.action),
                              )}
                            >
                              {log.action}
                            </Badge>
                            <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-tighter">
                              ID: {log.id.split("-")[0].toUpperCase()}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs font-mono text-zinc-500">
                            <span className="flex items-center gap-1.5">
                              <User className="h-3 w-3" /> {log.actor.fullName}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Calendar className="h-3 w-3" />{" "}
                              {new Date(log.createdAt).toLocaleString()}
                            </span>
                          </div>
                          {summary ? (
                            <div className="mt-3 rounded-2xl border border-white/5 bg-black/20 p-4">
                              <p className="font-mono text-xs font-black uppercase tracking-widest text-white">
                                {summary.title}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {summary.lines.map((line) => (
                                  <Badge
                                    key={line}
                                    variant="outline"
                                    className="border-white/10 text-[10px] text-zinc-300"
                                  >
                                    {line}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div
                        className={cn(
                          "px-4 py-2 rounded-xl bg-black/20 text-[10px] font-mono text-zinc-400 border border-white/5 transition-all duration-500",
                          selectedLog === log.id
                            ? "border-finance-teal/30 text-finance-teal"
                            : "group-hover:border-white/10 group-hover:text-zinc-300",
                        )}
                      >
                        REVIEW METADATA
                      </div>
                    </div>
                  </button>

                  <AnimatePresence>
                    {selectedLog === log.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-white/5 bg-black/40"
                      >
                        <div className="p-8 space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                              <div className="flex items-center gap-3 text-white">
                                <Hash className="h-4 w-4 text-finance-teal" />
                                <h5 className="text-sm font-black tracking-widest uppercase">
                                  Human Summary
                                </h5>
                              </div>
                              <Card className="rounded-2xl border-white/5 bg-white/2 p-5">
                                {summary ? (
                                  <div className="space-y-3">
                                    <p className="font-mono text-xs font-black uppercase tracking-widest text-white">
                                      {summary.title}
                                    </p>
                                    <div className="grid gap-2">
                                      {summary.lines.map((line) => (
                                        <div
                                          key={line}
                                          className="flex items-center justify-between rounded-xl border border-white/5 bg-black/20 px-3 py-2 text-xs"
                                        >
                                          <span className="text-zinc-500">
                                            Detail
                                          </span>
                                          <span className="text-right font-mono text-zinc-200">
                                            {line}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                    {settlementLines.length > 0 ? (
                                      <div className="space-y-2 border-t border-white/10 pt-3">
                                        <p className="font-mono text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                          Invoice Settlement
                                        </p>
                                        {settlementLines.map((line) => (
                                          <div
                                            key={line}
                                            className="rounded-xl bg-emerald-500/10 px-3 py-2 font-mono text-[11px] text-emerald-100"
                                          >
                                            {line}
                                          </div>
                                        ))}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : (
                                  <p className="text-sm text-zinc-500">
                                    Event ini belum punya parser ringkasan
                                    khusus. Raw payload tetap tersedia di bawah.
                                  </p>
                                )}
                              </Card>
                              <div className="flex items-center gap-3 text-white">
                                <Hash className="h-4 w-4 text-finance-teal" />
                                <h5 className="text-sm font-black tracking-widest uppercase">
                                  Raw Payload
                                </h5>
                              </div>
                              <div className="p-6 rounded-2xl bg-zinc-950/80 border border-white/5 font-mono text-[11px] leading-relaxed text-zinc-400 overflow-x-auto whitespace-pre">
                                {formatLogPayload(log.details)}
                              </div>
                            </div>
                            <div className="space-y-6">
                              <div className="flex items-center gap-3 text-white">
                                <Shield className="h-4 w-4 text-finance-teal" />
                                <h5 className="text-sm font-black tracking-widest uppercase">
                                  Security Verification
                                </h5>
                              </div>
                              <Card className="p-6 border-white/5 bg-white/2 rounded-2xl space-y-4">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
                                    Compliance Status
                                  </span>
                                  <Badge className="bg-emerald-500/10 text-emerald-400 border-none rounded-lg px-2 text-[9px] font-black">
                                    CERTIFIED
                                  </Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
                                    Origin Runtime
                                  </span>
                                  <span className="text-[10px] font-mono text-white">
                                    SERVER-SIDE-ACTION
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
                                    Audit Context
                                  </span>
                                  <span className="text-[10px] font-mono text-zinc-400 italic">
                                    Phase 5.0 Governance Active
                                  </span>
                                </div>
                              </Card>
                              <Button
                                variant="outline"
                                type="button"
                                onClick={() => downloadEvidence(log)}
                                className="w-full h-12 rounded-xl border-white/5 bg-white/5 text-zinc-400 hover:text-white gap-3 transition-all"
                              >
                                <FileJson className="h-4 w-4" /> EXPORT AS
                                EVIDENCE <ArrowRight className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            );
          })
        ) : (
          <div className="py-32 flex flex-col items-center justify-center text-zinc-700 bg-white/2 border border-white/5 rounded-[3rem]">
            <ClipboardList className="h-20 w-20 opacity-10 mb-8" />
            <div className="space-y-4 text-center max-w-sm">
              <p className="font-black text-3xl text-zinc-800 tracking-tighter">
                Clear Audit Trail
              </p>
              <p className="text-zinc-600 text-sm font-medium leading-relaxed">
                No financial events have been logged matching your current
                filters. All operations from generation to settlement are
                captured here automatically.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
