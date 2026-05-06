"use client";

import { isTauri } from "@/core/env";
import { apiGet, apiPatch, apiPost } from "@/lib/api/request";
import type {
  ApplyCreditToInvoicesInput,
  CreateBillingBatchInput,
  CreateFinancePeriodInput,
  ManualJournalAdjustmentInput,
  ProcessPaymentInput,
} from "@/lib/validations/finance";
import {
  applyCreditToInvoicesAction,
  approveFinanceRequestAction,
  bulkVoidInvoicesAction,
  createBatchInvoicesAction,
  createFinancePeriodAction,
  createManualJournalAdjustmentAction,
  getBatchStudentCandidatesAction,
  processPaymentAction,
  rejectFinanceRequestAction,
  updateFinancePeriodStatusAction,
  updateInvoiceStatusAction,
} from "./actions";
import {
  getBillingCategoriesAction,
  getFinanceAccountsAction,
} from "./queries";

type CreateBatchInvoicesActionInput = Omit<
  CreateBillingBatchInput,
  "studentIds" | "targetMode"
> & {
  targetMode?: "ALL_STUDENTS" | "SELECTED_STUDENTS";
  studentIds?: string[];
};

export function isDesktopFinanceMutationRuntime() {
  return isTauri();
}

export async function getBillingCategoriesRuntimeAction() {
  if (isDesktopFinanceMutationRuntime()) {
    return apiGet<{ id: string; name: string }[]>("/api/finance/categories");
  }

  return getBillingCategoriesAction();
}

export async function getFinanceAccountsRuntimeAction() {
  if (isDesktopFinanceMutationRuntime()) {
    return apiGet<{ id: string; code: string; name: string; type: string }[]>(
      "/api/finance/accounts",
    );
  }

  return getFinanceAccountsAction();
}

export async function getBatchStudentCandidatesRuntimeAction(input?: {
  query?: string;
  classId?: string;
  limit?: number;
  categoryId?: string;
  dueDate?: Date;
}) {
  const params = new URLSearchParams();
  if (input?.query) params.set("query", input.query);
  if (input?.classId) params.set("classId", input.classId);
  if (input?.limit) params.set("limit", String(input.limit));
  if (input?.categoryId) params.set("categoryId", input.categoryId);
  if (input?.dueDate) params.set("dueDate", input.dueDate.toISOString());

  if (isDesktopFinanceMutationRuntime()) {
    const queryString = params.toString();
    return apiGet<
      Array<{
        id: string;
        nis: string;
        nisn: string | null;
        fullName: string;
        grade: string;
        hasExistingInvoiceForPeriod: boolean;
      }>
    >(`/api/finance/batch-students${queryString ? `?${queryString}` : ""}`);
  }

  return getBatchStudentCandidatesAction(input);
}

export async function createBatchInvoicesRuntimeAction(
  actorId: string,
  input: CreateBatchInvoicesActionInput,
) {
  if (isDesktopFinanceMutationRuntime()) {
    return apiPost<{
      processed: number;
      skipped: number;
      skippedExisting?: number;
      skippedInvalid?: number;
    }>("/api/finance/batches", {
      ...input,
      targetMode: input.targetMode ?? "ALL_STUDENTS",
      studentIds:
        input.studentIds && input.studentIds.length > 0 ? input.studentIds : [],
    });
  }

  return createBatchInvoicesAction(actorId, input);
}

export async function updateInvoiceStatusRuntimeAction(
  actorId: string,
  invoiceId: string,
  status: "VOID" | "WRITEOFF" | "OPEN",
  reason = "Updated via dashboard",
) {
  if (isDesktopFinanceMutationRuntime()) {
    return apiPatch<{ success: boolean; status?: string }>(
      `/api/finance/invoices/${invoiceId}/status`,
      {
        actorId,
        status,
        reason,
      },
    );
  }

  return updateInvoiceStatusAction(actorId, invoiceId, status, reason);
}

export async function bulkVoidInvoicesRuntimeAction(
  actorId: string,
  input: { invoiceIds: string[]; reason: string },
) {
  if (isDesktopFinanceMutationRuntime()) {
    return apiPost<{
      processed: number;
      skippedPaid: number;
      skippedAlreadyFinal: number;
      skippedInvalid: number;
      approvalCreated: number;
    }>("/api/finance/invoices/bulk-status", {
      actorId,
      status: "VOID",
      invoiceIds: input.invoiceIds,
      reason: input.reason,
    });
  }

  return bulkVoidInvoicesAction(actorId, input);
}

