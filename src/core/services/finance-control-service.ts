import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { isTauri } from "@/core/env";
import { getDb } from "@/lib/db";
import {
  approvalRequests,
  financeLogs,
  financePeriods,
  invoices,
} from "@/lib/db/schema";
import {
  type CreateFinancePeriodInput,
  createFinancePeriodSchema,
  FinancePeriodStatusEnum,
  type UpdateFinancePeriodStatusInput,
  updateFinancePeriodStatusSchema,
} from "@/lib/validations/finance";

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
  async approveRequest(actorId: string, requestId: string, reason?: string) {
    const db = await getDb();

    if (isTauri()) {
      const [req] = await db
        .select()
        .from(approvalRequests)
        .where(eq(approvalRequests.id, requestId))
        .limit(1);

      if (!req || req.status !== "PENDING") {
        throw new Error(
          "Permintaan persetujuan tidak valid atau sudah diproses.",
        );
      }

      await FinanceControlService.validatePeriod(db, new Date());

      if (
        req.targetType === "INVOICE" &&
        (req.type === "VOID" || req.type === "WRITEOFF")
      ) {
        await db
          .update(invoices)
          .set({
            status: req.type,
            updatedAt: new Date(),
            version: sql`${invoices.version} + 1`,
            syncStatus: "pending",
          })
          .where(eq(invoices.id, req.targetId));
      }

      await db
        .update(approvalRequests)
        .set({
          status: "APPROVED",
          handledBy: actorId,
          handledAt: new Date(),
          updatedAt: new Date(),
          version: sql`${approvalRequests.version} + 1`,
          syncStatus: "pending",
        })
        .where(eq(approvalRequests.id, requestId));

      await FinanceControlService.logControlEvent(
        db,
        `APPROVAL_${req.type}_APPROVED`,
        actorId,
        {
          requestId,
          targetId: req.targetId,
          targetType: req.targetType,
          reason: reason ?? null,
        },
      );

      return {
        success: true,
        status: "APPROVED" as const,
        requestId,
        targetId: req.targetId,
        targetType: req.targetType,
      };
    }

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
            version: sql`${invoices.version} + 1`,
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
          version: sql`${approvalRequests.version} + 1`,
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
          reason: reason ?? null,
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

  async rejectRequest(actorId: string, requestId: string, reason?: string) {
    const db = await getDb();

    if (isTauri()) {
      const [req] = await db
        .select()
        .from(approvalRequests)
        .where(eq(approvalRequests.id, requestId))
        .limit(1);

      if (!req || req.status !== "PENDING") {
        throw new Error(
          "Permintaan persetujuan tidak valid atau sudah diproses.",
        );
      }

      await db
        .update(approvalRequests)
        .set({
          status: "REJECTED",
          handledBy: actorId,
          handledAt: new Date(),
          updatedAt: new Date(),
          version: sql`${approvalRequests.version} + 1`,
          syncStatus: "pending",
        })
        .where(eq(approvalRequests.id, requestId));

      await FinanceControlService.logControlEvent(
        db,
        `APPROVAL_${req.type}_REJECTED`,
        actorId,
        {
          requestId,
          targetId: req.targetId,
          targetType: req.targetType,
          reason: reason ?? null,
        },
      );

      return {
        success: true,
        status: "REJECTED" as const,
        requestId,
        targetId: req.targetId,
        targetType: req.targetType,
      };
    }

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
          version: sql`${approvalRequests.version} + 1`,
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
          reason: reason ?? null,
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

  async createPeriod(actorId: string, input: CreateFinancePeriodInput) {
    const validated = createFinancePeriodSchema.parse(input);
    const db = await getDb();

    return await db.transaction(async (tx) => {
      const overlapping = await tx
        .select({
          id: financePeriods.id,
          name: financePeriods.name,
        })
        .from(financePeriods)
        .where(
          and(
            isNull(financePeriods.deletedAt),
            lte(financePeriods.startDate, validated.endDate),
            gte(financePeriods.endDate, validated.startDate),
          ),
        )
        .limit(1);

      if (overlapping[0]) {
        throw new Error(
          `Periode baru bentrok dengan periode '${overlapping[0].name}'.`,
        );
      }

      const id = crypto.randomUUID();
      await tx.insert(financePeriods).values({
        id,
        name: validated.name,
        startDate: validated.startDate,
        endDate: validated.endDate,
        status: "OPEN",
        createdAt: new Date(),
      });

      await FinanceControlService.logControlEvent(
        tx,
        "PERIOD_CREATED",
        actorId,
        {
          periodId: id,
          name: validated.name,
          startDate: validated.startDate,
          endDate: validated.endDate,
        },
      );

      return {
        id,
        name: validated.name,
        status: "OPEN" as const,
      };
    });
  },

  async updatePeriodStatus(
    actorId: string,
    periodId: string,
    input: UpdateFinancePeriodStatusInput,
  ) {
    const validated = updateFinancePeriodStatusSchema.parse(input);
    const db = await getDb();

    return await db.transaction(async (tx) => {
      const [period] = await tx
        .select()
        .from(financePeriods)
        .where(
          and(
            eq(financePeriods.id, periodId),
            isNull(financePeriods.deletedAt),
          ),
        )
        .limit(1);

      if (!period) {
        throw new Error("Periode keuangan tidak ditemukan.");
      }

      const currentStatus = FinancePeriodStatusEnum.parse(period.status);
      const nextStatus = validated.status;

      if (currentStatus === nextStatus) {
        return {
          success: true,
          periodId,
          previousStatus: currentStatus,
          nextStatus,
          noChange: true as const,
        };
      }

      const allowedTransitions: Record<
        typeof currentStatus,
        Array<typeof nextStatus>
      > = {
        OPEN: ["SOFT_CLOSED"],
        SOFT_CLOSED: ["OPEN", "CLOSED"],
        CLOSED: [],
      };

      if (!allowedTransitions[currentStatus].includes(nextStatus)) {
        throw new Error(
          `Transisi periode dari ${currentStatus} ke ${nextStatus} tidak diizinkan.`,
        );
      }

      await tx
        .update(financePeriods)
        .set({
          status: nextStatus,
          updatedAt: new Date(),
          version: sql`${financePeriods.version} + 1`,
          syncStatus: "pending",
        })
        .where(eq(financePeriods.id, periodId));

      await FinanceControlService.logControlEvent(
        tx,
        `PERIOD_${currentStatus}_TO_${nextStatus}`,
        actorId,
        {
          periodId,
          previousStatus: currentStatus,
          nextStatus,
          reason: validated.reason,
        },
      );

      return {
        success: true,
        periodId,
        previousStatus: currentStatus,
        nextStatus,
      };
    });
  },
};
