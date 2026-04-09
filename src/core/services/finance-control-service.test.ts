import { beforeEach, describe, expect, it, vi } from "vitest";

const getDbMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  getDb: getDbMock,
}));

import { approvalRequests, financeLogs, invoices } from "@/lib/db/schema";
import { FinanceControlService } from "./finance-control-service";

type FakeDbOptions = {
  selectResults: unknown[];
};

type FakeDb = {
  select: () => ReturnType<typeof createFakeQuery>;
  update: (table: unknown) => {
    set: (values: Record<string, unknown>) => {
      where: () => Promise<void>;
    };
  };
  insert: (table: unknown) => {
    values: (values: Record<string, unknown>) => Promise<void>;
  };
  transaction: <T>(callback: (tx: FakeDb) => Promise<T>) => Promise<T>;
  __meta: {
    invoiceUpdates: Array<Record<string, unknown>>;
    approvalUpdates: Array<Record<string, unknown>>;
    financeLogWrites: Array<Record<string, unknown>>;
  };
};

function createFakeQuery(result: unknown) {
  const query = Promise.resolve(result) as Promise<unknown> & {
    from: () => typeof query;
    where: () => typeof query;
    limit: () => Promise<unknown>;
  };

  query.from = () => query;
  query.where = () => query;
  query.limit = () => Promise.resolve(result);

  return query;
}

function createFakeDb(options: FakeDbOptions) {
  let selectCall = 0;
  const invoiceUpdates: Array<Record<string, unknown>> = [];
  const approvalUpdates: Array<Record<string, unknown>> = [];
  const financeLogWrites: Array<Record<string, unknown>> = [];

  const db: FakeDb = {
    select() {
      const result = options.selectResults[selectCall];
      selectCall += 1;
      return createFakeQuery(result);
    },
    update(table: unknown) {
      return {
        set(values: Record<string, unknown>) {
          return {
            where() {
              if (table === invoices) {
                invoiceUpdates.push(values);
              } else if (table === approvalRequests) {
                approvalUpdates.push(values);
              }

              return Promise.resolve();
            },
          };
        },
      };
    },
    insert(table: unknown) {
      return {
        values(values: Record<string, unknown>) {
          if (table === financeLogs) {
            financeLogWrites.push(values);
          }
          return Promise.resolve();
        },
      };
    },
    transaction<T>(callback: (tx: typeof db) => Promise<T>) {
      return callback(db);
    },
    __meta: {
      invoiceUpdates,
      approvalUpdates,
      financeLogWrites,
    },
  };

  return db;
}

describe("FinanceControlService", () => {
  beforeEach(() => {
    getDbMock.mockReset();
  });

  it("approves pending invoice void request and updates the invoice", async () => {
    const fakeDb = createFakeDb({
      selectResults: [
        [
          {
            id: "approval-1",
            status: "PENDING",
            type: "VOID",
            targetId: "invoice-1",
            targetType: "INVOICE",
          },
        ],
        [{ status: "OPEN", name: "April 2026" }],
      ],
    });
    getDbMock.mockResolvedValue(fakeDb);

    const result = await FinanceControlService.approveRequest(
      "admin-1",
      "approval-1",
    );

    expect(result).toEqual({
      success: true,
      status: "APPROVED",
      requestId: "approval-1",
      targetId: "invoice-1",
      targetType: "INVOICE",
    });
    expect(fakeDb.__meta.invoiceUpdates).toHaveLength(1);
    expect(fakeDb.__meta.invoiceUpdates[0]).toEqual(
      expect.objectContaining({
        status: "VOID",
        syncStatus: "pending",
      }),
    );
    expect(fakeDb.__meta.approvalUpdates).toHaveLength(1);
    expect(fakeDb.__meta.approvalUpdates[0]).toEqual(
      expect.objectContaining({
        status: "APPROVED",
        handledBy: "admin-1",
        syncStatus: "pending",
      }),
    );
    expect(fakeDb.__meta.financeLogWrites).toHaveLength(1);
    expect(fakeDb.__meta.financeLogWrites[0]).toEqual(
      expect.objectContaining({
        action: "APPROVAL_VOID_APPROVED",
        actorId: "admin-1",
      }),
    );
  });

  it("rejects pending request without mutating invoice status", async () => {
    const fakeDb = createFakeDb({
      selectResults: [
        [
          {
            id: "approval-2",
            status: "PENDING",
            type: "WRITEOFF",
            targetId: "invoice-2",
            targetType: "INVOICE",
          },
        ],
      ],
    });
    getDbMock.mockResolvedValue(fakeDb);

    const result = await FinanceControlService.rejectRequest(
      "admin-1",
      "approval-2",
    );

    expect(result).toEqual({
      success: true,
      status: "REJECTED",
      requestId: "approval-2",
      targetId: "invoice-2",
      targetType: "INVOICE",
    });
    expect(fakeDb.__meta.invoiceUpdates).toHaveLength(0);
    expect(fakeDb.__meta.approvalUpdates).toHaveLength(1);
    expect(fakeDb.__meta.approvalUpdates[0]).toEqual(
      expect.objectContaining({
        status: "REJECTED",
        handledBy: "admin-1",
        syncStatus: "pending",
      }),
    );
    expect(fakeDb.__meta.financeLogWrites).toHaveLength(1);
    expect(fakeDb.__meta.financeLogWrites[0]).toEqual(
      expect.objectContaining({
        action: "APPROVAL_WRITEOFF_REJECTED",
        actorId: "admin-1",
      }),
    );
  });

  it("throws when approval request is not pending", async () => {
    const fakeDb = createFakeDb({
      selectResults: [
        [
          {
            id: "approval-3",
            status: "APPROVED",
            type: "VOID",
            targetId: "invoice-3",
            targetType: "INVOICE",
          },
        ],
      ],
    });
    getDbMock.mockResolvedValue(fakeDb);

    await expect(
      FinanceControlService.approveRequest("admin-1", "approval-3"),
    ).rejects.toThrow(
      "Permintaan persetujuan tidak valid atau sudah diproses.",
    );

    expect(fakeDb.__meta.invoiceUpdates).toHaveLength(0);
    expect(fakeDb.__meta.approvalUpdates).toHaveLength(0);
    expect(fakeDb.__meta.financeLogWrites).toHaveLength(0);
  });
});
