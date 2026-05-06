import { beforeEach, describe, expect, it, vi } from "vitest";

const getDbMock = vi.hoisted(() => vi.fn());
const validatePeriodMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  getDb: getDbMock,
}));

vi.mock("./finance-control-service", () => ({
  FinanceControlService: {
    validatePeriod: validatePeriodMock,
  },
}));

import { financeLogs, journalEntries, journalLines } from "@/lib/db/schema";
import { AccountingService } from "./accounting-service";

type FakeDbOptions = {
  selectResults: unknown[];
};

type FakeDb = {
  select: () => ReturnType<typeof createFakeQuery>;
  insert: (table: unknown) => {
    values: (values: Record<string, unknown>) => Promise<void>;
  };
  transaction: <T>(callback: (tx: FakeDb) => Promise<T>) => Promise<T>;
  __meta: {
    journalEntryWrites: Array<Record<string, unknown>>;
    journalLineWrites: Array<Record<string, unknown>>;
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
  const journalEntryWrites: Array<Record<string, unknown>> = [];
  const journalLineWrites: Array<Record<string, unknown>> = [];
  const financeLogWrites: Array<Record<string, unknown>> = [];

  const db: FakeDb = {
    select() {
      const result = options.selectResults[selectCall];
      selectCall += 1;
      return createFakeQuery(result);
    },
    insert(table: unknown) {
      return {
        values(values: Record<string, unknown>) {
          if (table === journalEntries) {
            journalEntryWrites.push(values);
          } else if (table === journalLines) {
            journalLineWrites.push(values);
          } else if (table === financeLogs) {
            financeLogWrites.push(values);
          }

          return Promise.resolve();
        },
      };
    },
    transaction<T>(callback: (tx: FakeDb) => Promise<T>) {
      return callback(db);
    },
    __meta: {
      journalEntryWrites,
      journalLineWrites,
      financeLogWrites,
    },
  };

  return db;
}

describe("AccountingService.createManualAdjustment", () => {
  beforeEach(() => {
    getDbMock.mockReset();
    validatePeriodMock.mockReset();
    validatePeriodMock.mockResolvedValue(true);
  });

  it("creates a balanced manual adjustment and writes audit log", async () => {
    const fakeDb = createFakeDb({
      selectResults: [
        [
          {
            id: "account-cash",
            code: "10100",
            name: "Cash",
            type: "ASSET",
          },
        ],
        [
          {
            id: "account-revenue",
            code: "40000",
            name: "Revenue",
            type: "REVENUE",
          },
        ],
      ],
    });
    getDbMock.mockResolvedValue(fakeDb);

    const result = await AccountingService.createManualAdjustment("admin-1", {
      date: new Date("2026-04-13T00:00:00.000Z"),
      description: "Koreksi penerimaan kas",
      reason: "Penyesuaian hasil audit kas harian.",
      lines: [
        {
          accountId: "550e8400-e29b-41d4-a716-446655440000",
          debit: 150000,
          credit: 0,
        },
        {
          accountId: "550e8400-e29b-41d4-a716-446655440001",
          debit: 0,
          credit: 150000,
        },
      ],
    });

    expect(validatePeriodMock).toHaveBeenCalledWith(
      fakeDb,
      new Date("2026-04-13T00:00:00.000Z"),
    );
    expect(result).toEqual({
      journalId: expect.any(String),
      lineCount: 2,
    });
    expect(fakeDb.__meta.journalEntryWrites).toHaveLength(1);
    expect(fakeDb.__meta.journalEntryWrites[0]).toEqual(
      expect.objectContaining({
        description: "Koreksi penerimaan kas",
        referenceType: "MANUAL_ADJUSTMENT",
        isAutoPost: false,
      }),
    );
    expect(fakeDb.__meta.journalLineWrites).toHaveLength(2);
    expect(fakeDb.__meta.financeLogWrites[0]).toEqual(
      expect.objectContaining({
        action: "MANUAL_JOURNAL_ADJUSTMENT_CREATED",
        actorId: "admin-1",
      }),
    );
    expect(fakeDb.__meta.financeLogWrites[0]?.newData).toContain(
      '"reason":"Penyesuaian hasil audit kas harian."',
    );
  });

  it("rejects the adjustment when one of the account ids does not exist", async () => {
    const fakeDb = createFakeDb({
      selectResults: [[{ id: "account-cash" }], []],
    });
    getDbMock.mockResolvedValue(fakeDb);

    await expect(
      AccountingService.createManualAdjustment("admin-1", {
        date: new Date("2026-04-13T00:00:00.000Z"),
        description: "Koreksi kas",
        reason: "Perbaikan jurnal.",
        lines: [
          {
            accountId: "550e8400-e29b-41d4-a716-446655440000",
            debit: 1000,
            credit: 0,
          },
          {
            accountId: "550e8400-e29b-41d4-a716-446655440001",
            debit: 0,
            credit: 1000,
          },
        ],
      }),
    ).rejects.toThrow("Salah satu akun adjustment tidak ditemukan.");

    expect(fakeDb.__meta.journalEntryWrites).toHaveLength(0);
    expect(fakeDb.__meta.financeLogWrites).toHaveLength(0);
  });

  it("rejects unbalanced journal lines before any database write", async () => {
    const fakeDb = createFakeDb({
      selectResults: [],
    });
    getDbMock.mockResolvedValue(fakeDb);

    await expect(
      AccountingService.createManualAdjustment("admin-1", {
        date: new Date("2026-04-13T00:00:00.000Z"),
        description: "Koreksi jurnal",
        reason: "Perbaikan mismatch.",
        lines: [
          {
            accountId: "550e8400-e29b-41d4-a716-446655440000",
            debit: 1000,
            credit: 0,
          },
          {
            accountId: "550e8400-e29b-41d4-a716-446655440001",
            debit: 0,
            credit: 900,
          },
        ],
      }),
    ).rejects.toThrow("Total debit dan kredit harus seimbang");

    expect(validatePeriodMock).not.toHaveBeenCalled();
    expect(fakeDb.__meta.journalEntryWrites).toHaveLength(0);
  });
});
