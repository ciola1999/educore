import { eq } from "drizzle-orm";
import { isTauri } from "@/core/env";
import type { getDb } from "@/lib/db";
import { getDb as getDatabase } from "@/lib/db";
import {
  accounts,
  financeLogs,
  journalEntries,
  journalLines,
} from "@/lib/db/schema";
import {
  type ManualJournalAdjustmentInput,
  manualJournalAdjustmentSchema,
} from "@/lib/validations/finance";
import { FinanceControlService } from "./finance-control-service";

type DbClient = Awaited<ReturnType<typeof getDb>>;
type DbWithJournalQuery = Pick<DbClient, "query" | "select">;
type AccountingTx = Pick<DbClient, "select" | "insert">;

/**
 * AccountingService (Auto-Posting Engine Phase 4.0)
 * Handles automatic generation of double-entry ledger entries.
 */
export const AccountingService = {
  /**
   * Internal helper to find account by name or code.
   * This handles standard accounting mappings for the EduCore platform.
   */
  async findAccount(db: AccountingTx, nameOrCode: string) {
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.code, nameOrCode))
      .limit(1);

    if (account) return account;

    // Fallback: search by name
    const [byName] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.name, nameOrCode))
      .limit(1);

    return byName;
  },

  /**
   * Posts GL entries for an Invoice.
   * Standard: Debit [AR (Accounts Receivable)], Credit [Revenue].
   */
  async postInvoice(
    tx: AccountingTx,
    data: {
      id: string;
      no: string;
      amount: number;
      description: string;
    },
  ) {
    const arAccount = await AccountingService.findAccount(tx, "10200"); // Standard AR Code
    const revAccount = await AccountingService.findAccount(tx, "40000"); // Standard Revenue Code

    if (!arAccount || !revAccount) {
      console.warn(
        "Unable to find standard accounts (10200/40000) for auto-posting. Skipping Ledger.",
      );
      return;
    }

    const journalId = crypto.randomUUID();

    // 1. Header
    await tx.insert(journalEntries).values({
      id: journalId,
      date: new Date(),
      description: `Auto-post Invoice: ${data.no} - ${data.description}`,
      referenceId: data.id,
      referenceType: "INVOICE",
      isAutoPost: true,
      createdAt: new Date(),
    });

    // 2. Debit AR
    await tx.insert(journalLines).values({
      id: crypto.randomUUID(),
      journalId,
      accountId: arAccount.id,
      debit: data.amount,
      credit: 0,
      createdAt: new Date(),
    });

    // 3. Credit Revenue
    await tx.insert(journalLines).values({
      id: crypto.randomUUID(),
      journalId,
      accountId: revAccount.id,
      debit: 0,
      credit: data.amount,
      createdAt: new Date(),
    });
  },

  /**
   * Posts GL entries for a Payment.
   * Standard: Debit [Cash/Bank], Credit [AR (Accounts Receivable)].
   */
  async postPayment(
    tx: AccountingTx,
    data: {
      id: string;
      no: string;
      amount: number;
      methodName: string;
    },
  ) {
    const cashAccount = await AccountingService.findAccount(tx, "10100"); // Standard Cash Code
    const arAccount = await AccountingService.findAccount(tx, "10200"); // Standard AR Code

    if (!cashAccount || !arAccount) {
      console.warn(
        "Unable to find standard accounts (10100/10200) for auto-posting. Skipping Ledger.",
      );
      return;
    }

    const journalId = crypto.randomUUID();

    // 1. Header
    await tx.insert(journalEntries).values({
      id: journalId,
      date: new Date(),
      description: `Auto-post Payment: ${data.no} - ${data.methodName}`,
      referenceId: data.id,
      referenceType: "PAYMENT",
      isAutoPost: true,
      createdAt: new Date(),
    });

    // 2. Debit Cash
    await tx.insert(journalLines).values({
      id: crypto.randomUUID(),
      journalId,
      accountId: cashAccount.id,
      debit: data.amount,
      credit: 0,
      createdAt: new Date(),
    });

    // 3. Credit AR
    await tx.insert(journalLines).values({
      id: crypto.randomUUID(),
      journalId,
      accountId: arAccount.id,
      debit: 0,
      credit: data.amount,
      createdAt: new Date(),
    });
  },

  /**
   * Fetches all journal entries with their lines and account details.
   */
  async getJournalEntries(db: DbWithJournalQuery) {
    const entries = await db.query.journalEntries.findMany({
      with: {
        lines: {
          with: {
            account: true,
          },
        },
      },
      orderBy: (journal, { desc }) => [desc(journal.date)],
    });
    return entries;
  },

  /**
   * Fetches full Chart of Accounts (COA).
   */
  async getAccounts(db: DbClient) {
    return await db.select().from(accounts).orderBy(accounts.code);
  },

  async createManualAdjustment(
    actorId: string,
    input: ManualJournalAdjustmentInput,
  ) {
    const validated = manualJournalAdjustmentSchema.parse(input);
    const db = await getDatabase();

    if (isTauri()) {
      return await AccountingService.createManualAdjustmentWithDb(
        db,
        actorId,
        validated,
      );
    }

    return await db.transaction((tx) =>
      AccountingService.createManualAdjustmentWithDb(tx, actorId, validated),
    );
  },

  async createManualAdjustmentWithDb(
    db: AccountingTx,
    actorId: string,
    validated: ManualJournalAdjustmentInput,
  ) {
    await FinanceControlService.validatePeriod(db, validated.date);

    const resolvedAccounts = await Promise.all(
      validated.lines.map(async (line) => {
        const [account] = await db
          .select()
          .from(accounts)
          .where(eq(accounts.id, line.accountId))
          .limit(1);

        return {
          ...line,
          account,
        };
      }),
    );

    const invalidAccount = resolvedAccounts.find((line) => !line.account);
    if (invalidAccount) {
      throw new Error("Salah satu akun adjustment tidak ditemukan.");
    }

    const now = new Date();
    const journalId = crypto.randomUUID();
    await db.insert(journalEntries).values({
      id: journalId,
      date: validated.date,
      description: validated.description,
      referenceId: null,
      referenceType: "MANUAL_ADJUSTMENT",
      isAutoPost: false,
      createdAt: now,
      updatedAt: now,
      syncStatus: "pending",
    });

    for (const line of resolvedAccounts) {
      const account = line.account;
      if (!account) {
        throw new Error("Salah satu akun adjustment tidak ditemukan.");
      }

      await db.insert(journalLines).values({
        id: crypto.randomUUID(),
        journalId,
        accountId: account.id,
        debit: line.debit,
        credit: line.credit,
        createdAt: now,
        updatedAt: now,
        syncStatus: "pending",
      });
    }

    await db.insert(financeLogs).values({
      id: crypto.randomUUID(),
      action: "MANUAL_JOURNAL_ADJUSTMENT_CREATED",
      actorId,
      newData: JSON.stringify({
        journalId,
        reason: validated.reason,
        description: validated.description,
        date: validated.date,
        lines: validated.lines,
      }),
      createdAt: now,
      updatedAt: now,
      syncStatus: "pending",
    });

    return {
      journalId,
      lineCount: validated.lines.length,
    };
  },
};
