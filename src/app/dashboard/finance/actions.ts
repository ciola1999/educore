"use server";

import { and, eq, isNull, like, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { AuthRole } from "@/core/auth/roles";
import { getDb } from "@/core/db/connection";
import { classes, creditBalances, students, users } from "@/core/db/schema";
import { AccountingService } from "@/core/services/accounting-service";
import { FinanceControlService } from "@/core/services/finance-control-service";
import { FinanceService } from "@/core/services/finance-service";
import { auth } from "@/lib/auth/web/auth";
import { sanitizeClassDisplayName } from "@/lib/utils/class-name";
import type {
  ApplyCreditToInvoicesInput,
  CreateBillingBatchInput,
  CreateFinancePeriodInput,
  ManualJournalAdjustmentInput,
  ProcessPaymentInput,
} from "@/lib/validations/finance";
import { assertFinanceWebServerOnlyRuntime } from "./runtime-policy";

type CreateBatchInvoicesActionInput = Omit<
  CreateBillingBatchInput,
  "studentIds" | "targetMode"
> & {
  targetMode?: "ALL_STUDENTS" | "SELECTED_STUDENTS";
  studentIds?: string[];
};

const FINANCE_APPROVER_ROLES: AuthRole[] = ["super_admin", "admin"];
const FINANCE_OPERATOR_ROLES: AuthRole[] = ["super_admin", "admin", "staff"];

function revalidateFinancePath(path: string) {
  try {
    revalidatePath(path);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("static generation store missing")
    ) {
      console.warn(
        `[FINANCE_ACTION] Skipping revalidatePath outside Next.js request context for ${path}.`,
      );
      return;
    }

    throw error;
  }
}

async function resolveFinanceActorById(actorId: string) {
  const db = await getDb();
  const actorRows = await db
    .select({
      id: users.id,
      role: users.role,
      isActive: users.isActive,
    })
    .from(users)
    .where(and(eq(users.id, actorId), isNull(users.deletedAt)))
    .limit(1);

  const actor = actorRows[0];
  if (!actor?.isActive) {
    throw new Error("Akses ditolak. Akun finance tidak aktif.");
  }

  return actor;
}

async function resolveSessionFinanceActor() {
  assertFinanceWebServerOnlyRuntime();
  const session = await auth();
  const sessionUser = session?.user;

  if (!sessionUser?.id) {
    throw new Error("Sesi finance tidak valid. Silakan login ulang.");
  }

  return await resolveFinanceActorById(sessionUser.id);
}

async function requireFinanceSessionActorMatch(actorId: string) {
  const actor = await resolveSessionFinanceActor();

  if (actor.id !== actorId) {
    throw new Error(
      "Akses ditolak. Aktor finance tidak cocok dengan sesi aktif.",
    );
  }

  return actor;
}

async function requireFinanceApprovalAuthority(actorId?: string) {
  const actor = actorId
    ? await requireFinanceSessionActorMatch(actorId)
    : await resolveSessionFinanceActor();

  if (!FINANCE_APPROVER_ROLES.includes(actor.role)) {
    throw new Error(
      "Akses ditolak. Hanya admin finance yang boleh memproses approval request.",
    );
  }

  return actor;
}

async function requireFinanceOperatorAuthority(actorId?: string) {
  const actor = actorId
    ? await requireFinanceSessionActorMatch(actorId)
    : await resolveSessionFinanceActor();

  if (!FINANCE_OPERATOR_ROLES.includes(actor.role)) {
    throw new Error(
      "Akses ditolak. Hanya operator finance yang boleh memproses pembayaran.",
    );
  }

  return actor;
}

export async function createBatchInvoicesAction(
  actorId: string,
  input: CreateBatchInvoicesActionInput,
) {
  try {
    const actor = await requireFinanceOperatorAuthority(actorId);
    const result = await FinanceService.createBatchInvoices(actor.id, {
      ...input,
      targetMode: input.targetMode ?? "ALL_STUDENTS",
      studentIds: input.studentIds ?? [],
    } satisfies CreateBillingBatchInput);
    revalidateFinancePath("/dashboard/finance/invoices");
    return result;
  } catch (error) {
    console.error("[FINANCE_ACTION] Batch generation failed:", error);
    throw error;
  }
}

