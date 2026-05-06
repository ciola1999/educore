import { and, eq, isNull, like, or } from "drizzle-orm";
import type {
  FinanceAccountView,
  FinanceAuditLogView,
  FinanceInvoiceListItemView,
  FinanceJournalEntryView,
  FinancePaymentMethodView,
  FinanceSummaryView,
} from "@/app/dashboard/finance/types";
import type { AuthRole } from "@/core/auth/roles";
import { AccountingService } from "@/core/services/accounting-service";
import { FinanceControlService } from "@/core/services/finance-control-service";
import { FinanceService } from "@/core/services/finance-service";
import { checkPermission, type Permission } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db";
import { classes, creditBalances, students, users } from "@/lib/db/schema";
import { useStore } from "@/lib/store/use-store";
import { sanitizeClassDisplayName } from "@/lib/utils/class-name";
import type {
  ApplyCreditToInvoicesInput,
  CreateBillingBatchInput,
  CreateFinancePeriodInput,
  ManualJournalAdjustmentInput,
  ProcessPaymentInput,
  UpdateFinancePeriodStatusInput,
} from "@/lib/validations/finance";
import { apiOk, type DesktopApiResponse } from "./desktop-route-response";

type EnsurePermission = (permission: Permission) => DesktopApiResponse;

type HandleDesktopFinanceRouteDeps = {
  ensurePermission: EnsurePermission;
};

const FINANCE_APPROVER_ROLES: AuthRole[] = ["super_admin", "admin"];
const FINANCE_OPERATOR_ROLES: AuthRole[] = ["super_admin", "admin", "staff"];

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

function mapInvoiceViews(
  invoices: Awaited<ReturnType<typeof FinanceService.getInvoices>>,
): FinanceInvoiceListItemView[] {
  const today = new Date();

  return invoices.map((invoice) => {
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
    };
  });
}

function mapAuditLogViews(
  logs: Awaited<ReturnType<typeof FinanceService.getLogs>>,
): FinanceAuditLogView[] {
  return logs.map((log) => ({
    id: log.id,
    action: log.action,
    actor: {
      fullName: log.actor?.fullName ?? "SYSTEM",
    },
    details: log.newData ?? log.oldData ?? null,
    createdAt: log.createdAt,
  }));
}

function mapPaymentMethods(
  methods: Awaited<ReturnType<typeof FinanceService.getPaymentMethods>>,
): FinancePaymentMethodView[] {
  return methods.map((method) => ({
    id: method.id,
    code: method.code,
    name: method.name,
    isElectronic: method.isElectronic,
  }));
}

function mapJournalEntryViews(
  entries: RawJournalEntry[],
): FinanceJournalEntryView[] {
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
}

function mapAccountViews(
  accounts: Awaited<ReturnType<typeof AccountingService.getAccounts>>,
): FinanceAccountView[] {
  return accounts.map((account) => ({
    id: account.id,
    code: account.code,
    name: account.name,
    type: account.type,
  }));
}

