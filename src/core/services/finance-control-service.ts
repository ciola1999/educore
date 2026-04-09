import { and, eq, gte, isNull, lte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  approvalRequests,
  financeLogs,
  financePeriods,
  invoices,
} from "@/lib/db/schema";

/**
 * FinanceControlService (Control & Audit Phase 5.0)
 * Manages financial period locking and sensitive action approvals.
 */
export const FinanceControlService = {
  async logControlEvent(
    // biome-ignore lint/suspicious/noExplicitAny: Internal TX or DB object
    db: any,
    action: string,
    actorId: string,
    payload: unknown,
  ) {
    await db.insert(financeLogs).values({
      id: crypto.randomUUID(),
      action,
      actorId,
      newData: JSON.stringify(payload),
      createdAt: new Date(),
    });
  },

  /**
   * Validates if a specific date is within an OPEN financial period.
   * Throws Error if period is closed or soft-closed.
   */
  // biome-ignore lint/suspicious/noExplicitAny: Internal TX or DB object
  async validatePeriod(db: any, date: Date) {
    const [period] = await db
      .select({ status: financePeriods.status, name: financePeriods.name })
      .from(financePeriods)
      .where(
        and(
          lte(financePeriods.startDate, date),
          gte(financePeriods.endDate, date),
          isNull(financePeriods.deletedAt),
        ),
      )
      .limit(1);

    if (!period) return true;

    if (period.status === "CLOSED" || period.status === "SOFT_CLOSED") {
      throw new Error(
        `Transaksi ditolak: Periode keuangan '${period.name}' telah ditutup.`,
      );
    }

    return true;
  },

  /**
   * Submits a request for a sensitive financial action.
   */
  async submitApprovalRequest(
    // biome-ignore lint/suspicious/noExplicitAny: Internal TX or DB object
    db: any,
    data: {
      type: "VOID" | "REFUND" | "WRITEOFF";
      requestedBy: string;
      targetId: string;
      targetType: string;
      payload?: unknown;
    },
  ) {
    const id = crypto.randomUUID();

    await db.insert(approvalRequests).values({
      id,
      type: data.type,
      requestedBy: data.requestedBy,
      targetId: data.targetId,
      targetType: data.targetType,
      payload: data.payload ? JSON.stringify(data.payload) : null,
      status: "PENDING",
      createdAt: new Date(),
    });

    return id;
  },

  /**
   * Convenience helper for non-transactional approval submissions.
   */
  async submitApprovalRequestStandalone(data: {
    type: "VOID" | "REFUND" | "WRITEOFF";
    requestedBy: string;
    targetId: string;
    targetType: string;
    payload?: unknown;
  }) {
    const db = await getDb();
    return await FinanceControlService.submitApprovalRequest(db, data);
  },

  /**
   * Approves and processes a pending request.
   * Only for authorized roles.
   */
  async approveRequest(actorId: string, requestId: string) {
    const db = await getDb();

    return await db.transaction(async (tx) => {
      const [req] = await tx
        .select()
        .from(approvalRequests)
        .where(eq(approvalRequests.id, requestId))
        .limit(1);

      if (!req || req.status !== "PENDING") {
        throw new Error(
          "Permintaan persetujuan tidak valid atau sudah diproses.",
        );
      }

      await FinanceControlService.validatePeriod(tx, new Date());

      if (
        req.targetType === "INVOICE" &&
        (req.type === "VOID" || req.type === "WRITEOFF")
      ) {
        await tx
          .update(invoices)
          .set({
            status: req.type,
            updatedAt: new Date(),
            syncStatus: "pending",
          })
          .where(eq(invoices.id, req.targetId));
      }

      await tx
        .update(approvalRequests)
        .set({
          status: "APPROVED",
          handledBy: actorId,
          handledAt: new Date(),
          updatedAt: new Date(),
          syncStatus: "pending",
        })
        .where(eq(approvalRequests.id, requestId));

      await FinanceControlService.logControlEvent(
        tx,
        `APPROVAL_${req.type}_APPROVED`,
        actorId,
        {
          requestId,
          targetId: req.targetId,
          targetType: req.targetType,
        },
      );

      return {
        success: true,
        status: "APPROVED" as const,
        requestId,
        targetId: req.targetId,
        targetType: req.targetType,
      };
    });
  },

  async rejectRequest(actorId: string, requestId: string) {
    const db = await getDb();

    return await db.transaction(async (tx) => {
      const [req] = await tx
        .select()
        .from(approvalRequests)
        .where(eq(approvalRequests.id, requestId))
        .limit(1);

      if (!req || req.status !== "PENDING") {
        throw new Error(
          "Permintaan persetujuan tidak valid atau sudah diproses.",
        );
      }

      await tx
        .update(approvalRequests)
        .set({
          status: "REJECTED",
          handledBy: actorId,
          handledAt: new Date(),
          updatedAt: new Date(),
          syncStatus: "pending",
        })
        .where(eq(approvalRequests.id, requestId));

      await FinanceControlService.logControlEvent(
        tx,
        `APPROVAL_${req.type}_REJECTED`,
        actorId,
        {
          requestId,
          targetId: req.targetId,
          targetType: req.targetType,
        },
      );

      return {
        success: true,
        status: "REJECTED" as const,
        requestId,
        targetId: req.targetId,
        targetType: req.targetType,
      };
    });
  },

  async getFinancePeriods() {
    const db = await getDb();
    return await db
      .select()
      .from(financePeriods)
      .where(isNull(financePeriods.deletedAt));
  },

  async getApprovalRequests() {
    const db = await getDb();
    return await db
      .select()
      .from(approvalRequests)
      .orderBy(approvalRequests.createdAt);
  },
};
