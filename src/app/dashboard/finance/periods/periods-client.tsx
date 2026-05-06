"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  CheckCheck,
  ChevronRight,
  History,
  Lock,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Unlock,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  approveFinanceRequestRuntimeAction,
  bulkDecideFinanceRequestsRuntimeAction,
  rejectFinanceRequestRuntimeAction,
  updateFinancePeriodStatusRuntimeAction,
} from "@/app/dashboard/finance/client-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { cn, formatCurrency } from "@/lib/utils";
import { CreatePeriodDialog } from "./create-period-dialog";

interface Period {
  id: string;
  name: string;
  startDate: string | Date;
  endDate: string | Date;
  status: "OPEN" | "SOFT_CLOSED" | "CLOSED";
}

interface ApprovalRequest {
  id: string;
  type: string;
  targetId: string;
  targetType: string;
  status: string;
  requestedBy: {
    fullName: string;
  };
  createdAt: string | Date;
  payload?: string;
}

function parseApprovalPayload(payload?: string) {
  if (!payload) {
    return { reason: null, amount: 0, invoiceNo: null, requestedStatus: null };
  }

  try {
    const parsed = JSON.parse(payload) as {
      reason?: string;
      amount?: number;
      outstanding?: number;
      invoiceNo?: string;
      requestedStatus?: string;
    };

    return {
      reason: parsed.reason ?? null,
      amount: parsed.amount ?? parsed.outstanding ?? 0,
      invoiceNo: parsed.invoiceNo ?? null,
      requestedStatus: parsed.requestedStatus ?? null,
    };
  } catch {
    return { reason: null, amount: 0, invoiceNo: null, requestedStatus: null };
  }
}