export async function getBatchStudentCandidatesAction(input?: {
  query?: string;
  classId?: string;
  limit?: number;
  categoryId?: string;
  dueDate?: Date;
}) {
  try {
    await requireFinanceOperatorAuthority();
    return await FinanceService.getBatchStudentCandidates(input);
  } catch (error) {
    console.error("[FINANCE_ACTION] Failed to fetch batch students:", error);
    return [];
  }
}

export async function updateInvoiceStatusAction(
  actorId: string,
  invoiceId: string,
  status: "VOID" | "WRITEOFF" | "OPEN",
  _reason: string = "Updated via dashboard",
) {
  try {
    const actor =
      status === "OPEN"
        ? await requireFinanceOperatorAuthority(actorId)
        : await requireFinanceApprovalAuthority(actorId);

    const result = await FinanceService.updateInvoiceStatus(
      actor.id,
      invoiceId,
      status,
    );
    revalidateFinancePath("/dashboard/finance/invoices");
    return result;
  } catch (error) {
    console.error("[FINANCE_ACTION] Update invoice status failed:", error);
    throw error;
  }
}

export async function bulkVoidInvoicesAction(
  actorId: string,
  input: { invoiceIds: string[]; reason: string },
) {
  try {
    const actor = await requireFinanceApprovalAuthority(actorId);
    const result = await FinanceService.bulkUpdateInvoiceStatus(actor.id, {
      invoiceIds: input.invoiceIds,
      status: "VOID",
      reason: input.reason,
    });
    revalidateFinancePath("/dashboard/finance/invoices");
    return result;
  } catch (error) {
    console.error("[FINANCE_ACTION] Bulk void invoices failed:", error);
    throw error;
  }
}

export async function processPaymentAction(
  userId: string,
  input: ProcessPaymentInput,
) {
  try {
    const actor = await requireFinanceOperatorAuthority(userId);
    const result = await FinanceService.processPayment(actor.id, input);
    revalidateFinancePath("/dashboard/finance/payments");
    revalidateFinancePath("/dashboard/finance/invoices");
    revalidateFinancePath("/dashboard/finance");
    return result;
  } catch (error) {
    console.error("[FINANCE_ACTION] Payment processing failed:", error);
    throw error;
  }
}

export async function applyCreditToInvoicesAction(
  userId: string,
  input: ApplyCreditToInvoicesInput,
) {
  try {
    const actor = await requireFinanceOperatorAuthority(userId);
    const result = await FinanceService.applyCreditToInvoices(actor.id, input);
    revalidateFinancePath("/dashboard/finance/payments");
    revalidateFinancePath("/dashboard/finance/invoices");
    revalidateFinancePath("/dashboard/finance");
    revalidateFinancePath("/dashboard/finance/audit");
    return result;
  } catch (error) {
    console.error("[FINANCE_ACTION] Apply credit failed:", error);
    throw error;
  }
}

export async function searchStudentsAction(query: string) {
  try {
    await requireFinanceOperatorAuthority();
    const db = await getDb();
    const result = await db
      .select({
        id: students.id,
        nis: students.nis,
        fullName: students.fullName,
        grade: students.grade,
        className: classes.name,
        creditBalance: creditBalances.amount,
      })
      .from(students)
      .leftJoin(
        classes,
        and(eq(classes.id, students.grade), isNull(classes.deletedAt)),
      )
      .leftJoin(
        creditBalances,
        and(
          eq(creditBalances.studentId, students.id),
          isNull(creditBalances.deletedAt),
        ),
      )
      .where(
        and(
          isNull(students.deletedAt),
          or(
            like(students.fullName, `%${query}%`),
            like(students.nis, `%${query}%`),
            like(students.nisn, `%${query}%`),
            like(students.grade, `%${query}%`),
            like(classes.name, `%${query}%`),
          ),
        ),
      )
      .limit(100);

    return result.map((student) => ({
      id: student.id,
      nis: student.nis,
      fullName: student.fullName,
      grade: sanitizeClassDisplayName(student.className, student.grade),
      creditBalance: student.creditBalance ?? 0,
    }));
  } catch (error) {
    console.error("[FINANCE_ACTION] Failed to search students:", error);
    return [];
  }
}

