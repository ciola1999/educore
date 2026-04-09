import { format } from "date-fns";
import { and, asc, desc, eq, gte, inArray, isNull, like } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  billingBatches,
  billingCategories,
  creditBalances,
  financeLogs,
  financePeriods,
  invoiceItems,
  invoices,
  paymentAllocations,
  paymentMethods,
  payments,
  receipts,
  students,
  users,
} from "@/lib/db/schema";
import {
  type CreateBillingBatchInput,
  type CreateInvoiceInput,
  createBillingBatchSchema,
  createInvoiceSchema,
  type ProcessPaymentInput,
  processPaymentSchema,
} from "@/lib/validations/finance";
import { AccountingService } from "./accounting-service";
import { FinanceControlService } from "./finance-control-service";

/**
 * FinanceService (Core Unified Engine Phase 2.4 - 5.0)
 * The heart of EduCore Financials: Handling Billing, Payments, Ledger Posting, and Control.
 * Elite April 2026 Standards: Atomic, Audit-Ready, and Period-Aware.
 */
export const FinanceService = {
  /**
   * Generates a unique document number (Invoice, Payment, Receipt)
   * Pattern: PREFIX/YYYY/MM/SEQUENCE (e.g., INV/2026/04/0001)
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
      const parts = (last[0].no as string).split("/");
      const lastSeq = Number.parseInt(parts[parts.length - 1], 10);
      if (!Number.isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${base}/${seq.toString().padStart(4, "0")}`;
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
        id: students.id,
        fullName: students.fullName,
        nis: students.nis,
        nisn: students.nisn,
        grade: students.grade,
        parentName: students.parentName,
        photo: users.foto,
      })
      .from(students)
      .leftJoin(users, eq(students.id, users.id))
      .where(and(eq(students.id, studentId), isNull(students.deletedAt)))
      .limit(1);

    if (!studentData) return null;
    return JSON.stringify(studentData);
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

  /**
   * Generates multiple invoices at once for a selection of students (Batch).
   */
  async createBatchInvoices(actorId: string, input: CreateBillingBatchInput) {
    const validated = createBillingBatchSchema.parse(input);
    const db = await getDb();

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
      for (const studentId of validated.studentIds) {
        const studentSnapshot = await FinanceService.takeStudentSnapshot(
          tx,
          studentId,
        );
        if (!studentSnapshot) continue;

        const totalAmount = validated.items.reduce(
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

        // 1. Create Invoice
        await tx.insert(invoices).values({
          id: invoiceId,
          invoiceNo,
          studentId,
          batchId,
          categoryId: validated.categoryId,
          dueDate: validated.dueDate,
          totalAmount,
          outstanding: totalAmount,
          totalPaid: 0,
          status: "OPEN",
          studentSnapshot,
          createdAt: new Date(),
        });

        // 2. Create Items
        for (const item of validated.items) {
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
          description: validated.name,
        });

        results.push({ studentId, invoiceId, invoiceNo });
      }

      await FinanceService.logEvent(tx, "BATCH_INVOICE_GENERATE", actorId, {
        batchId,
        count: results.length,
      });

      return { batchId, processed: results.length };
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

      const totalAmount = validated.items.reduce(
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

      for (const item of validated.items) {
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

    return await db.transaction(async (tx) => {
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

      // Fetch Method for Ledger
      const [method] = await tx
        .select({ name: paymentMethods.name })
        .from(paymentMethods)
        .where(eq(paymentMethods.id, validated.methodId))
        .limit(1);

      // 1. Create Payment Record (mapped to schema: date, amount)
      await tx.insert(payments).values({
        id: paymentId,
        paymentNo,
        studentId: validated.studentId,
        methodId: validated.methodId,
        amount: validated.amount,
        date: validated.date,
        referenceNo: validated.referenceNo,
        notes: validated.notes,
        isConfirmed: true,
        createdAt: new Date(),
      });

      const allocationsResult = [];

      // 2. Handle Allocations
      if (validated.allocations && validated.allocations.length > 0) {
        // Manual
        for (const alloc of validated.allocations) {
          const [invoice] = await tx
            .select()
            .from(invoices)
            .where(eq(invoices.id, alloc.invoiceId))
            .limit(1);

          if (!invoice || invoice.studentId !== validated.studentId) {
            throw new Error(`Invoice ${alloc.invoiceId} tidak valid.`);
          }

          const assignAmount = Math.min(alloc.amount, remainingAmount);
          if (assignAmount <= 0) break;

          await FinanceService.applyAllocation(
            tx,
            paymentId,
            invoice,
            assignAmount,
          );
          remainingAmount -= assignAmount;
          allocationsResult.push({
            invoiceId: invoice.id,
            amount: assignAmount,
          });
        }
      } else {
        // FIFO (Oldest first)
        const openInvoices = await tx
          .select()
          .from(invoices)
          .where(
            and(
              eq(invoices.studentId, validated.studentId),
              inArray(invoices.status, ["OPEN", "PARTIAL"]),
              isNull(invoices.deletedAt),
            ),
          )
          .orderBy(asc(invoices.dueDate));

        for (const invoice of openInvoices) {
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
            amount: assignAmount,
          });
        }
      }

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
              syncStatus: "pending",
            })
            .where(eq(creditBalances.id, existingBalance.id));
        } else {
          await tx.insert(creditBalances).values({
            id: crypto.randomUUID(),
            studentId: validated.studentId,
            amount: remainingAmount,
            createdAt: new Date(),
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
        allocations: allocationsResult,
        credit: remainingAmount,
      });

      return { paymentId, paymentNo, receiptNo, credit: remainingAmount };
    });
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

    // 2. Revenue This Month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyRevenueData = await db
      .select({ total: payments.amount })
      .from(payments)
      .where(
        and(
          gte(payments.date, startOfMonth),
          eq(payments.isConfirmed, true),
          isNull(payments.deletedAt),
        ),
      );

    const revenue = monthlyRevenueData.reduce((sum, p) => sum + p.total, 0);

    return {
      revenue,
      receivables: totalReceivables,
      collectionRate: 0.85,
      invoiceCount: receivablesData.length,
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
      .select()
      .from(invoices)
      .where(and(...conditions))
      .orderBy(desc(invoices.createdAt));
  },

  async getStudentOpenInvoices(studentId: string) {
    const db = await getDb();
    return await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.studentId, studentId),
          inArray(invoices.status, ["OPEN", "PARTIAL"]),
          isNull(invoices.deletedAt),
        ),
      )
      .orderBy(asc(invoices.dueDate));
  },

  async getBillingCategories() {
    const db = await getDb();
    return await db
      .select()
      .from(billingCategories)
      .where(eq(billingCategories.isActive, true));
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
