"use server";

import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/core/db/connection";
import { users } from "@/core/db/schema";
import { AccountingService } from "@/core/services/accounting-service";
import { FinanceService } from "@/core/services/finance-service";
import { auth } from "@/lib/auth/web/auth";
import { sanitizeClassDisplayName } from "@/lib/utils/class-name";
import {
  assertFinanceWebServerOnlyRuntime,
  FINANCE_VIEWER_ROLES,
} from "./runtime-policy";
import type {
  FinanceAccountView,
  FinanceAuditLogView,
  FinanceInvoiceListItemView,
  FinanceJournalEntryView,
  FinancePaymentMethodView,
  FinanceSummaryView,
} from "./types";

type RawJournalEntry = {
  id: string;
  date: Date;
  description: string;
  referenceId: string | null;
  referenceType: string | null;
  isAutoPost: boolean;
  lines: Array<{
    id: string;
    debit: number;
    credit: number;
    account: {
      code: string;
      name: string;
      type: string;
    };
  }>;
};

async function requireFinanceViewerAuthority() {
  assertFinanceWebServerOnlyRuntime();
  const session = await auth();
  const sessionUser = session?.user;

  if (!sessionUser?.id) {
    throw new Error("Sesi finance tidak valid. Silakan login ulang.");
  }

  const db = await getDb();
  const actorRows = await db
    .select({
      id: users.id,
      role: users.role,
      isActive: users.isActive,
    })
    .from(users)
    .where(and(eq(users.id, sessionUser.id), isNull(users.deletedAt)))
    .limit(1);

  const actor = actorRows[0];
  if (!actor?.isActive) {
    throw new Error("Akses ditolak. Akun finance tidak aktif.");
  }

  if (!FINANCE_VIEWER_ROLES.includes(actor.role)) {
    throw new Error("Akses ditolak. Role Anda tidak memiliki akses finance.");
  }

  return actor;
}

export async function getFinanceDashboardSummary() {
  try {
    await requireFinanceViewerAuthority();
    return await FinanceService.getDashboardSummary();
  } catch (error) {
    console.error(
      "[FINANCE_QUERY] Failed to generate dashboard summary:",
      error,
    );
    return {
      revenue: 0,
      receivables: 0,
      collectionRate: 0,
      invoiceCount: 0,
      paymentCount: 0,
      activePeriodLabel: null,
      activePeriodStatus: null,
      revenueTrend: [],
      dataState: "seeded",
      pendingSync: false,
    } satisfies FinanceSummaryView;
  }
}

export async function getBillingCategoriesAction(): Promise<
  { id: string; name: string }[]
> {
  try {
    await requireFinanceViewerAuthority();
    const categories = await FinanceService.getBillingCategories();
    return categories.map((category) => ({
      id: category.id,
      name: category.name,
    }));
  } catch (error) {
    console.error("[FINANCE_QUERY] Failed to fetch categories:", error);
    return [];
  }
}

export async function getPaymentMethodsAction(): Promise<
  FinancePaymentMethodView[]
> {
  try {
    await requireFinanceViewerAuthority();
    const methods = await FinanceService.getPaymentMethods();
    return methods.map((method) => ({
      id: method.id,
      code: method.code,
      name: method.name,
      isElectronic: method.isElectronic,
    }));
  } catch (error) {
    console.error("[FINANCE_QUERY] Failed to fetch methods:", error);
    return [];
  }
}

export async function getFinancePeriodsAction() {
  try {
    await requireFinanceViewerAuthority();
    return await FinanceService.getPeriods();
  } catch (error) {
    console.error("[FINANCE_QUERY] Failed to fetch periods:", error);
    return [];
  }
}

export async function getApprovalRequestsAction() {
  try {
    await requireFinanceViewerAuthority();
    return await FinanceService.getApprovalRequests();
  } catch (error) {
    console.error("[FINANCE_QUERY] Failed to fetch approvals:", error);
    return [];
  }
}

export async function getFinanceLogsAction(): Promise<FinanceAuditLogView[]> {
  try {
    await requireFinanceViewerAuthority();
    const logs = await FinanceService.getLogs();
    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      actor: {
        fullName: log.actor?.fullName ?? "SYSTEM",
      },
      details: log.newData ?? log.oldData ?? null,
      createdAt: log.createdAt,
    }));
  } catch (error) {
    console.error("[FINANCE_QUERY] Failed to fetch logs:", error);
    return [];
  }
}

