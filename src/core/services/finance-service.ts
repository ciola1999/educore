import { format } from "date-fns";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  like,
  lt,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { isTauri } from "@/core/env";
import { getDb } from "@/lib/db";
import {
  approvalRequests,
  billingBatches,
  billingCategories,
  classes,
  creditBalances,
  financeLogs,
  financePeriods,
  invoiceItems,
  invoices,
  journalEntries,
  paymentAllocations,
  paymentMethods,
  payments,
  receipts,
  students,
  users,
} from "@/lib/db/schema";
import { sanitizeClassDisplayName } from "@/lib/utils/class-name";
import {
  type ApplyCreditToInvoicesInput,
  applyCreditToInvoicesSchema,
  type CreateBillingBatchInput,
  type CreateInvoiceInput,
  createBillingBatchSchema,
  createInvoiceSchema,
  type ProcessPaymentInput,
  processPaymentSchema,
} from "@/lib/validations/finance";
import { AccountingService } from "./accounting-service";
import { FinanceControlService } from "./finance-control-service";

const DOC_NO_SEQUENCE_WIDTH = 4;
const DOC_NO_SUFFIX_LENGTH = 6;

function buildDocNoPattern(prefix: string, year: string, month: string) {
  return new RegExp(
    `^${prefix}/${year}/${month}/(\\d{${DOC_NO_SEQUENCE_WIDTH}})(?:/[A-Z0-9]+)?$`,
  );
}