export async function processPaymentRuntimeAction(
  actorId: string,
  input: ProcessPaymentInput,
) {
  if (isDesktopFinanceMutationRuntime()) {
    return apiPost<{
      paymentId: string;
      paymentNo: string;
      receiptNo: string;
      credit: number;
      duplicate?: boolean;
    }>("/api/finance/payments", {
      actorId,
      ...input,
    });
  }

  return processPaymentAction(actorId, input);
}

export async function applyCreditToInvoicesRuntimeAction(
  actorId: string,
  input: ApplyCreditToInvoicesInput,
) {
  if (isDesktopFinanceMutationRuntime()) {
    return apiPost<{
      creditReceiptNo: string;
      creditUsed: number;
      creditAfter: number;
      allocations: Array<{
        invoiceId: string;
        invoiceNo: string;
        amount: number;
      }>;
      duplicate?: boolean;
    }>("/api/finance/credits/apply", {
      actorId,
      ...input,
    });
  }

  return applyCreditToInvoicesAction(actorId, input);
}

export async function approveFinanceRequestRuntimeAction(
  actorId: string,
  requestId: string,
  reason?: string,
) {
  if (isDesktopFinanceMutationRuntime()) {
    return apiPost<{ success: true; status: "APPROVED" }>(
      `/api/finance/approvals/${requestId}/approve`,
      { actorId, reason },
    );
  }

  return approveFinanceRequestAction(actorId, requestId, reason);
}

export async function rejectFinanceRequestRuntimeAction(
  actorId: string,
  requestId: string,
  reason?: string,
) {
  if (isDesktopFinanceMutationRuntime()) {
    return apiPost<{ success: true; status: "REJECTED" }>(
      `/api/finance/approvals/${requestId}/reject`,
      { actorId, reason },
    );
  }

  return rejectFinanceRequestAction(actorId, requestId, reason);
}

export async function bulkDecideFinanceRequestsRuntimeAction(
  actorId: string,
  input: {
    requestIds: string[];
    decision: "approve" | "reject";
    reason: string;
  },
) {
  const uniqueRequestIds = Array.from(new Set(input.requestIds));
  const result = {
    processed: 0,
    skippedInvalid: 0,
  };

  for (const requestId of uniqueRequestIds) {
    try {
      if (input.decision === "approve") {
        await approveFinanceRequestRuntimeAction(
          actorId,
          requestId,
          input.reason,
        );
      } else {
        await rejectFinanceRequestRuntimeAction(
          actorId,
          requestId,
          input.reason,
        );
      }
      result.processed += 1;
    } catch {
      result.skippedInvalid += 1;
    }
  }

  return result;
}

export async function createFinancePeriodRuntimeAction(
  actorId: string,
  input: CreateFinancePeriodInput,
) {
  if (isDesktopFinanceMutationRuntime()) {
    return apiPost<{ id: string; name: string; status: "OPEN" }>(
      "/api/finance/periods",
      { actorId, ...input },
    );
  }

  return createFinancePeriodAction(actorId, input);
}

export async function updateFinancePeriodStatusRuntimeAction(
  actorId: string,
  periodId: string,
  status: "OPEN" | "SOFT_CLOSED" | "CLOSED",
  reason: string,
) {
  if (isDesktopFinanceMutationRuntime()) {
    return apiPatch<{
      success: true;
      periodId: string;
      previousStatus: string;
      nextStatus: string;
      noChange?: true;
    }>(`/api/finance/periods/${periodId}/status`, {
      actorId,
      status,
      reason,
    });
  }

  return updateFinancePeriodStatusAction(actorId, periodId, status, reason);
}

export async function createManualJournalAdjustmentRuntimeAction(
  actorId: string,
  input: ManualJournalAdjustmentInput,
) {
  if (isDesktopFinanceMutationRuntime()) {
    return apiPost<{ journalId: string; lineCount: number }>(
      "/api/finance/accounting/adjustments",
      { actorId, ...input },
    );
  }

  return createManualJournalAdjustmentAction(actorId, input);
}