export async function getStudentInvoicesAction(studentId: string) {
  try {
    await requireFinanceOperatorAuthority();
    return await FinanceService.getInvoices({ studentId, status: "OPEN" });
  } catch (error) {
    console.error("[FINANCE_ACTION] Failed to fetch invoices:", error);
    return [];
  }
}

export async function getStudentsWithOutstandingInvoicesAction() {
  try {
    await requireFinanceOperatorAuthority();
    return await FinanceService.getStudentsWithOutstandingInvoices(250);
  } catch (error) {
    console.error(
      "[FINANCE_ACTION] Failed to fetch students with outstanding invoices:",
      error,
    );
    return [];
  }
}

export async function approveFinanceRequestAction(
  actorId: string,
  requestId: string,
  reason?: string,
) {
  try {
    const actor = await requireFinanceApprovalAuthority(actorId);
    const result = await FinanceControlService.approveRequest(
      actor.id,
      requestId,
      reason,
    );
    revalidateFinancePath("/dashboard/finance/periods");
    revalidateFinancePath("/dashboard/finance/invoices");
    revalidateFinancePath("/dashboard/finance/audit");
    return result;
  } catch (error) {
    console.error("[FINANCE_ACTION] Failed to approve finance request:", error);
    throw error;
  }
}

export async function rejectFinanceRequestAction(
  actorId: string,
  requestId: string,
  reason?: string,
) {
  try {
    const actor = await requireFinanceApprovalAuthority(actorId);
    const result = await FinanceControlService.rejectRequest(
      actor.id,
      requestId,
      reason,
    );
    revalidateFinancePath("/dashboard/finance/periods");
    revalidateFinancePath("/dashboard/finance/audit");
    return result;
  } catch (error) {
    console.error("[FINANCE_ACTION] Failed to reject finance request:", error);
    throw error;
  }
}

export async function createFinancePeriodAction(
  actorId: string,
  input: CreateFinancePeriodInput,
) {
  try {
    const actor = await requireFinanceApprovalAuthority(actorId);
    const result = await FinanceControlService.createPeriod(actor.id, input);
    revalidateFinancePath("/dashboard/finance/periods");
    return result;
  } catch (error) {
    console.error("[FINANCE_ACTION] Failed to create finance period:", error);
    throw error;
  }
}

export async function updateFinancePeriodStatusAction(
  actorId: string,
  periodId: string,
  status: "OPEN" | "SOFT_CLOSED" | "CLOSED",
  reason: string,
) {
  try {
    const actor = await requireFinanceApprovalAuthority(actorId);
    const result = await FinanceControlService.updatePeriodStatus(
      actor.id,
      periodId,
      { status, reason },
    );
    revalidateFinancePath("/dashboard/finance/periods");
    revalidateFinancePath("/dashboard/finance/audit");
    return result;
  } catch (error) {
    console.error(
      "[FINANCE_ACTION] Failed to update finance period status:",
      error,
    );
    throw error;
  }
}

export async function createManualJournalAdjustmentAction(
  actorId: string,
  input: ManualJournalAdjustmentInput,
) {
  try {
    const actor = await requireFinanceApprovalAuthority(actorId);
    const result = await AccountingService.createManualAdjustment(
      actor.id,
      input,
    );
    revalidateFinancePath("/dashboard/finance/accounting");
    revalidateFinancePath("/dashboard/finance/audit");
    return result;
  } catch (error) {
    console.error(
      "[FINANCE_ACTION] Failed to create manual journal adjustment:",
      error,
    );
    throw error;
  }
}