function extractDocSequence(
  value: string,
  prefix: string,
  year: string,
  month: string,
) {
  const match = buildDocNoPattern(prefix, year, month).exec(value);
  if (!match) {
    return null;
  }

  const parsed = Number.parseInt(match[1] ?? "", 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function buildDocNoSuffix() {
  return crypto
    .randomUUID()
    .replace(/-/g, "")
    .slice(0, DOC_NO_SUFFIX_LENGTH)
    .toUpperCase();
}

function normalizeMoneyAmount(value: number) {
  return Number.isFinite(value) ? Math.trunc(value) : 0;
}

function normalizeInvoiceItems<
  T extends { description: string; amount: number },
>(items: T[]) {
  return items.map((item) => ({
    ...item,
    description: item.description.trim(),
    amount: normalizeMoneyAmount(item.amount),
  }));
}

function getInvoiceMonthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

/**
 * FinanceService (Core Unified Engine Phase 2.4 - 5.0)
 * The heart of EduCore Financials: Handling Billing, Payments, Ledger Posting, and Control.
 * Elite April 2026 Standards: Atomic, Audit-Ready, and Period-Aware.
 */
export const FinanceService = {
  /**
   * Generates a unique document number (Invoice, Payment, Receipt)
   * Pattern: PREFIX/YYYY/MM/SEQUENCE/SUFFIX (e.g., INV/2026/04/0001/ABC123)
   * Sequence remains human-readable while the suffix reduces cross-device sync collisions.
   */
  async generateNo(
    // biome-ignore lint/suspicious/noExplicitAny: Generic DB or TX object
    db: any,
    prefix: string,
    // biome-ignore lint/suspicious/noExplicitAny: Drizzle table type
    table: any,
    // biome-ignore lint/suspicious/noExplicitAny: Drizzle column type
    column: any,
  ): Promise<string> {
    const now = new Date();
    const year = format(now, "yyyy");
    const month = format(now, "MM");
    const base = `${prefix}/${year}/${month}`;

    const last = await db
      .select({ no: column })
      .from(table)
      .where(like(column, `${base}/%`))
      .orderBy(desc(column))
      .limit(1);

    let seq = 1;
    if (last[0]) {
      const lastSeq = extractDocSequence(
        last[0].no as string,
        prefix,
        year,
        month,
      );
      if (lastSeq !== null) seq = lastSeq + 1;
    }

    return `${base}/${seq
      .toString()
      .padStart(DOC_NO_SEQUENCE_WIDTH, "0")}/${buildDocNoSuffix()}`;
  },

  /**
   * Captures an immutable JSON snapshot of student data for historical integrity.
   */
  async takeStudentSnapshot(
    // biome-ignore lint/suspicious/noExplicitAny: Generic DB or TX object
    db: any,
    studentId: string,
  ) {
    const [studentData] = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        nis: users.nis,
        nisn: students.nisn,
        grade: students.grade,
        className: classes.name,
        parentName: students.parentName,
        photo: users.foto,
      })
      .from(users)
      .leftJoin(
        students,
        and(eq(students.nis, users.nis), isNull(students.deletedAt)),
      )
      .leftJoin(
        classes,
        and(eq(classes.id, students.grade), isNull(classes.deletedAt)),
      )
      .where(
        and(
          eq(users.id, studentId),
          eq(users.role, "student"),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);

    if (studentData) {
      return JSON.stringify({
        ...studentData,
        className: sanitizeClassDisplayName(
          studentData.className,
          studentData.grade,
        ),
      });
    }

    const [legacyStudentData] = await db
      .select({
        id: students.id,
        fullName: sql<string>`coalesce(${users.fullName}, ${students.fullName})`,
        nis: students.nis,
        nisn: students.nisn,
        grade: students.grade,
        className: classes.name,
        parentName: students.parentName,
        photo: users.foto,
      })
      .from(students)
      .leftJoin(
        users,
        and(
          isNull(users.deletedAt),
          or(eq(users.id, students.id), eq(users.nis, students.nis)),
        ),
      )
      .leftJoin(
        classes,
        and(eq(classes.id, students.grade), isNull(classes.deletedAt)),
      )
      .where(and(eq(students.id, studentId), isNull(students.deletedAt)))
      .limit(1);

    if (!legacyStudentData?.id) return null;
    return JSON.stringify({
      ...legacyStudentData,
      className: sanitizeClassDisplayName(
        legacyStudentData.className,
        legacyStudentData.grade,
      ),
    });
  },

  /**
   * Logs a financial event to the immutable logs table for audit compliance.
   */
  async logEvent(
    // biome-ignore lint/suspicious/noExplicitAny: Generic DB or TX object
    db: any,
    action: string,
    actorId: string,
    newData?: unknown,
    oldData?: unknown,
  ) {
    await db.insert(financeLogs).values({
      id: crypto.randomUUID(),
      action,
      actorId,
      newData: newData ? JSON.stringify(newData) : null,
      oldData: oldData ? JSON.stringify(oldData) : null,
      createdAt: new Date(),
    });
  },

  // ============================================
  // PHASE 2 & 4: BILLING ENGINE (WITH POSTING)
  // ============================================

  async createSingleBatchInvoice(
    // biome-ignore lint/suspicious/noExplicitAny: Internal TX or DB object
    tx: any,
    input: {
      batchId: string;
      categoryId: string;
      dueDate: Date;
      items: CreateBillingBatchInput["items"];
      batchName: string;
      studentId: string;
    },
  ) {
    const studentSnapshot = await FinanceService.takeStudentSnapshot(
      tx,
      input.studentId,
    );
    if (!studentSnapshot) {
      return null;
    }

    const normalizedItems = normalizeInvoiceItems(input.items);
    if (normalizedItems.some((item) => item.amount < 1000)) {
      throw new Error("Nominal item invoice minimal Rp1.000.");
    }
    const totalAmount = normalizedItems.reduce(
      (sum, item) => sum + item.amount,
      0,
    );
    const invoiceNo = await FinanceService.generateNo(
      tx,
      "INV",
      invoices,
      invoices.invoiceNo,
    );
    const invoiceId = crypto.randomUUID();

    await tx.insert(invoices).values({
      id: invoiceId,
      invoiceNo,
      studentId: input.studentId,
      batchId: input.batchId,
      categoryId: input.categoryId,
      dueDate: input.dueDate,
      totalAmount,
      outstanding: totalAmount,
      totalPaid: 0,
      status: "OPEN",
      studentSnapshot,
      createdAt: new Date(),
    });

    for (const item of normalizedItems) {
      await tx.insert(invoiceItems).values({
        id: crypto.randomUUID(),
        invoiceId,
        description: item.description,
        amount: item.amount,
        createdAt: new Date(),
      });
    }

    await AccountingService.postInvoice(tx, {
      id: invoiceId,
      no: invoiceNo,
      amount: totalAmount,
      description: input.batchName,
    });

    return {
      studentId: input.studentId,
      invoiceId,
      invoiceNo,
    };
  },

  async getBatchStudentCandidates(input?: {
    query?: string;
    classId?: string;
    limit?: number;
    categoryId?: string;
    dueDate?: Date;
  }) {
    const db = await getDb();
    const normalizedQuery = input?.query?.trim();
    const normalizedClassId = input?.classId?.trim();
    const limit = Math.min(Math.max(input?.limit ?? 50, 1), 200);

    const conditions = [isNull(students.deletedAt)];
    if (normalizedQuery) {
      conditions.push(
        or(
          like(students.fullName, `%${normalizedQuery}%`),
          like(students.nis, `%${normalizedQuery}%`),
          like(students.nisn, `%${normalizedQuery}%`),
          like(students.grade, `%${normalizedQuery}%`),
          like(classes.name, `%${normalizedQuery}%`),
        ) as NonNullable<ReturnType<typeof or>>,
      );
    }
    if (normalizedClassId) {
      conditions.push(
        or(
          eq(students.grade, normalizedClassId),
          eq(classes.id, normalizedClassId),
          eq(classes.name, normalizedClassId),
        ) as NonNullable<ReturnType<typeof or>>,
      );
    }

    const rows = await db
      .select({
        id: students.id,
        nis: students.nis,
        nisn: students.nisn,
        fullName: students.fullName,
        grade: students.grade,
        className: classes.name,
      })
      .from(students)
      .leftJoin(
        classes,
        and(eq(classes.id, students.grade), isNull(classes.deletedAt)),
      )
      .where(and(...conditions))
      .orderBy(asc(students.fullName))
      .limit(limit);

    const monthRange =
      input?.categoryId && input?.dueDate
        ? getInvoiceMonthRange(input.dueDate)
        : null;

    return await Promise.all(
      rows.map(async (student) => {
        let hasExistingInvoiceForPeriod = false;
        if (monthRange && input?.categoryId) {
          const [existing] = await db
            .select({ id: invoices.id })
            .from(invoices)
            .where(
              and(
                eq(invoices.studentId, student.id),
                eq(invoices.categoryId, input.categoryId),
                gte(invoices.dueDate, monthRange.start),
                lt(invoices.dueDate, monthRange.end),
                notInArray(invoices.status, ["VOID", "WRITEOFF"]),
                isNull(invoices.deletedAt),
              ),
            )
            .limit(1);
          hasExistingInvoiceForPeriod = Boolean(existing);
        }

        return {
          id: student.id,
          nis: student.nis,
          nisn: student.nisn,
          fullName: student.fullName,
          grade: sanitizeClassDisplayName(student.className, student.grade),
          hasExistingInvoiceForPeriod,
        };
      }),
    );
  },

  /**
   * Generates multiple invoices at once for a selection of students (Batch).
   */
  async createBatchInvoices(actorId: string, input: CreateBillingBatchInput) {
    const validated = createBillingBatchSchema.parse(input);
    const db = await getDb();

    const normalizedItems = normalizeInvoiceItems(validated.items);
    if (normalizedItems.some((item) => item.amount < 1000)) {
      throw new Error("Nominal item invoice minimal Rp1.000.");
    }
    const totalAmount = normalizedItems.reduce(
      (sum, item) => sum + item.amount,
      0,
    );
    const uniqueRequestedIds = Array.from(new Set(validated.studentIds));
    const targetRows =
      validated.targetMode === "SELECTED_STUDENTS"
        ? await db
            .select({ id: students.id })
            .from(students)
            .where(
              and(
                inArray(students.id, uniqueRequestedIds),
                isNull(students.deletedAt),
              ),
            )
        : await db
            .select({ id: students.id })
            .from(students)
            .where(isNull(students.deletedAt));
    const targetStudentIds = targetRows.map((student) => student.id);
    const skippedInvalid =
      validated.targetMode === "SELECTED_STUDENTS"
        ? uniqueRequestedIds.length - targetStudentIds.length
        : 0;
    const monthRange = getInvoiceMonthRange(validated.dueDate);
    const existingInvoiceRows =
      targetStudentIds.length > 0
        ? await db
            .select({ studentId: invoices.studentId })
            .from(invoices)
            .where(
              and(
                inArray(invoices.studentId, targetStudentIds),
                eq(invoices.categoryId, validated.categoryId),
                gte(invoices.dueDate, monthRange.start),
                lt(invoices.dueDate, monthRange.end),
                notInArray(invoices.status, ["VOID", "WRITEOFF"]),
                isNull(invoices.deletedAt),
              ),
            )
        : [];
    const existingStudentIds = new Set(
      existingInvoiceRows.map((invoice) => invoice.studentId),
    );
    const studentIdsToProcess = targetStudentIds.filter(
      (studentId) => !existingStudentIds.has(studentId),
    );
    const skippedExisting =
      targetStudentIds.length - studentIdsToProcess.length;
    const useChunkedDesktopFlow = isTauri();

    if (useChunkedDesktopFlow) {
      await FinanceControlService.validatePeriod(db, new Date());

      const batchId = crypto.randomUUID();
      await db.insert(billingBatches).values({
        id: batchId,
        name: validated.name,
        description: validated.description,
        status: "PROCESSED",
        createdAt: new Date(),
      });

      const results: Array<{
        studentId: string;
        invoiceId: string;
        invoiceNo: string;
      }> = [];
      let skippedSnapshot = 0;

      for (const studentId of studentIdsToProcess) {
        await FinanceControlService.validatePeriod(db, new Date());
        const invoiceResult = await FinanceService.createSingleBatchInvoice(
          db,
          {
            batchId,
            categoryId: validated.categoryId,
            dueDate: validated.dueDate,
            items: normalizedItems,
            batchName: validated.name,
            studentId,
          },
        );

        if (invoiceResult) {
          results.push(invoiceResult);
        } else {
          skippedSnapshot += 1;
        }
      }

      const totalSkippedInvalid = skippedInvalid + skippedSnapshot;
      await FinanceService.logEvent(db, "BATCH_INVOICE_GENERATE", actorId, {
        batchId,
        count: results.length,
        requestedCount: targetStudentIds.length,
        mode: "desktop_sequential_non_transactional",
        skippedExisting,
        skippedInvalid: totalSkippedInvalid,
        skippedSnapshot,
        totalAmount,
      });

      return {
        batchId,
        processed: results.length,
        skipped: skippedExisting + totalSkippedInvalid,
        skippedExisting,
        skippedInvalid: totalSkippedInvalid,
      };
    }

    return await db.transaction(async (tx) => {
      // PHASE 5: ENFORCE PERIOD
      await FinanceControlService.validatePeriod(tx, new Date());

      const batchId = crypto.randomUUID();
      await tx.insert(billingBatches).values({
        id: batchId,
        name: validated.name,
        description: validated.description,
        status: "PROCESSED",
        createdAt: new Date(),
      });

      const results = [];
      let skippedSnapshot = 0;
      for (const studentId of studentIdsToProcess) {
        const invoiceResult = await FinanceService.createSingleBatchInvoice(
          tx,
          {
            batchId,
            categoryId: validated.categoryId,
            dueDate: validated.dueDate,
            items: normalizedItems,
            batchName: validated.name,
            studentId,
          },
        );
        if (invoiceResult) {
          results.push(invoiceResult);
        } else {
          skippedSnapshot += 1;
        }
      }

      const totalSkippedInvalid = skippedInvalid + skippedSnapshot;
      await FinanceService.logEvent(tx, "BATCH_INVOICE_GENERATE", actorId, {
        batchId,
        count: results.length,
        requestedCount: targetStudentIds.length,
        mode: "single_transaction",
        skippedExisting,
        skippedInvalid: totalSkippedInvalid,
        skippedSnapshot,
        totalAmount,
      });

      return {
        batchId,
        processed: results.length,
        skipped: skippedExisting + totalSkippedInvalid,
        skippedExisting,
        skippedInvalid: totalSkippedInvalid,
      };
    });
  },

  /**
   * Creates a single standalone invoice.
   */
  async createInvoice(actorId: string, input: CreateInvoiceInput) {
    const validated = createInvoiceSchema.parse(input);
    const db = await getDb();

    return await db.transaction(async (tx) => {
      // PHASE 5: ENFORCE PERIOD
      await FinanceControlService.validatePeriod(tx, new Date());

      const studentSnapshot = await FinanceService.takeStudentSnapshot(
        tx,
        validated.studentId,
      );
      if (!studentSnapshot) throw new Error("Siswa tidak ditemukan");

      const normalizedItems = normalizeInvoiceItems(validated.items);
      if (normalizedItems.some((item) => item.amount < 1000)) {
        throw new Error("Nominal item invoice minimal Rp1.000.");
      }
      const totalAmount = normalizedItems.reduce(
        (sum, item) => sum + item.amount,
        0,
      );
      const invoiceNo = await FinanceService.generateNo(
        tx,
        "INV",
        invoices,
        invoices.invoiceNo,
      );
      const invoiceId = crypto.randomUUID();

      await tx.insert(invoices).values({
        id: invoiceId,
        invoiceNo,
        studentId: validated.studentId,
        batchId: validated.batchId,
        categoryId: validated.categoryId,
        dueDate: validated.dueDate,
        totalAmount,
        outstanding: totalAmount,
        totalPaid: 0,
        status: "OPEN",
        studentSnapshot,
        createdAt: new Date(),
      });

      for (const item of normalizedItems) {
        await tx.insert(invoiceItems).values({
          id: crypto.randomUUID(),
          invoiceId,
          description: item.description,
          amount: item.amount,
          createdAt: new Date(),
        });
      }

      // PHASE 4: AUTO-POST Invoice to Ledger
      await AccountingService.postInvoice(tx, {
        id: invoiceId,
        no: invoiceNo,
        amount: totalAmount,
        description: `Manual invoice gen ${invoiceNo}`,
      });

      await FinanceService.logEvent(tx, "INVOICE_CREATE", actorId, {
        invoiceId,
        invoiceNo,
      });

      return { id: invoiceId, invoiceNo };
    });
  },

  /**
   * Updates invoice status manually (VOID / WRITEOFF).
   */
  async updateInvoiceStatus(
    actorId: string,
    invoiceId: string,
    newStatus: "VOID" | "WRITEOFF" | "OPEN",
  ) {
    const db = await getDb();

    if (isTauri()) {
      await FinanceControlService.validatePeriod(db, new Date());

      const [existing] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, invoiceId))
        .limit(1);

      if (!existing) throw new Error("Invoice tidak ditemukan");

      if (existing.totalPaid > 0 && newStatus === "VOID") {
        throw new Error("Tidak bisa membatalkan invoice yang sudah terbayar.");
      }

      if (newStatus === "VOID" || newStatus === "WRITEOFF") {
        const approvalRequestId =
          await FinanceControlService.submitApprovalRequestStandalone({
            type: newStatus,
            requestedBy: actorId,
            targetId: invoiceId,
            targetType: "INVOICE",
            payload: {
              invoiceId,
              invoiceNo: existing.invoiceNo,
              amount: existing.outstanding,
              previousStatus: existing.status,
              requestedStatus: newStatus,
            },
          });

        await FinanceService.logEvent(
          db,
          `INVOICE_STATUS_${newStatus}_REQUESTED`,
          actorId,
          {
            invoiceId,
            approvalRequestId,
            previousStatus: existing.status,
            requestedStatus: newStatus,
          },
        );

        return {
          status: "PENDING_APPROVAL" as const,
          approvalRequestId,
          invoiceId,
          requestedStatus: newStatus,
        };
      }

      await db
        .update(invoices)
        .set({
          status: newStatus,
          updatedAt: new Date(),
          version: sql`${invoices.version} + 1`,
          syncStatus: "pending",
        })
        .where(eq(invoices.id, invoiceId));

      await FinanceService.logEvent(
        db,
        `INVOICE_STATUS_${newStatus}`,
        actorId,
        {
          invoiceId,
          previousStatus: existing.status,
          nextStatus: newStatus,
        },
      );

      return {
        status: newStatus,
        invoiceId,
      };
    }

    return await db.transaction(async (tx) => {
      // PHASE 5: ENFORCE PERIOD
      await FinanceControlService.validatePeriod(tx, new Date());

      const [existing] = await tx
        .select()
        .from(invoices)
        .where(eq(invoices.id, invoiceId))
        .limit(1);

      if (!existing) throw new Error("Invoice tidak ditemukan");

      if (existing.totalPaid > 0 && newStatus === "VOID") {
        throw new Error("Tidak bisa membatalkan invoice yang sudah terbayar.");
      }

      if (newStatus === "VOID" || newStatus === "WRITEOFF") {
        const approvalRequestId =
          await FinanceControlService.submitApprovalRequest(tx, {
            type: newStatus,
            requestedBy: actorId,
            targetId: invoiceId,
            targetType: "INVOICE",
            payload: {
              invoiceId,
              invoiceNo: existing.invoiceNo,
              amount: existing.outstanding,
              previousStatus: existing.status,
              requestedStatus: newStatus,
            },
          });

        await FinanceService.logEvent(
          tx,
          `INVOICE_STATUS_${newStatus}_REQUESTED`,
          actorId,
          {
            invoiceId,
            approvalRequestId,
            previousStatus: existing.status,
            requestedStatus: newStatus,
          },
        );

        return {
          status: "PENDING_APPROVAL" as const,
          approvalRequestId,
          invoiceId,
          requestedStatus: newStatus,
        };
      }

      await tx
        .update(invoices)
        .set({
          status: newStatus,
          updatedAt: new Date(),
          version: sql`${invoices.version} + 1`,
          syncStatus: "pending",
        })
        .where(eq(invoices.id, invoiceId));

      await FinanceService.logEvent(
        tx,
        `INVOICE_STATUS_${newStatus}`,
        actorId,
        {
          invoiceId,
          oldStatus: existing.status,
        },
      );

      return {
        status: "UPDATED" as const,
        invoiceId,
        newStatus,
      };
    });
  },

  async bulkUpdateInvoiceStatus(
    actorId: string,
    input: {
      invoiceIds: string[];
      status: "VOID";
      reason: string;
    },
  ) {
    const uniqueInvoiceIds = Array.from(new Set(input.invoiceIds));
    if (uniqueInvoiceIds.length === 0) {
      throw new Error("Minimal pilih 1 invoice.");
    }

    const reason = input.reason.trim();
    if (reason.length < 5) {
      throw new Error("Alasan void massal minimal 5 karakter.");
    }

    const db = await getDb();
    const rows = await db
      .select({
        id: invoices.id,
        status: invoices.status,
        totalPaid: invoices.totalPaid,
      })
      .from(invoices)
      .where(
        and(inArray(invoices.id, uniqueInvoiceIds), isNull(invoices.deletedAt)),
      );
    const rowById = new Map(rows.map((row) => [row.id, row]));
    const result = {
      processed: 0,
      skippedPaid: 0,
      skippedAlreadyFinal: 0,
      skippedInvalid: 0,
      approvalCreated: 0,
    };

    for (const invoiceId of uniqueInvoiceIds) {
      const invoice = rowById.get(invoiceId);
      if (!invoice) {
        result.skippedInvalid += 1;
        continue;
      }

      if (invoice.status === "VOID" || invoice.status === "WRITEOFF") {
        result.skippedAlreadyFinal += 1;
        continue;
      }

      if (
        invoice.status === "PAID" ||
        invoice.status === "OVERPAID" ||
        invoice.totalPaid > 0
      ) {
        result.skippedPaid += 1;
        continue;
      }

      try {
        const update = await FinanceService.updateInvoiceStatus(
          actorId,
          invoiceId,
          input.status,
        );
        result.processed += 1;
        if (update.status === "PENDING_APPROVAL") {
          result.approvalCreated += 1;
        }
      } catch {
        result.skippedInvalid += 1;
      }
    }

    await FinanceService.logEvent(db, "INVOICE_BULK_VOID_REQUESTED", actorId, {
      invoiceIds: uniqueInvoiceIds,
      reason,
      ...result,
    });

    return result;
  },

  // ============================================
  // PHASE 3 & 4: PAYMENT ENGINE (WITH POSTING)
  // ============================================

  /**
   * Processes a student payment and allocates it to open invoices.
   * Handles FIFO automatically if allocations not provided.
   */
  async processPayment(actorId: string, input: ProcessPaymentInput) {
    const validated = processPaymentSchema.parse(input);
    const db = await getDb();

    if (isTauri()) {
      return await FinanceService.processPaymentOnDb(db, actorId, validated);
    }

    return await db.transaction(async (tx) => {
      return await FinanceService.processPaymentOnDb(tx, actorId, validated);
    });
  },

  async processPaymentOnDb(
    // biome-ignore lint/suspicious/noExplicitAny: Internal TX or desktop DB object
    tx: any,
    actorId: string,
    validated: ProcessPaymentInput,
  ) {
    const idempotencyKey = validated.requestId ?? validated.referenceNo ?? null;
    if (idempotencyKey) {
      const [existingPayment] = await tx
        .select({
          id: payments.id,
          paymentNo: payments.paymentNo,
          amount: payments.amount,
          receiptNo: receipts.receiptNo,
        })
        .from(payments)
        .leftJoin(receipts, eq(receipts.paymentId, payments.id))
        .where(
          and(
            eq(payments.referenceNo, idempotencyKey),
            eq(payments.studentId, validated.studentId),
            isNull(payments.deletedAt),
          ),
        )
        .limit(1);

      if (existingPayment) {
        return {
          paymentId: existingPayment.id,
          paymentNo: existingPayment.paymentNo,
          receiptNo: existingPayment.receiptNo ?? "",
          credit: 0,
          duplicate: true,
        };
      }
    }

    // PHASE 5: ENFORCE PERIOD
    await FinanceControlService.validatePeriod(tx, validated.date);

    let remainingAmount = validated.amount;
    const paymentId = crypto.randomUUID();
    const paymentNo = await FinanceService.generateNo(
      tx,
      "PAY",
      payments,
      payments.paymentNo,
    );

    const studentSnapshotData = await FinanceService.takeStudentSnapshot(
      tx,
      validated.studentId,
    );
    if (!studentSnapshotData) {
      throw new Error("Siswa pembayaran tidak ditemukan.");
    }

    // Fetch Method for Ledger
    const [method] = await tx
      .select({ id: paymentMethods.id, name: paymentMethods.name })
      .from(paymentMethods)
      .where(eq(paymentMethods.id, validated.methodId))
      .limit(1);
    if (!method?.id) {
      throw new Error("Metode pembayaran tidak valid atau tidak aktif.");
    }

    const manualInvoices: Array<{
      invoice: typeof invoices.$inferSelect;
      amount: number;
    }> = [];
    if (validated.allocations && validated.allocations.length > 0) {
      for (const alloc of validated.allocations) {
        const [invoice] = await tx
          .select()
          .from(invoices)
          .where(eq(invoices.id, alloc.invoiceId))
          .limit(1);

        if (
          !invoice ||
          invoice.studentId !== validated.studentId ||
          invoice.deletedAt ||
          !["OPEN", "PARTIAL"].includes(invoice.status) ||
          invoice.outstanding <= 0
        ) {
          throw new Error(`Invoice ${alloc.invoiceId} tidak valid.`);
        }

        manualInvoices.push({ invoice, amount: alloc.amount });
      }
    }

    const fifoInvoices =
      manualInvoices.length > 0
        ? []
        : await tx
            .select()
            .from(invoices)
            .where(
              and(
                eq(invoices.studentId, validated.studentId),
                inArray(invoices.status, ["OPEN", "PARTIAL"]),
                gte(invoices.outstanding, 1),
                isNull(invoices.deletedAt),
              ),
            )
            .orderBy(asc(invoices.dueDate));

    if (
      manualInvoices.length === 0 &&
      fifoInvoices.length === 0 &&
      !validated.notes?.trim()
    ) {
      throw new Error("Deposit tanpa invoice wajib menyertakan catatan.");
    }

    let creditUsed = 0;
    let creditBefore = 0;
    let creditAfter = 0;
    const creditAllocationsResult: Array<{
      invoiceId: string;
      invoiceNo: string;
      amount: number;
    }> = [];
    if (validated.useCreditBalance) {
      const creditTargetInvoices =
        manualInvoices.length > 0
          ? manualInvoices.map((entry) => entry.invoice)
          : fifoInvoices;
      const [existingBalance] = await tx
        .select()
        .from(creditBalances)
        .where(eq(creditBalances.studentId, validated.studentId))
        .limit(1);

      let availableCredit = existingBalance?.amount ?? 0;
      creditBefore = availableCredit;
      for (const invoice of creditTargetInvoices) {
        if (availableCredit <= 0) break;
        const creditAmount = Math.min(invoice.outstanding, availableCredit);
        if (creditAmount <= 0) continue;

        await FinanceService.applyCreditToInvoice(tx, invoice, creditAmount);
        invoice.totalPaid += creditAmount;
        invoice.outstanding -= creditAmount;
        invoice.status = invoice.outstanding <= 0 ? "PAID" : "PARTIAL";
        availableCredit -= creditAmount;
        creditUsed += creditAmount;
        creditAllocationsResult.push({
          invoiceId: invoice.id,
          invoiceNo: invoice.invoiceNo,
          amount: creditAmount,
        });
      }

      if (existingBalance && creditUsed > 0) {
        creditAfter = existingBalance.amount - creditUsed;
        await tx
          .update(creditBalances)
          .set({
            amount: creditAfter,
            lastUsedAt: new Date(),
            updatedAt: new Date(),
            version: sql`${creditBalances.version} + 1`,
            syncStatus: "pending",
          })
          .where(eq(creditBalances.id, existingBalance.id));
      }
    }

    // 1. Create Payment Record (mapped to schema: date, amount)
    await tx.insert(payments).values({
      id: paymentId,
      paymentNo,
      studentId: validated.studentId,
      methodId: validated.methodId,
      amount: validated.amount,
      date: validated.date,
      referenceNo: idempotencyKey,
      notes: validated.notes,
      isConfirmed: true,
      confirmedAt: new Date(),
      confirmedBy: actorId,
      createdAt: new Date(),
      updatedAt: new Date(),
      syncStatus: "pending",
    });

    const allocationsResult: Array<{
      invoiceId: string;
      invoiceNo: string;
      amount: number;
    }> = [];

    // 2. Handle Allocations
    if (manualInvoices.length > 0) {
      // Manual
      for (const alloc of manualInvoices) {
        const assignAmount = Math.min(alloc.amount, remainingAmount);
        if (assignAmount <= 0) break;

        await FinanceService.applyAllocation(
          tx,
          paymentId,
          alloc.invoice,
          assignAmount,
        );
        remainingAmount -= assignAmount;
        allocationsResult.push({
          invoiceId: alloc.invoice.id,
          invoiceNo: alloc.invoice.invoiceNo,
          amount: assignAmount,
        });
      }
    } else {
      // FIFO (Oldest first)
      for (const invoice of fifoInvoices) {
        if (remainingAmount <= 0) break;

        const assignAmount = Math.min(invoice.outstanding, remainingAmount);
        await FinanceService.applyAllocation(
          tx,
          paymentId,
          invoice,
          assignAmount,
        );
        remainingAmount -= assignAmount;
        allocationsResult.push({
          invoiceId: invoice.id,
          invoiceNo: invoice.invoiceNo,
          amount: assignAmount,
        });
      }
    }

    const invoiceSettlementMap = new Map<
      string,
      {
        invoiceId: string;
        invoiceNo: string;
        cashAmount: number;
        creditAmount: number;
        totalSettled: number;
      }
    >();
    const ensureInvoiceSettlement = (invoiceId: string, invoiceNo: string) => {
      const existing = invoiceSettlementMap.get(invoiceId);
      if (existing) return existing;

      const next = {
        invoiceId,
        invoiceNo,
        cashAmount: 0,
        creditAmount: 0,
        totalSettled: 0,
      };
      invoiceSettlementMap.set(invoiceId, next);
      return next;
    };

    for (const allocation of creditAllocationsResult) {
      const settlement = ensureInvoiceSettlement(
        allocation.invoiceId,
        allocation.invoiceNo,
      );
      settlement.creditAmount += allocation.amount;
    }

    for (const allocation of allocationsResult) {
      const settlement = ensureInvoiceSettlement(
        allocation.invoiceId,
        allocation.invoiceNo,
      );
      settlement.cashAmount += allocation.amount;
    }

    const invoiceSettlements = Array.from(invoiceSettlementMap.values()).map(
      (settlement) => ({
        ...settlement,
        totalSettled: settlement.cashAmount + settlement.creditAmount,
      }),
    );

    // 3. Handle Overpayment (Credit)
    if (remainingAmount > 0) {
      const [existingBalance] = await tx
        .select()
        .from(creditBalances)
        .where(eq(creditBalances.studentId, validated.studentId))
        .limit(1);

      if (existingBalance) {
        await tx
          .update(creditBalances)
          .set({
            amount: existingBalance.amount + remainingAmount,
            updatedAt: new Date(),
            version: sql`${creditBalances.version} + 1`,
            syncStatus: "pending",
          })
          .where(eq(creditBalances.id, existingBalance.id));
      } else {
        await tx.insert(creditBalances).values({
          id: crypto.randomUUID(),
          studentId: validated.studentId,
          amount: remainingAmount,
          createdAt: new Date(),
          updatedAt: new Date(),
          syncStatus: "pending",
        });
      }
    }

    // 4. Generate Receipt with Audit Snapshot
    const receiptNo = await FinanceService.generateNo(
      tx,
      "RCP",
      receipts,
      receipts.receiptNo,
    );
    await tx.insert(receipts).values({
      id: crypto.randomUUID(),
      receiptNo,
      paymentId,
      snapshot: JSON.stringify({
        student: studentSnapshotData ? JSON.parse(studentSnapshotData) : null,
        allocations: allocationsResult,
        creditAllocations: creditAllocationsResult,
        invoiceSettlements,
        creditUsed,
        creditBefore,
        creditAfter,
        payment: {
          no: paymentNo,
          amount: validated.amount,
          date: validated.date,
        },
      }),
      createdAt: new Date(),
    });

    // PHASE 4: AUTO-POST Payment to Ledger
    await AccountingService.postPayment(tx, {
      id: paymentId,
      no: paymentNo,
      amount: validated.amount,
      methodName: method?.name || "Payment",
    });

    // 5. Audit Log
    await FinanceService.logEvent(tx, "PAYMENT_PROCESS", actorId, {
      paymentId,
      paymentNo,
      receiptNo,
      allocations: allocationsResult,
      creditAllocations: creditAllocationsResult,
      invoiceSettlements,
      creditUsed,
      creditBefore,
      creditAfter,
      cashPaid: validated.amount,
      credit: remainingAmount,
    });

    return {
      paymentId,
      paymentNo,
      receiptNo,
      credit: remainingAmount,
    };
  },

  async applyCreditToInvoices(
    actorId: string,
    input: ApplyCreditToInvoicesInput,
  ) {
    const validated = applyCreditToInvoicesSchema.parse(input);
    const db = await getDb();

    if (isTauri()) {
      return await FinanceService.applyCreditToInvoicesOnDb(
        db,
        actorId,
        validated,
      );
    }

    return await db.transaction(async (tx) => {
      return await FinanceService.applyCreditToInvoicesOnDb(
        tx,
        actorId,
        validated,
      );
    });
  },

  async applyCreditToInvoicesOnDb(
    // biome-ignore lint/suspicious/noExplicitAny: Internal TX or desktop DB object
    tx: any,
    actorId: string,
    validated: ApplyCreditToInvoicesInput,
  ) {
    const requestId = validated.requestId ?? crypto.randomUUID();
    const date = validated.date ?? new Date();

    const [existingLog] = await tx
      .select({ newData: financeLogs.newData })
      .from(financeLogs)
      .where(
        and(
          eq(financeLogs.action, "CREDIT_APPLIED"),
          like(financeLogs.newData, `%${requestId}%`),
          isNull(financeLogs.deletedAt),
        ),
      )
      .limit(1);

    if (existingLog?.newData) {
      try {
        const parsed = JSON.parse(existingLog.newData) as {
          creditReceiptNo?: string;
          creditUsed?: number;
          creditAfter?: number;
          allocations?: Array<{ invoiceId: string; amount: number }>;
        };
        return {
          creditReceiptNo: parsed.creditReceiptNo ?? "",
          creditUsed: parsed.creditUsed ?? 0,
          creditAfter: parsed.creditAfter ?? 0,
          allocations: parsed.allocations ?? [],
          duplicate: true,
        };
      } catch {
        throw new Error("Apply credit request sudah pernah diproses.");
      }
    }

    await FinanceControlService.validatePeriod(tx, date);

    const [student] = await tx
      .select({
        id: students.id,
        fullName: students.fullName,
        nis: students.nis,
      })
      .from(students)
      .where(
        and(eq(students.id, validated.studentId), isNull(students.deletedAt)),
      )
      .limit(1);
    if (!student?.id) {
      throw new Error("Siswa credit/deposit tidak ditemukan.");
    }

    const [balance] = await tx
      .select()
      .from(creditBalances)
      .where(
        and(
          eq(creditBalances.studentId, validated.studentId),
          isNull(creditBalances.deletedAt),
        ),
      )
      .limit(1);
    if (!balance || balance.amount <= 0) {
      throw new Error("Saldo credit/deposit siswa tidak tersedia.");
    }

    const requestedInvoiceIds = Array.from(new Set(validated.invoiceIds ?? []));
    const targetInvoices =
      requestedInvoiceIds.length > 0
        ? await tx
            .select()
            .from(invoices)
            .where(
              and(
                inArray(invoices.id, requestedInvoiceIds),
                eq(invoices.studentId, validated.studentId),
                inArray(invoices.status, ["OPEN", "PARTIAL"]),
                gte(invoices.outstanding, 1),
                isNull(invoices.deletedAt),
              ),
            )
            .orderBy(asc(invoices.dueDate))
        : await tx
            .select()
            .from(invoices)
            .where(
              and(
                eq(invoices.studentId, validated.studentId),
                inArray(invoices.status, ["OPEN", "PARTIAL"]),
                gte(invoices.outstanding, 1),
                isNull(invoices.deletedAt),
              ),
            )
            .orderBy(asc(invoices.dueDate));

    if (
      requestedInvoiceIds.length > 0 &&
      targetInvoices.length !== requestedInvoiceIds.length
    ) {
      throw new Error("Sebagian invoice tidak valid untuk apply credit.");
    }
    if (targetInvoices.length === 0) {
      throw new Error("Tidak ada invoice outstanding untuk apply credit.");
    }

    let remainingCredit = Math.min(
      balance.amount,
      validated.amount ?? balance.amount,
    );
    const allocations: Array<{
      invoiceId: string;
      invoiceNo: string;
      amount: number;
    }> = [];

    for (const invoice of targetInvoices) {
      if (remainingCredit <= 0) break;
      const creditAmount = Math.min(invoice.outstanding, remainingCredit);
      if (creditAmount <= 0) continue;

      await FinanceService.applyCreditToInvoice(tx, invoice, creditAmount);
      remainingCredit -= creditAmount;
      allocations.push({
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceNo,
        amount: creditAmount,
      });
    }

    const creditUsed = allocations.reduce(
      (sum, allocation) => sum + allocation.amount,
      0,
    );
    if (creditUsed <= 0) {
      throw new Error("Credit/deposit tidak terpakai pada invoice target.");
    }

    const creditAfter = balance.amount - creditUsed;
    await tx
      .update(creditBalances)
      .set({
        amount: creditAfter,
        lastUsedAt: date,
        updatedAt: new Date(),
        version: sql`${creditBalances.version} + 1`,
        syncStatus: "pending",
      })
      .where(eq(creditBalances.id, balance.id));

    const creditReceiptNo = `CRD/${format(date, "yyyy/MM")}/${Date.now().toString(36).toUpperCase()}/${buildDocNoSuffix()}`;
    await FinanceService.logEvent(tx, "CREDIT_APPLIED", actorId, {
      requestId,
      creditReceiptNo,
      studentId: validated.studentId,
      student: {
        fullName: student.fullName,
        nis: student.nis,
      },
      allocations,
      creditUsed,
      creditBefore: balance.amount,
      creditAfter,
      reason: validated.reason,
      type: "CREDIT_SETTLEMENT",
    });

    return {
      creditReceiptNo,
      creditUsed,
      creditAfter,
      allocations,
    };
  },

  /**
   * Internal helper to apply payment to an invoice and update its state.
   */
  async applyAllocation(
    // biome-ignore lint/suspicious/noExplicitAny: Internal TX object
    db: any,
    paymentId: string,
    // biome-ignore lint/suspicious/noExplicitAny: Invoice row object
    invoice: any,
    amount: number,
  ) {
    const newPaid = invoice.totalPaid + amount;
    const newOutstanding = invoice.totalAmount - newPaid;
    let newStatus = invoice.status;

    if (newOutstanding <= 0) {
      newStatus = "PAID";
    } else if (newPaid > 0) {
      newStatus = "PARTIAL";
    }

    await db.insert(paymentAllocations).values({
      id: crypto.randomUUID(),
      paymentId,
      invoiceId: invoice.id,
      amount,
      createdAt: new Date(),
    });

    await db
      .update(invoices)
      .set({
        totalPaid: newPaid,
        outstanding: newOutstanding,
        status: newStatus,
        updatedAt: new Date(),
        version: sql`${invoices.version} + 1`,
        syncStatus: "pending",
      })
      .where(eq(invoices.id, invoice.id));
  },

  async applyCreditToInvoice(
    // biome-ignore lint/suspicious/noExplicitAny: Internal TX object
    db: any,
    // biome-ignore lint/suspicious/noExplicitAny: Invoice row object
    invoice: any,
    amount: number,
  ) {
    const newPaid = invoice.totalPaid + amount;
    const newOutstanding = invoice.totalAmount - newPaid;
    const newStatus = newOutstanding <= 0 ? "PAID" : "PARTIAL";

    await db
      .update(invoices)
      .set({
        totalPaid: newPaid,
        outstanding: newOutstanding,
        status: newStatus,
        updatedAt: new Date(),
        version: sql`${invoices.version} + 1`,
        syncStatus: "pending",
      })
      .where(eq(invoices.id, invoice.id));
  },

  // ============================================
  // MASTER DATA SETUP
  // ============================================

  async setupBillingCategory(
    actorId: string,
    name: string,
    description?: string,
  ) {
    const db = await getDb();
    const id = crypto.randomUUID();
    await db.insert(billingCategories).values({
      id,
      name,
      description,
      isActive: true,
    });
    await FinanceService.logEvent(db, "CATEGORY_CREATE", actorId, { id, name });
    return id;
  },

  /**
   * PHASES 6: DASHBOARD ANALYTICS
   * Aggregates financial performance metrics.
   */
  async getDashboardSummary() {
    const db = await getDb();

    // 1. Total Receivables (Open + Partial)
    const receivablesData = await db
      .select({
        total: invoices.totalAmount,
        paid: invoices.totalPaid,
        outstanding: invoices.outstanding,
      })
      .from(invoices)
      .where(
        and(
          inArray(invoices.status, ["OPEN", "PARTIAL"]),
          isNull(invoices.deletedAt),
        ),
      );

    const totalReceivables = receivablesData.reduce(
      (sum, inv) => sum + inv.outstanding,
      0,
    );

    // 2. Revenue This Month + trend data
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const trendStart = new Date(startOfMonth);
    trendStart.setMonth(trendStart.getMonth() - 5);

    const paymentData = await db
      .select({
        total: payments.amount,
        date: payments.date,
      })
      .from(payments)
      .where(
        and(
          gte(payments.date, trendStart),
          eq(payments.isConfirmed, true),
          isNull(payments.deletedAt),
        ),
      );

    const revenue = paymentData
      .filter((payment) => {
        const paymentDate =
          payment.date instanceof Date ? payment.date : new Date(payment.date);
        return paymentDate.getTime() >= startOfMonth.getTime();
      })
      .reduce((sum, payment) => sum + payment.total, 0);

    const trendBuckets = new Map<string, number>();
    for (let offset = 5; offset >= 0; offset -= 1) {
      const bucketDate = new Date(startOfMonth);
      bucketDate.setMonth(bucketDate.getMonth() - offset);
      trendBuckets.set(format(bucketDate, "MMM").toUpperCase(), 0);
    }

    for (const payment of paymentData) {
      const paymentDate =
        payment.date instanceof Date ? payment.date : new Date(payment.date);
      const bucketLabel = format(paymentDate, "MMM").toUpperCase();
      if (trendBuckets.has(bucketLabel)) {
        trendBuckets.set(
          bucketLabel,
          (trendBuckets.get(bucketLabel) ?? 0) + payment.total,
        );
      }
    }

    // 3. Collection rate based on real invoice aggregates.
    const invoiceMetrics = await db
      .select({
        totalAmount: invoices.totalAmount,
        totalPaid: invoices.totalPaid,
      })
      .from(invoices)
      .where(
        and(
          inArray(invoices.status, ["OPEN", "PARTIAL", "PAID", "OVERPAID"]),
          isNull(invoices.deletedAt),
        ),
      );

    const billedAmount = invoiceMetrics.reduce(
      (sum, invoice) => sum + invoice.totalAmount,
      0,
    );
    const collectedAmount = invoiceMetrics.reduce(
      (sum, invoice) => sum + Math.min(invoice.totalPaid, invoice.totalAmount),
      0,
    );
    const collectionRate =
      billedAmount > 0 ? Math.min(1, collectedAmount / billedAmount) : 0;

    // 4. Active period should reflect the real finance period, not a static label.
    const [activePeriod] = await db
      .select({
        name: financePeriods.name,
        status: financePeriods.status,
        startDate: financePeriods.startDate,
      })
      .from(financePeriods)
      .where(
        and(
          inArray(financePeriods.status, ["OPEN", "SOFT_CLOSED"]),
          isNull(financePeriods.deletedAt),
        ),
      )
      .orderBy(desc(financePeriods.startDate))
      .limit(1);

    const [latestPeriod] = activePeriod
      ? [activePeriod]
      : await db
          .select({
            name: financePeriods.name,
            status: financePeriods.status,
            startDate: financePeriods.startDate,
          })
          .from(financePeriods)
          .where(isNull(financePeriods.deletedAt))
          .orderBy(desc(financePeriods.startDate))
          .limit(1);

    const effectivePeriod = latestPeriod ?? null;

    // 5. Distinguish seeded local master data from actual finance activity.
    const [paymentCountRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(payments)
      .where(and(eq(payments.isConfirmed, true), isNull(payments.deletedAt)));
    const [receiptCountRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(receipts)
      .where(isNull(receipts.deletedAt));
    const [journalCountRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(journalEntries)
      .where(isNull(journalEntries.deletedAt));
    const [approvalCountRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(approvalRequests)
      .where(isNull(approvalRequests.deletedAt));

    const paymentCount = paymentCountRow?.count ?? 0;
    const receiptCount = receiptCountRow?.count ?? 0;
    const journalCount = journalCountRow?.count ?? 0;
    const approvalCount = approvalCountRow?.count ?? 0;
    const totalOperationalRecords =
      invoiceMetrics.length +
      paymentCount +
      receiptCount +
      journalCount +
      approvalCount;

    const [pendingInvoiceRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(invoices)
      .where(
        and(eq(invoices.syncStatus, "pending"), isNull(invoices.deletedAt)),
      );
    const [pendingPaymentRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(payments)
      .where(
        and(eq(payments.syncStatus, "pending"), isNull(payments.deletedAt)),
      );
    const [pendingPeriodRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(financePeriods)
      .where(
        and(
          eq(financePeriods.syncStatus, "pending"),
          isNull(financePeriods.deletedAt),
        ),
      );
    const [pendingApprovalRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(approvalRequests)
      .where(
        and(
          eq(approvalRequests.syncStatus, "pending"),
          isNull(approvalRequests.deletedAt),
        ),
      );
    const [pendingJournalRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.syncStatus, "pending"),
          isNull(journalEntries.deletedAt),
        ),
      );

    return {
      revenue,
      receivables: totalReceivables,
      collectionRate,
      invoiceCount: receivablesData.length,
      paymentCount,
      activePeriodLabel: effectivePeriod
        ? effectivePeriod.name ||
          format(
            effectivePeriod.startDate instanceof Date
              ? effectivePeriod.startDate
              : new Date(effectivePeriod.startDate),
            "MMMM yyyy",
          )
        : null,
      activePeriodStatus: effectivePeriod?.status ?? null,
      revenueTrend: Array.from(trendBuckets.entries()).map(
        ([label, amount]) => ({
          label,
          amount,
        }),
      ),
      dataState:
        totalOperationalRecords > 0 ? ("live" as const) : ("seeded" as const),
      pendingSync:
        (pendingInvoiceRow?.count ?? 0) +
          (pendingPaymentRow?.count ?? 0) +
          (pendingPeriodRow?.count ?? 0) +
          (pendingApprovalRow?.count ?? 0) +
          (pendingJournalRow?.count ?? 0) >
        0,
    };
  },

  /**
   * PHASES 6: DATA LISTING
   */
  async getInvoices(filters: {
    status?: string;
    studentId?: string;
    search?: string;
  }) {
    const db = await getDb();

    const conditions = [isNull(invoices.deletedAt)];
    if (filters.status && filters.status !== "ALL") {
      // biome-ignore lint/suspicious/noExplicitAny: Status enum compatibility
      conditions.push(eq(invoices.status, filters.status as any));
    }
    if (filters.studentId) {
      conditions.push(eq(invoices.studentId, filters.studentId));
    }

    return await db
      .select({
        id: invoices.id,
        invoiceNo: invoices.invoiceNo,
        studentId: invoices.studentId,
        batchId: invoices.batchId,
        categoryId: invoices.categoryId,
        dueDate: invoices.dueDate,
        status: invoices.status,
        totalAmount: invoices.totalAmount,
        totalPaid: invoices.totalPaid,
        outstanding: invoices.outstanding,
        discountTotal: invoices.discountTotal,
        penaltyTotal: invoices.penaltyTotal,
        studentSnapshot: invoices.studentSnapshot,
        version: invoices.version,
        hlc: invoices.hlc,
        createdAt: invoices.createdAt,
        updatedAt: invoices.updatedAt,
        deletedAt: invoices.deletedAt,
        syncStatus: invoices.syncStatus,
        studentFullName: students.fullName,
        studentNis: students.nis,
        studentNisn: students.nisn,
        studentGrade: students.grade,
        studentClassName: classes.name,
        studentCreditBalance: creditBalances.amount,
      })
      .from(invoices)
      .leftJoin(
        students,
        and(eq(students.id, invoices.studentId), isNull(students.deletedAt)),
      )
      .leftJoin(
        classes,
        and(eq(classes.id, students.grade), isNull(classes.deletedAt)),
      )
      .leftJoin(
        creditBalances,
        and(
          eq(creditBalances.studentId, invoices.studentId),
          isNull(creditBalances.deletedAt),
        ),
      )
      .where(and(...conditions))
      .orderBy(desc(invoices.createdAt));
  },

  async getStudentOpenInvoices(studentId: string) {
    const db = await getDb();
    return await db
      .select({
        id: invoices.id,
        invoiceNo: invoices.invoiceNo,
        studentId: invoices.studentId,
        batchId: invoices.batchId,
        categoryId: invoices.categoryId,
        dueDate: invoices.dueDate,
        status: invoices.status,
        totalAmount: invoices.totalAmount,
        totalPaid: invoices.totalPaid,
        outstanding: invoices.outstanding,
        discountTotal: invoices.discountTotal,
        penaltyTotal: invoices.penaltyTotal,
        studentSnapshot: invoices.studentSnapshot,
        version: invoices.version,
        hlc: invoices.hlc,
        createdAt: invoices.createdAt,
        updatedAt: invoices.updatedAt,
        deletedAt: invoices.deletedAt,
        syncStatus: invoices.syncStatus,
        studentCreditBalance: creditBalances.amount,
      })
      .from(invoices)
      .leftJoin(
        creditBalances,
        and(
          eq(creditBalances.studentId, invoices.studentId),
          isNull(creditBalances.deletedAt),
        ),
      )
      .where(
        and(
          eq(invoices.studentId, studentId),
          inArray(invoices.status, ["OPEN", "PARTIAL"]),
          isNull(invoices.deletedAt),
        ),
      )
      .orderBy(asc(invoices.dueDate));
  },

  async getStudentsWithOutstandingInvoices(limit = 100) {
    const db = await getDb();
    const today = new Date();

    const rows = await db
      .select({
        id: students.id,
        nis: students.nis,
        fullName: students.fullName,
        grade: students.grade,
        className: classes.name,
        creditBalance: creditBalances.amount,
        invoiceCount: sql<number>`count(${invoices.id})`,
        totalOutstanding: sql<number>`coalesce(sum(${invoices.outstanding}), 0)`,
        oldestDueDate: sql<Date | null>`min(${invoices.dueDate})`,
        overdueCount: sql<number>`sum(case when ${invoices.dueDate} < ${today} then 1 else 0 end)`,
      })
      .from(invoices)
      .innerJoin(students, eq(students.id, invoices.studentId))
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
          inArray(invoices.status, ["OPEN", "PARTIAL"]),
          gte(invoices.outstanding, 1),
          isNull(invoices.deletedAt),
          isNull(students.deletedAt),
        ),
      )
      .groupBy(
        students.id,
        students.nis,
        students.fullName,
        students.grade,
        classes.name,
        creditBalances.amount,
      )
      .orderBy(
        desc(sql`coalesce(sum(${invoices.outstanding}), 0)`),
        asc(sql`min(${invoices.dueDate})`),
      )
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      nis: row.nis,
      fullName: row.fullName,
      grade: sanitizeClassDisplayName(row.className, row.grade),
      creditBalance: row.creditBalance ?? 0,
      invoiceCount: row.invoiceCount ?? 0,
      totalOutstanding: row.totalOutstanding ?? 0,
      netOutstanding: Math.max(
        (row.totalOutstanding ?? 0) - (row.creditBalance ?? 0),
        0,
      ),
      oldestDueDate: row.oldestDueDate,
      overdueCount: row.overdueCount ?? 0,
    }));
  },

  async getBillingCategories() {
    const db = await getDb();
    const categories = await db
      .select()
      .from(billingCategories)
      .where(
        and(
          eq(billingCategories.isActive, true),
          isNull(billingCategories.deletedAt),
        ),
      )
      .orderBy(desc(billingCategories.updatedAt), asc(billingCategories.name));

    const dedupedCategories = new Map<string, (typeof categories)[number]>();

    for (const category of categories) {
      const normalizedName = category.name
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
      if (!dedupedCategories.has(normalizedName)) {
        dedupedCategories.set(normalizedName, category);
      }
    }

    return Array.from(dedupedCategories.values());
  },

  async getPaymentMethods() {
    const db = await getDb();
    return await db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.isActive, true));
  },

  /**
   * Fetches all financial periods.
   */
  async getPeriods() {
    const db = await getDb();
    return await db
      .select()
      .from(financePeriods)
      .orderBy(desc(financePeriods.startDate));
  },

  /**
   * Fetches pending approval requests with target details.
   */
  async getApprovalRequests() {
    const db = await getDb();
    const requests = await db.query.approvalRequests.findMany({
      // biome-ignore lint/suspicious/noExplicitAny: Drizzle query builder callback typing is not inferred here.
      where: (approval: any, { eq }: any) => eq(approval.status, "PENDING"),
      with: {
        requestedBy: true,
      },
      // biome-ignore lint/suspicious/noExplicitAny: Drizzle query builder callback typing is not inferred here.
      orderBy: (approval: any, { desc }: any) => [desc(approval.createdAt)],
    });
    return requests;
  },

  /**
   * Fetches the institutional financial audit trail.
   */
  async getLogs() {
    const db = await getDb();
    return await db.query.financeLogs.findMany({
      with: {
        actor: true,
      },
      // biome-ignore lint/suspicious/noExplicitAny: Drizzle query builder callback typing is not inferred here.
      orderBy: (log: any, { desc }: any) => [desc(log.createdAt)],
    });
  },
};