export function PeriodsClient({
  initialPeriods,
  initialApprovals,
}: {
  initialPeriods: Period[];
  initialApprovals: ApprovalRequest[];
}) {
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(
    initialPeriods[0]?.id || null,
  );
  const [isPending, startTransition] = useTransition();
  const [selectedApprovalIds, setSelectedApprovalIds] = useState<string[]>([]);
  const router = useRouter();
  const { user } = useAuth();
  const canManageApprovals =
    user?.role === "admin" || user?.role === "super_admin";
  const canManagePeriods = canManageApprovals;
  const pendingApprovals = initialApprovals.filter(
    (request) => request.status === "PENDING",
  );
  const selectedPendingApprovals = pendingApprovals.filter((request) =>
    selectedApprovalIds.includes(request.id),
  );
  const allPendingSelected =
    pendingApprovals.length > 0 &&
    pendingApprovals.every((request) =>
      selectedApprovalIds.includes(request.id),
    );

  const toggleApprovalSelection = (requestId: string) => {
    setSelectedApprovalIds((current) =>
      current.includes(requestId)
        ? current.filter((id) => id !== requestId)
        : [...current, requestId],
    );
  };

  const toggleAllPendingApprovals = () => {
    setSelectedApprovalIds((current) => {
      if (allPendingSelected) {
        return current.filter(
          (id) => !pendingApprovals.some((request) => request.id === id),
        );
      }

      return Array.from(
        new Set([...current, ...pendingApprovals.map((request) => request.id)]),
      );
    });
  };

  const requestReason = (label: string) => {
    const value = window.prompt(`Masukkan alasan untuk ${label}:`, "");
    if (!value || value.trim().length < 5) {
      toast.error("Alasan minimal 5 karakter.");
      return null;
    }

    return value.trim();
  };

  const handleApprovalDecision = (
    requestId: string,
    action: "approve" | "reject",
  ) => {
    if (!canManageApprovals) {
      toast.info("Approval hanya tersedia untuk admin finance.");
      return;
    }
    if (!user?.id) {
      toast.error("Sesi pengguna tidak ditemukan. Silakan login ulang.");
      return;
    }

    const reason = requestReason(
      action === "approve" ? "approve request" : "reject request",
    );
    if (!reason) {
      return;
    }

    startTransition(async () => {
      try {
        if (action === "approve") {
          await approveFinanceRequestRuntimeAction(user.id, requestId, reason);
          toast.success("Approval request berhasil disetujui.");
        } else {
          await rejectFinanceRequestRuntimeAction(user.id, requestId, reason);
          toast.success("Approval request berhasil ditolak.");
        }

        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Gagal memproses approval request",
        );
      }
    });
  };

  const handleBulkApprovalDecision = (decision: "approve" | "reject") => {
    if (!canManageApprovals) {
      toast.info("Approval hanya tersedia untuk admin finance.");
      return;
    }
    if (!user?.id) {
      toast.error("Sesi pengguna tidak ditemukan. Silakan login ulang.");
      return;
    }
    if (selectedPendingApprovals.length === 0) {
      toast.info("Pilih minimal 1 approval request PENDING.");
      return;
    }

    const reason = requestReason(
      decision === "approve" ? "bulk approve requests" : "bulk reject requests",
    );
    if (!reason) {
      return;
    }

    startTransition(async () => {
      try {
        const result = await bulkDecideFinanceRequestsRuntimeAction(user.id, {
          requestIds: selectedPendingApprovals.map((request) => request.id),
          decision,
          reason,
        });

        toast.success(
          `${decision === "approve" ? "Approved" : "Rejected"} ${result.processed} request, skipped ${result.skippedInvalid}.`,
        );
        setSelectedApprovalIds([]);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Gagal memproses bulk approval request",
        );
      }
    });
  };

  const handlePeriodTransition = (
    periodId: string,
    nextStatus: "OPEN" | "SOFT_CLOSED" | "CLOSED",
    label: string,
  ) => {
    if (!canManagePeriods) {
      toast.info("Pengelolaan periode hanya tersedia untuk admin finance.");
      return;
    }

    if (!user?.id) {
      toast.error("Sesi pengguna tidak ditemukan. Silakan login ulang.");
      return;
    }

    const reason = requestReason(label);
    if (!reason) {
      return;
    }

    startTransition(async () => {
      try {
        await updateFinancePeriodStatusRuntimeAction(
          user.id,
          periodId,
          nextStatus,
          reason,
        );
        toast.success(`Periode berhasil diubah ke status ${nextStatus}.`);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Gagal memperbarui status periode",
        );
      }
    });
  };

  return (
    <div className="space-y-8 pb-20">
      {!canManagePeriods ? (
        <Card className="border-amber-500/20 bg-amber-500/10 p-5 text-amber-50 backdrop-blur-xl">
          <div className="space-y-1.5">
            <h3 className="text-sm font-bold uppercase tracking-widest text-amber-100">
              Governance Admin-Only
            </h3>
            <p className="text-sm text-amber-100/90">
              Runtime desktop sekarang sudah mendukung approval dan period
              control, tetapi hanya untuk admin finance atau super admin.
            </p>
          </div>
        </Card>
      ) : null}

      <div className="flex items-center justify-between bg-zinc-950/50 p-6 rounded-3xl border border-white/5 backdrop-blur-xl shadow-2xl shadow-black/50">
        <div className="flex items-center gap-4 text-white">
          <div className="h-12 w-12 rounded-2xl bg-finance-teal/20 flex items-center justify-center text-finance-teal">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              Finance Control Center
            </h2>
            <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">
              Governance & Period Management
            </p>
          </div>
        </div>
        {canManagePeriods && user?.id ? (
          <CreatePeriodDialog actorId={user.id}>
            <Button className="bg-finance-teal hover:bg-finance-teal/90 rounded-xl font-black">
              <Plus className="h-4 w-4 mr-2" />
              NEW PERIOD
            </Button>
          </CreatePeriodDialog>
        ) : (
          <Button
            className="bg-finance-teal hover:bg-finance-teal/90 rounded-xl font-black"
            disabled
          >
            <Plus className="h-4 w-4 mr-2" />
            NEW PERIOD
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between text-white">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <History className="h-5 w-5 text-zinc-400" />
              Fiscal Timeline
            </h3>
            <div className="flex gap-2">
              <Badge
                variant="outline"
                className="border-white/5 text-zinc-500 font-mono"
              >
                2026
              </Badge>
              <Badge
                variant="outline"
                className="border-white/5 text-zinc-500 font-mono"
              >
                Q2
              </Badge>
            </div>
          </div>

          <div className="space-y-4">
            {initialPeriods.length > 0 ? (
              initialPeriods.map((period, idx) => (
                <motion.div
                  key={period.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <Card
                    className={cn(
                      "group p-6 transition-all duration-500 border-white/5 relative overflow-hidden rounded-3xl",
                      selectedPeriod === period.id
                        ? "bg-white/10 ring-1 ring-white/20 shadow-2xl"
                        : "bg-white/5 hover:bg-white/8",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className="flex flex-col items-center">
                          <div
                            className={cn(
                              "h-3 w-3 rounded-full mb-2",
                              period.status === "OPEN"
                                ? "bg-emerald-400 animate-pulse ring-4 ring-emerald-400/20"
                                : period.status === "SOFT_CLOSED"
                                  ? "bg-amber-400"
                                  : "bg-zinc-600",
                            )}
                          />
                          <div className="w-0.5 h-12 bg-white/5" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-xl font-bold text-white">
                            {period.name}
                          </h4>
                          <p className="text-xs font-mono text-zinc-500">
                            {period.status === "OPEN"
                              ? "ACTIVE PERIOD"
                              : "HISTORICAL"}{" "}
                            • {new Date(period.startDate).toLocaleDateString()}{" "}
                            → {new Date(period.endDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <Badge
                            variant={
                              period.status === "OPEN"
                                ? "success"
                                : period.status === "SOFT_CLOSED"
                                  ? "warning"
                                  : "outline"
                            }
                            className="rounded-lg tracking-wider font-black px-3 py-1"
                          >
                            {period.status}
                          </Badge>
                          <p className="mt-1 text-[10px] font-mono text-zinc-500 uppercase tracking-tighter">
                            Current Lifecycle
                          </p>
                        </div>
                        <button
                          type="button"
                          className={cn(
                            "h-12 w-12 flex items-center justify-center rounded-2xl transition-all duration-300 outline-none",
                            selectedPeriod === period.id
                              ? "bg-white/10 text-white rotate-90"
                              : "bg-white/5 text-zinc-600 hover:text-zinc-400",
                          )}
                          onClick={() =>
                            setSelectedPeriod(
                              selectedPeriod === period.id ? null : period.id,
                            )
                          }
                        >
                          <ChevronRight className="h-6 w-6" />
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {selectedPeriod === period.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden mt-6 pt-6 border-t border-white/5 grid grid-cols-1 md:grid-cols-3 gap-6"
                        >
                          <div className="col-span-1 p-5 rounded-2xl bg-zinc-950/50 space-y-4">
                            <p className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-[0.2em]">
                              State Control
                            </p>
                            <div className="flex items-center gap-3">
                              <Button
                                size="sm"
                                variant={
                                  period.status === "OPEN"
                                    ? "default"
                                    : "outline"
                                }
                                className="h-10 rounded-xl flex-1 font-bold"
                                disabled={isPending || !canManagePeriods}
                                onClick={() =>
                                  handlePeriodTransition(
                                    period.id,
                                    "SOFT_CLOSED",
                                    "soft close period",
                                  )
                                }
                              >
                                <Lock className="h-4 w-4 mr-2" /> SOFT CLOSE
                              </Button>
                              <Button
                                size="sm"
                                variant={
                                  period.status !== "OPEN"
                                    ? "default"
                                    : "outline"
                                }
                                className="h-10 rounded-xl flex-1 font-bold"
                                disabled={
                                  isPending ||
                                  !canManagePeriods ||
                                  period.status === "CLOSED"
                                }
                                onClick={() =>
                                  handlePeriodTransition(
                                    period.id,
                                    "OPEN",
                                    "reopen period",
                                  )
                                }
                              >
                                <Unlock className="h-4 w-4 mr-2" /> REOPEN
                              </Button>
                            </div>
                            {period.status === "SOFT_CLOSED" ? (
                              <Button
                                size="sm"
                                className="h-10 w-full rounded-xl font-bold bg-rose-500 hover:bg-rose-600"
                                disabled={isPending || !canManagePeriods}
                                onClick={() =>
                                  handlePeriodTransition(
                                    period.id,
                                    "CLOSED",
                                    "final close period",
                                  )
                                }
                              >
                                FINAL CLOSE
                              </Button>
                            ) : null}
                          </div>
                          <div className="col-span-2 p-5 rounded-2xl bg-zinc-950/50 flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="space-y-2">
                              <p className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest text-center md:text-left">
                                Policy Governance
                              </p>
                              <div className="flex items-center gap-4">
                                <div className="text-white">
                                  <p className="text-xl font-bold tracking-tighter">
                                    Compliant
                                  </p>
                                  <p className="text-[10px] font-mono text-emerald-400/70 uppercase">
                                    Audit readiness: 100%
                                  </p>
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              className="w-full md:w-auto h-12 rounded-xl border-white/5 bg-white/2 hover:bg-white/5 text-zinc-300 font-bold gap-3"
                            >
                              ANALYZE JOURNAL <ArrowRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              ))
            ) : (
              <div className="py-20 text-center text-zinc-500 font-mono uppercase tracking-widest bg-white/2 border border-white/5 border-dashed rounded-3xl">
                No financial periods initialized
              </div>
            )}
          </div>
        </div>

        <div id="approval-gate" className="scroll-mt-28 space-y-8">
          <div className="flex items-center justify-between text-white">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-rose-400" />
              Approval Gate
            </h3>
            <div className="flex items-center gap-2">
              <span className="h-7 w-7 rounded-full bg-rose-500/20 text-rose-400 text-xs flex items-center justify-center font-black ring-1 ring-rose-500/30">
                {pendingApprovals.length}
              </span>
              <input
                type="checkbox"
                aria-label="Select all pending approval requests"
                checked={allPendingSelected}
                disabled={pendingApprovals.length === 0 || !canManageApprovals}
                onChange={toggleAllPendingApprovals}
                className="h-4 w-4 rounded border-white/20 bg-white/10 accent-finance-teal disabled:opacity-30"
              />
            </div>
          </div>

          {selectedPendingApprovals.length > 0 ? (
            <Card className="space-y-4 rounded-[2rem] border-finance-teal/20 bg-finance-teal/10 p-5 text-white backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-finance-teal">
                    Bulk Approval
                  </p>
                  <p className="text-sm text-zinc-300">
                    {selectedPendingApprovals.length} pending request selected
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-xl text-zinc-400 hover:bg-white/5 hover:text-white"
                  onClick={() => setSelectedApprovalIds([])}
                >
                  Clear
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  disabled={isPending || !canManageApprovals}
                  onClick={() => handleBulkApprovalDecision("approve")}
                  className="h-11 rounded-2xl bg-emerald-500 text-xs font-black uppercase tracking-widest hover:bg-emerald-600"
                >
                  <CheckCheck className="mr-2 h-4 w-4" />
                  Approve Selected
                </Button>
                <Button
                  disabled={isPending || !canManageApprovals}
                  onClick={() => handleBulkApprovalDecision("reject")}
                  variant="outline"
                  className="h-11 rounded-2xl border-white/10 bg-transparent text-xs font-black uppercase tracking-widest text-zinc-300 hover:text-white"
                >
                  Reject Selected
                </Button>
              </div>
            </Card>
          ) : null}

          <div className="space-y-4">
            {initialApprovals.length > 0 ? (
              initialApprovals.map((req) => {
                const payload = parseApprovalPayload(req.payload);
                const isPendingApproval = req.status === "PENDING";
                const isSelected = selectedApprovalIds.includes(req.id);

                return (
                  <Card
                    key={req.id}
                    className={cn(
                      "p-6 border-white/5 bg-white/5 backdrop-blur-xl relative overflow-hidden group rounded-[2.5rem] shadow-2xl shadow-rose-950/20",
                      isSelected && "border-finance-teal/40 bg-finance-teal/10",
                    )}
                  >
                    <div className="absolute top-0 right-0 p-4">
                      <Badge className="bg-rose-500 text-white border-none rounded-lg font-black tracking-widest py-1 px-3 shadow-lg shadow-rose-500/20">
                        {req.type}
                      </Badge>
                    </div>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            aria-label={`Select approval request ${req.id}`}
                            checked={isSelected}
                            disabled={!isPendingApproval || !canManageApprovals}
                            onChange={() => toggleApprovalSelection(req.id)}
                            className="h-4 w-4 rounded border-white/20 bg-white/10 accent-finance-teal disabled:opacity-30"
                          />
                          <div className="h-8 w-8 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-[10px] font-black text-rose-400">
                            {req.requestedBy.fullName.charAt(0)}
                          </div>
                          <p className="text-sm font-bold text-white leading-tight">
                            {req.requestedBy.fullName}
                          </p>
                        </div>
                        <p className="text-xs text-zinc-500 italic mt-2 leading-relaxed">
                          {payload.reason ||
                            `Approval diperlukan untuk ${payload.requestedStatus ?? req.type} pada ${payload.invoiceNo ?? req.targetType}.`}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-[10px] font-mono border-t border-white/5 pt-4">
                        <div>
                          <p className="text-zinc-600 uppercase tracking-widest mb-1">
                            Impact
                          </p>
                          <p className="text-white font-black">
                            -{formatCurrency(payload.amount)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-zinc-600 uppercase tracking-widest mb-1">
                            Created
                          </p>
                          <p className="text-white lowercase">
                            {new Date(req.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Button
                          disabled={isPending || !canManageApprovals}
                          onClick={() =>
                            handleApprovalDecision(req.id, "approve")
                          }
                          className="flex-1 bg-emerald-500 hover:bg-emerald-600 h-12 text-xs font-black rounded-2xl uppercase tracking-widest"
                        >
                          APPROVE
                        </Button>
                        <Button
                          disabled={isPending || !canManageApprovals}
                          onClick={() =>
                            handleApprovalDecision(req.id, "reject")
                          }
                          variant="outline"
                          className="flex-1 border-white/10 bg-transparent h-12 text-xs font-black rounded-2xl uppercase tracking-widest text-zinc-400 hover:text-white"
                        >
                          REJECT
                        </Button>
                      </div>
                      {!canManageApprovals && (
                        <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                          Approval hanya tersedia untuk admin finance.
                        </p>
                      )}
                    </div>
                  </Card>
                );
              })
            ) : (
              <div className="p-12 rounded-[2.5rem] bg-zinc-950/50 border border-white/5 border-dashed flex flex-col items-center justify-center gap-4 text-zinc-600">
                <BadgeCheck className="h-10 w-10 opacity-10" />
                <p className="text-xs font-bold font-mono uppercase tracking-[0.2em] text-zinc-500">
                  Gate Secured
                </p>
              </div>
            )}
          </div>

          <Card className="p-8 border-white/5 bg-zinc-950/80 rounded-[2.5rem] shadow-2xl space-y-6">
            <h4 className="text-[10px] font-mono font-black uppercase text-zinc-500 tracking-[0.3em]">
              Live Governance Feed
            </h4>
            <div className="space-y-6 relative">
              <div className="absolute left-[3px] top-1 bottom-1 w-px bg-white/5" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4 text-[10px] relative z-10">
                  <div className="h-1.5 w-1.5 rounded-full bg-finance-teal mt-1 shrink-0 shadow-lg shadow-finance-teal/50" />
                  <div className="space-y-1">
                    <p className="text-white font-bold">
                      Ledger Revaluation{" "}
                      <span className="text-zinc-600 font-mono">
                        #{293 + i}
                      </span>{" "}
                      detected
                    </p>
                    <p className="text-zinc-500 font-mono tracking-tighter uppercase">
                      {i * 12} minutes ago • ADMIN-SEC-01
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              className="w-full h-12 border border-white/5 bg-white/2 text-zinc-500 hover:text-finance-teal rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] transition-all"
            >
              VIEW MASTER AUDIT LOG
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
