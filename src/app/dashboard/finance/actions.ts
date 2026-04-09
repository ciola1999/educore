"use server";

import { and, eq, isNull, like, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { AuthRole } from "@/core/auth/roles";
import { getDb } from "@/core/db/connection";
import { students, users } from "@/core/db/schema";
import { FinanceControlService } from "@/core/services/finance-control-service";
import { FinanceService } from "@/core/services/finance-service";
import { auth } from "@/lib/auth/web/auth";
import type {
  CreateBillingBatchInput,
  ProcessPaymentInput,
} from "@/lib/validations/finance";
import {
  getFinanceDesktopGuardMessage,
  isFinanceDesktopEmbeddedRuntime,
} from "./runtime-policy";

type CreateBatchInvoicesActionInput = Omit<
  CreateBillingBatchInput,
  "studentIds"
> & {
  studentIds?: string[];
};

const FINANCE_APPROVER_ROLES: AuthRole[] = ["super_admin", "admin"];
const FINANCE_OPERATOR_ROLES: AuthRole[] = ["super_admin", "admin", "staff"];

function assertFinanceRuntimeSupported() {
  if (isFinanceDesktopEmbeddedRuntime()) {
    throw new Error(getFinanceDesktopGuardMessage());
  }
}

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
  assertFinanceRuntimeSupported();
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
    const db = await getDb();
    const resolvedStudentIds =
      input.studentIds && input.studentIds.length > 0
        ? input.studentIds
        : (
            await db
              .select({ id: users.id })
              .from(users)
              .where(
                and(
                  eq(users.role, "student"),
                  eq(users.isActive, true),
                  isNull(users.deletedAt),
                ),
              )
          ).map((student) => student.id);

    if (resolvedStudentIds.length === 0) {
      throw new Error("Tidak ada siswa target untuk batch invoice.");
    }

    const result = await FinanceService.createBatchInvoices(actor.id, {
      ...input,
      studentIds: resolvedStudentIds,
    } satisfies CreateBillingBatchInput);
    revalidateFinancePath("/dashboard/finance/invoices");
    return result;
  } catch (error) {
    console.error("[FINANCE_ACTION] Batch generation failed:", error);
    throw error;
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

export async function searchStudentsAction(query: string) {
  try {
    await requireFinanceOperatorAuthority();
    const db = await getDb();
    const result = await db
      .select({
        id: users.id,
        nis: users.nis,
        fullName: users.fullName,
        grade: students.grade,
      })
      .from(users)
      .leftJoin(
        students,
        and(eq(students.nis, users.nis), isNull(students.deletedAt)),
      )
      .where(
        and(
          eq(users.role, "student"),
          eq(users.isActive, true),
          isNull(users.deletedAt),
          or(like(users.fullName, `%${query}%`), like(users.nis, `%${query}%`)),
        ),
      )
      .limit(10);

    return result;
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

export async function approveFinanceRequestAction(
  actorId: string,
  requestId: string,
) {
  try {
    const actor = await requireFinanceApprovalAuthority(actorId);
    const result = await FinanceControlService.approveRequest(
      actor.id,
      requestId,
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
) {
  try {
    const actor = await requireFinanceApprovalAuthority(actorId);
    const result = await FinanceControlService.rejectRequest(
      actor.id,
      requestId,
    );
    revalidateFinancePath("/dashboard/finance/periods");
    revalidateFinancePath("/dashboard/finance/audit");
    return result;
  } catch (error) {
    console.error("[FINANCE_ACTION] Failed to reject finance request:", error);
    throw error;
  }
}