export async function getInvoices(filters: {
  status?: string;
  search?: string;
}): Promise<FinanceInvoiceListItemView[]> {
  try {
    await requireFinanceViewerAuthority();
    const invoices = await FinanceService.getInvoices(filters);
    const normalizedSearch = filters.search?.trim().toLowerCase() || "";
    const today = new Date();

    const invoiceViews = invoices.map((invoice) => {
      const dueDate =
        invoice.dueDate instanceof Date
          ? invoice.dueDate
          : new Date(invoice.dueDate);
      const isOutstanding =
        (invoice.status === "OPEN" || invoice.status === "PARTIAL") &&
        invoice.outstanding > 0;
      const effectiveStatus =
        isOutstanding && dueDate.getTime() < today.getTime()
          ? "OVERDUE"
          : invoice.status;

      return {
        id: invoice.id,
        invoiceNo: invoice.invoiceNo,
        studentId: invoice.studentId,
        status: effectiveStatus,
        baseStatus: invoice.status,
        totalAmount: invoice.totalAmount,
        outstanding: invoice.outstanding,
        dueDate: invoice.dueDate,
        studentSnapshot: invoice.studentSnapshot ?? null,
        studentName: invoice.studentFullName ?? null,
        studentNis: invoice.studentNis ?? null,
        studentNisn: invoice.studentNisn ?? null,
        studentClassName: sanitizeClassDisplayName(
          invoice.studentClassName,
          invoice.studentGrade,
        ),
        studentCreditBalance: invoice.studentCreditBalance ?? 0,
      } satisfies FinanceInvoiceListItemView;
    });

    if (!normalizedSearch) {
      return invoiceViews;
    }

    return invoiceViews.filter((invoice) => {
      const snapshot = invoice.studentSnapshot
        ? (() => {
            try {
              return JSON.parse(invoice.studentSnapshot) as {
                fullName?: string;
                nis?: string;
                nisn?: string;
                className?: string;
                grade?: string;
              };
            } catch {
              return null;
            }
          })()
        : null;

      const studentName = (
        invoice.studentName ||
        snapshot?.fullName ||
        ""
      ).toLowerCase();
      const studentNis = (
        invoice.studentNis ||
        snapshot?.nis ||
        ""
      ).toLowerCase();
      const studentNisn = (
        invoice.studentNisn ||
        snapshot?.nisn ||
        ""
      ).toLowerCase();
      const studentClassName = (
        invoice.studentClassName ||
        snapshot?.className ||
        snapshot?.grade ||
        ""
      ).toLowerCase();

      return (
        invoice.invoiceNo.toLowerCase().includes(normalizedSearch) ||
        studentName.includes(normalizedSearch) ||
        studentNis.includes(normalizedSearch) ||
        studentNisn.includes(normalizedSearch) ||
        studentClassName.includes(normalizedSearch)
      );
    });
  } catch (error) {
    console.error("[FINANCE_QUERY] Failed to fetch invoices:", error);
    return [];
  }
}

export async function getJournalEntriesAction(): Promise<
  FinanceJournalEntryView[]
> {
  try {
    await requireFinanceViewerAuthority();
    const db = await getDb();
    const entries = (await AccountingService.getJournalEntries(
      db,
    )) as RawJournalEntry[];
    return entries.map((entry) => ({
      id: entry.id,
      date: entry.date,
      description: entry.description,
      referenceId: entry.referenceId ?? null,
      referenceType: entry.referenceType ?? null,
      isAutoPost: entry.isAutoPost,
      lines: entry.lines.map((line) => ({
        id: line.id,
        debit: line.debit,
        credit: line.credit,
        account: {
          code: line.account.code,
          name: line.account.name,
          type: line.account.type,
        },
      })),
    }));
  } catch (error) {
    console.error("[FINANCE_QUERY] Failed to fetch journals:", error);
    return [];
  }
}

export async function getFinanceAccountsAction(): Promise<
  FinanceAccountView[]
> {
  try {
    await requireFinanceViewerAuthority();
    const db = await getDb();
    const accounts = await AccountingService.getAccounts(db);
    return accounts.map((account) => ({
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
    }));
  } catch (error) {
    console.error("[FINANCE_QUERY] Failed to fetch accounts:", error);
    return [];
  }
}