async function resolveDesktopFinanceActor() {
  const sessionUser = useStore.getState().user;

  if (!sessionUser?.id) {
    throw new Error("Sesi finance desktop tidak valid. Silakan login ulang.");
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

  return actor;
}

async function requireDesktopFinanceOperator() {
  const actor = await resolveDesktopFinanceActor();

  if (!FINANCE_OPERATOR_ROLES.includes(actor.role)) {
    throw new Error(
      "Akses ditolak. Hanya operator finance yang boleh memproses perubahan data.",
    );
  }

  return actor;
}

async function requireDesktopFinanceApprover() {
  const actor = await resolveDesktopFinanceActor();

  if (!FINANCE_APPROVER_ROLES.includes(actor.role)) {
    throw new Error(
      "Akses ditolak. Hanya admin finance yang boleh memproses approval request.",
    );
  }

  return actor;
}

export async function handleDesktopFinanceRoute(
  url: URL,
  method: string,
  pathSegments: string[],
  body: unknown,
  deps: HandleDesktopFinanceRouteDeps,
): Promise<DesktopApiResponse> {
  if (method === "GET") {
    const guard = deps.ensurePermission("finance:read");
    if (guard) {
      return guard;
    }

    if (pathSegments.length === 2) {
      const actor = await resolveDesktopFinanceActor();
      const summary =
        (await FinanceService.getDashboardSummary()) satisfies Omit<
          FinanceSummaryView,
          "canManageSync"
        >;
      return apiOk({
        ...summary,
        canManageSync: checkPermission(actor, "settings:manage"),
      } satisfies FinanceSummaryView);
    }

    if (pathSegments[2] === "invoices") {
      const status = url.searchParams.get("status") || undefined;
      const invoices = await FinanceService.getInvoices({ status });
      return apiOk(mapInvoiceViews(invoices));
    }

    if (pathSegments[2] === "periods") {
      const [periods, approvals] = await Promise.all([
        FinanceService.getPeriods(),
        FinanceService.getApprovalRequests(),
      ]);
      return apiOk({
        periods,
        approvals,
      });
    }

    if (pathSegments[2] === "audit") {
      const logs = await FinanceService.getLogs();
      return apiOk(mapAuditLogViews(logs));
    }

    if (pathSegments[2] === "payment-methods") {
      const methods = await FinanceService.getPaymentMethods();
      return apiOk(mapPaymentMethods(methods));
    }

    if (pathSegments[2] === "categories") {
      const categories = await FinanceService.getBillingCategories();
      return apiOk(
        categories.map((category) => ({
          id: category.id,
          name: category.name,
        })),
      );
    }

    if (pathSegments[2] === "batch-students") {
      const query = url.searchParams.get("query")?.trim() || undefined;
      const classId = url.searchParams.get("classId")?.trim() || undefined;
      const limitParam = Number(url.searchParams.get("limit") ?? "50");
      const categoryId =
        url.searchParams.get("categoryId")?.trim() || undefined;
      const dueDateParam = url.searchParams.get("dueDate");
      const dueDate = dueDateParam ? new Date(dueDateParam) : undefined;
      const candidates = await FinanceService.getBatchStudentCandidates({
        query,
        classId,
        limit: Number.isFinite(limitParam) ? limitParam : 50,
        categoryId,
        dueDate:
          dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate : undefined,
      });
      return apiOk(candidates);
    }

    if (pathSegments[2] === "students" && pathSegments[3] === "outstanding") {
      const limitParam = Number(url.searchParams.get("limit") ?? "250");
      const studentsWithOutstanding =
        await FinanceService.getStudentsWithOutstandingInvoices(
          Number.isFinite(limitParam) ? limitParam : 250,
        );
      return apiOk(studentsWithOutstanding);
    }

    if (pathSegments[2] === "students" && pathSegments.length === 3) {
      const query = url.searchParams.get("query")?.trim() ?? "";
      if (query.length < 3) {
        return apiOk([]);
      }

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

      return apiOk(
        result.map((student) => ({
          id: student.id,
          nis: student.nis,
          fullName: student.fullName,
          grade: sanitizeClassDisplayName(student.className, student.grade),
          creditBalance: student.creditBalance ?? 0,
        })),
      );
    }

    if (
      pathSegments[2] === "students" &&
      pathSegments[4] === "invoices" &&
      pathSegments[3]
    ) {
      const invoices = await FinanceService.getStudentOpenInvoices(
        pathSegments[3],
      );
      return apiOk(invoices);
    }

    if (pathSegments[2] === "accounting") {
      const db = await getDb();
      const [entries, accounts] = await Promise.all([
        AccountingService.getJournalEntries(db) as Promise<RawJournalEntry[]>,
        AccountingService.getAccounts(db),
      ]);
      return apiOk({
        entries: mapJournalEntryViews(entries),
        accounts: mapAccountViews(accounts),
      });
    }

    if (pathSegments[2] === "accounts") {
      const db = await getDb();
      const accounts = await AccountingService.getAccounts(db);
      return apiOk(mapAccountViews(accounts));
    }
  }

  if (method === "POST" || method === "PATCH") {
    const guard = deps.ensurePermission("finance:write");
    if (guard) {
      return guard;
    }

    if (method === "POST" && pathSegments[2] === "batches") {
      const actor = await requireDesktopFinanceOperator();
      const request = body as CreateBillingBatchInput;
      const result = await FinanceService.createBatchInvoices(actor.id, {
        ...request,
        targetMode: request.targetMode ?? "ALL_STUDENTS",
        studentIds: request.studentIds ?? [],
      } satisfies CreateBillingBatchInput);
      return apiOk(result, 201);
    }

    if (method === "POST" && pathSegments[2] === "payments") {
      const actor = await requireDesktopFinanceOperator();
      const result = await FinanceService.processPayment(
        actor.id,
        body as ProcessPaymentInput,
      );
      return apiOk(result, 201);
    }

    if (
      method === "POST" &&
      pathSegments[2] === "credits" &&
      pathSegments[3] === "apply"
    ) {
      const actor = await requireDesktopFinanceOperator();
      const result = await FinanceService.applyCreditToInvoices(
        actor.id,
        body as ApplyCreditToInvoicesInput,
      );
      return apiOk(result, 201);
    }

    if (
      method === "POST" &&
      pathSegments[2] === "invoices" &&
      pathSegments[3] === "bulk-status"
    ) {
      const actor = await requireDesktopFinanceApprover();
      const payload = (body ?? null) as {
        invoiceIds?: string[];
        status?: "VOID";
        reason?: string;
      } | null;
      if (payload?.status !== "VOID") {
        throw new Error("Bulk invoice hanya mendukung status VOID.");
      }
      const result = await FinanceService.bulkUpdateInvoiceStatus(actor.id, {
        invoiceIds: payload.invoiceIds ?? [],
        status: "VOID",
        reason: payload.reason ?? "",
      });
      return apiOk(result);
    }

    if (method === "POST" && pathSegments[2] === "periods") {
      const actor = await requireDesktopFinanceApprover();
      const result = await FinanceControlService.createPeriod(
        actor.id,
        body as CreateFinancePeriodInput,
      );
      return apiOk(result, 201);
    }

    if (
      method === "PATCH" &&
      pathSegments[2] === "invoices" &&
      pathSegments[4] === "status" &&
      pathSegments[3]
    ) {
      const payload = (body ?? null) as {
        status?: "VOID" | "WRITEOFF" | "OPEN";
      } | null;
      const status = payload?.status;

      if (!status) {
        throw new Error("Status invoice wajib diisi.");
      }

      const actor =
        status === "OPEN"
          ? await requireDesktopFinanceOperator()
          : await requireDesktopFinanceApprover();

      const result = await FinanceService.updateInvoiceStatus(
        actor.id,
        pathSegments[3],
        status,
      );
      return apiOk(result);
    }

    if (
      method === "PATCH" &&
      pathSegments[2] === "periods" &&
      pathSegments[4] === "status" &&
      pathSegments[3]
    ) {
      const actor = await requireDesktopFinanceApprover();
      const result = await FinanceControlService.updatePeriodStatus(
        actor.id,
        pathSegments[3],
        body as UpdateFinancePeriodStatusInput,
      );
      return apiOk(result);
    }

    if (
      method === "POST" &&
      pathSegments[2] === "approvals" &&
      pathSegments[4] === "approve" &&
      pathSegments[3]
    ) {
      const actor = await requireDesktopFinanceApprover();
      const payload = (body ?? null) as { reason?: string } | null;
      const result = await FinanceControlService.approveRequest(
        actor.id,
        pathSegments[3],
        payload?.reason,
      );
      return apiOk(result);
    }

    if (
      method === "POST" &&
      pathSegments[2] === "approvals" &&
      pathSegments[4] === "reject" &&
      pathSegments[3]
    ) {
      const actor = await requireDesktopFinanceApprover();
      const payload = (body ?? null) as { reason?: string } | null;
      const result = await FinanceControlService.rejectRequest(
        actor.id,
        pathSegments[3],
        payload?.reason,
      );
      return apiOk(result);
    }

    if (
      method === "POST" &&
      pathSegments[2] === "accounting" &&
      pathSegments[3] === "adjustments"
    ) {
      const actor = await requireDesktopFinanceApprover();
      const result = await AccountingService.createManualAdjustment(
        actor.id,
        body as ManualJournalAdjustmentInput,
      );
      return apiOk(result, 201);
    }
  }

  return null;
}
