import { describe, expect, it, vi } from "vitest";
import {
  approvalRequests,
  creditBalances,
  invoices,
  journalEntries,
  payments,
  receipts,
} from "@/lib/db/schema";
import { pullFromCloud } from "./turso-sync";

vi.mock("@/core/env", () => ({
  isWeb: () => false,
  isTauri: () => true,
}));

function createAwaitableQuery(
  directResult: unknown[],
  limitResolver: () => Promise<unknown[]>,
) {
  return Object.assign(Promise.resolve(directResult), {
    where: vi.fn(() => ({
      limit: vi.fn(limitResolver),
    })),
  });
}

describe("turso finance sync guards", () => {
  it("does not overwrite pending local finance rows during pull", async () => {
    const updates: Array<Record<string, unknown>> = [];

    const dbMock = {
      select: vi.fn(() => ({
        from: vi.fn((table: unknown) =>
          createAwaitableQuery([], async () => {
            if (table === invoices) {
              return [
                {
                  id: "local-invoice-1",
                  invoiceNo: "INV/2026/04/0001/LOCAL01",
                  updatedAt: new Date("2026-04-13T07:00:00.000Z"),
                  deletedAt: null,
                  syncStatus: "pending",
                },
              ];
            }

            return [];
          }),
        ),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(async () => {}),
      })),
      update: vi.fn(() => ({
        set: vi.fn((payload: Record<string, unknown>) => ({
          where: vi.fn(async () => {
            updates.push(payload);
          }),
        })),
      })),
    };

    const cloudMock = {
      execute: vi.fn(async (input: unknown) => {
        const sql =
          typeof input === "string"
            ? input
            : (input as { sql?: string }).sql || "";

        if (sql.includes('SELECT * FROM "invoices"')) {
          return {
            rows: [
              {
                id: "local-invoice-1",
                invoice_no: "INV/2026/04/0001/LOCAL01",
                status: "PAID",
                updated_at: 1_776_071_000,
              },
            ],
          };
        }

        return { rows: [] };
      }),
    };

    const result = await pullFromCloud({
      db: dbMock as never,
      tursoCloud: cloudMock as never,
      syncUsersProjection: vi.fn(async () => {}),
    });

    expect(result.status).toBe("success");
    expect(updates).toHaveLength(0);
  });

  it("does not overwrite pending local payments during pull", async () => {
    const updates: Array<Record<string, unknown>> = [];

    const dbMock = {
      select: vi.fn(() => ({
        from: vi.fn((table: unknown) =>
          createAwaitableQuery([], async () => {
            if (table === payments) {
              return [
                {
                  id: "local-payment-1",
                  paymentNo: "PAY/2026/04/0001/LOCAL01",
                  updatedAt: new Date("2026-04-13T07:15:00.000Z"),
                  deletedAt: null,
                  syncStatus: "pending",
                },
              ];
            }

            return [];
          }),
        ),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(async () => {}),
      })),
      update: vi.fn(() => ({
        set: vi.fn((payload: Record<string, unknown>) => ({
          where: vi.fn(async () => {
            updates.push(payload);
          }),
        })),
      })),
    };

    const cloudMock = {
      execute: vi.fn(async (input: unknown) => {
        const sql =
          typeof input === "string"
            ? input
            : (input as { sql?: string }).sql || "";

        if (sql.includes('SELECT * FROM "payments"')) {
          return {
            rows: [
              {
                id: "local-payment-1",
                payment_no: "PAY/2026/04/0001/LOCAL01",
                amount: 250000,
                updated_at: 1_776_071_500,
              },
            ],
          };
        }

        return { rows: [] };
      }),
    };

    const result = await pullFromCloud({
      db: dbMock as never,
      tursoCloud: cloudMock as never,
      syncUsersProjection: vi.fn(async () => {}),
    });

    expect(result.status).toBe("success");
    expect(updates).toHaveLength(0);
  });

  it("does not overwrite pending local approval requests during pull", async () => {
    const updates: Array<Record<string, unknown>> = [];

    const dbMock = {
      select: vi.fn(() => ({
        from: vi.fn((table: unknown) =>
          createAwaitableQuery([], async () => {
            if (table === approvalRequests) {
              return [
                {
                  id: "local-approval-1",
                  status: "PENDING",
                  type: "VOID",
                  targetId: "invoice-10",
                  targetType: "INVOICE",
                  requestedBy: "user-1",
                  updatedAt: new Date("2026-04-13T07:20:00.000Z"),
                  deletedAt: null,
                  syncStatus: "pending",
                },
              ];
            }

            return [];
          }),
        ),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(async () => {}),
      })),
      update: vi.fn(() => ({
        set: vi.fn((payload: Record<string, unknown>) => ({
          where: vi.fn(async () => {
            updates.push(payload);
          }),
        })),
      })),
    };

    const cloudMock = {
      execute: vi.fn(async (input: unknown) => {
        const sql =
          typeof input === "string"
            ? input
            : (input as { sql?: string }).sql || "";

        if (sql.includes('SELECT * FROM "approval_requests"')) {
          return {
            rows: [
              {
                id: "local-approval-1",
                status: "APPROVED",
                type: "VOID",
                target_id: "invoice-10",
                target_type: "INVOICE",
                requested_by: "user-1",
                updated_at: 1_776_071_700,
              },
            ],
          };
        }

        return { rows: [] };
      }),
    };

    const result = await pullFromCloud({
      db: dbMock as never,
      tursoCloud: cloudMock as never,
      syncUsersProjection: vi.fn(async () => {}),
    });

    expect(result.status).toBe("success");
    expect(updates).toHaveLength(0);
  });

  it("does not overwrite pending local journal entries during pull", async () => {
    const updates: Array<Record<string, unknown>> = [];

    const dbMock = {
      select: vi.fn(() => ({
        from: vi.fn((table: unknown) =>
          createAwaitableQuery([], async () => {
            if (table === journalEntries) {
              return [
                {
                  id: "local-journal-1",
                  description: "Koreksi saldo kas",
                  referenceType: "MANUAL_ADJUSTMENT",
                  referenceId: null,
                  updatedAt: new Date("2026-04-13T07:25:00.000Z"),
                  deletedAt: null,
                  syncStatus: "pending",
                },
              ];
            }

            return [];
          }),
        ),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(async () => {}),
      })),
      update: vi.fn(() => ({
        set: vi.fn((payload: Record<string, unknown>) => ({
          where: vi.fn(async () => {
            updates.push(payload);
          }),
        })),
      })),
    };

    const cloudMock = {
      execute: vi.fn(async (input: unknown) => {
        const sql =
          typeof input === "string"
            ? input
            : (input as { sql?: string }).sql || "";

        if (sql.includes('SELECT * FROM "journal_entries"')) {
          return {
            rows: [
              {
                id: "local-journal-1",
                description: "Koreksi saldo kas",
                reference_type: "MANUAL_ADJUSTMENT",
                reference_id: null,
                updated_at: 1_776_071_900,
              },
            ],
          };
        }

        return { rows: [] };
      }),
    };

    const result = await pullFromCloud({
      db: dbMock as never,
      tursoCloud: cloudMock as never,
      syncUsersProjection: vi.fn(async () => {}),
    });

    expect(result.status).toBe("success");
    expect(updates).toHaveLength(0);
  });

  it("does not overwrite pending local receipts during pull", async () => {
    const updates: Array<Record<string, unknown>> = [];

    const dbMock = {
      select: vi.fn(() => ({
        from: vi.fn((table: unknown) =>
          createAwaitableQuery([], async () => {
            if (table === receipts) {
              return [
                {
                  id: "local-receipt-1",
                  receiptNo: "RCP/2026/04/0001/LOCAL01",
                  updatedAt: new Date("2026-04-13T07:30:00.000Z"),
                  deletedAt: null,
                  syncStatus: "pending",
                },
              ];
            }

            return [];
          }),
        ),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(async () => {}),
      })),
      update: vi.fn(() => ({
        set: vi.fn((payload: Record<string, unknown>) => ({
          where: vi.fn(async () => {
            updates.push(payload);
          }),
        })),
      })),
    };

    const cloudMock = {
      execute: vi.fn(async (input: unknown) => {
        const sql =
          typeof input === "string"
            ? input
            : (input as { sql?: string }).sql || "";

        if (sql.includes('SELECT * FROM "receipts"')) {
          return {
            rows: [
              {
                id: "local-receipt-1",
                receipt_no: "RCP/2026/04/0001/LOCAL01",
                updated_at: 1_776_072_100,
              },
            ],
          };
        }

        return { rows: [] };
      }),
    };

    const result = await pullFromCloud({
      db: dbMock as never,
      tursoCloud: cloudMock as never,
      syncUsersProjection: vi.fn(async () => {}),
    });

    expect(result.status).toBe("success");
    expect(updates).toHaveLength(0);
  });

  it("does not overwrite pending local credit balances during pull", async () => {
    const updates: Array<Record<string, unknown>> = [];

    const dbMock = {
      select: vi.fn(() => ({
        from: vi.fn((table: unknown) =>
          createAwaitableQuery([], async () => {
            if (table === creditBalances) {
              return [
                {
                  id: "local-credit-1",
                  studentId: "student-1",
                  balance: 50000,
                  updatedAt: new Date("2026-04-13T07:35:00.000Z"),
                  deletedAt: null,
                  syncStatus: "pending",
                },
              ];
            }

            return [];
          }),
        ),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(async () => {}),
      })),
      update: vi.fn(() => ({
        set: vi.fn((payload: Record<string, unknown>) => ({
          where: vi.fn(async () => {
            updates.push(payload);
          }),
        })),
      })),
    };

    const cloudMock = {
      execute: vi.fn(async (input: unknown) => {
        const sql =
          typeof input === "string"
            ? input
            : (input as { sql?: string }).sql || "";

        if (sql.includes('SELECT * FROM "credit_balances"')) {
          return {
            rows: [
              {
                id: "local-credit-1",
                student_id: "student-1",
                balance: 25000,
                updated_at: 1_776_072_300,
              },
            ],
          };
        }

        return { rows: [] };
      }),
    };

    const result = await pullFromCloud({
      db: dbMock as never,
      tursoCloud: cloudMock as never,
      syncUsersProjection: vi.fn(async () => {}),
    });

    expect(result.status).toBe("success");
    expect(updates).toHaveLength(0);
  });
});
