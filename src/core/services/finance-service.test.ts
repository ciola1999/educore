import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getDbMock = vi.hoisted(() => vi.fn());
const isTauriMock = vi.hoisted(() => vi.fn(() => false));

vi.mock("@/lib/db", () => ({
  getDb: getDbMock,
}));

vi.mock("@/core/env", () => ({
  isTauri: isTauriMock,
}));

import { FinanceService } from "./finance-service";

function createGenerateNoDb(lastNumbers: string[]) {
  const limitMock = vi.fn().mockResolvedValue(
    lastNumbers.map((no) => ({
      no,
    })),
  );
  const orderByMock = vi.fn().mockReturnValue({
    limit: limitMock,
  });
  const whereMock = vi.fn().mockReturnValue({
    orderBy: orderByMock,
  });
  const fromMock = vi.fn().mockReturnValue({
    where: whereMock,
  });
  const selectMock = vi.fn().mockReturnValue({
    from: fromMock,
  });

  return {
    select: selectMock,
  };
}

describe("FinanceService.generateNo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-09T08:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("appends a unique suffix while preserving the monthly sequence", async () => {
    const db = createGenerateNoDb(["INV/2026/04/0009/ABC123"]);

    const result = await FinanceService.generateNo(
      db,
      "INV",
      { invoiceNo: "invoice_no" },
      "invoice_no",
    );

    expect(result).toMatch(/^INV\/2026\/04\/0010\/[A-Z0-9]{6}$/);
  });

  it("still increments correctly from legacy document numbers without suffix", async () => {
    const db = createGenerateNoDb(["PAY/2026/04/0007"]);

    const result = await FinanceService.generateNo(
      db,
      "PAY",
      { paymentNo: "payment_no" },
      "payment_no",
    );

    expect(result).toMatch(/^PAY\/2026\/04\/0008\/[A-Z0-9]{6}$/);
  });
});

describe("FinanceService.getBillingCategories", () => {
  it("deduplicates active billing categories by normalized name", async () => {
    const orderByMock = vi.fn().mockResolvedValue([
      {
        id: "cat-1",
        name: "SPP Bulanan",
        description: "Kategori terbaru",
        isActive: true,
        updatedAt: new Date("2026-04-18T10:00:00.000Z"),
        deletedAt: null,
      },
      {
        id: "cat-legacy",
        name: " spp   bulanan ",
        description: "Kategori legacy",
        isActive: true,
        updatedAt: new Date("2026-04-10T10:00:00.000Z"),
        deletedAt: null,
      },
      {
        id: "cat-2",
        name: "Daftar Ulang",
        description: "Kategori daftar ulang",
        isActive: true,
        updatedAt: new Date("2026-04-18T10:00:00.000Z"),
        deletedAt: null,
      },
    ]);
    const whereMock = vi.fn().mockReturnValue({
      orderBy: orderByMock,
    });
    const fromMock = vi.fn().mockReturnValue({
      where: whereMock,
    });
    const selectMock = vi.fn().mockReturnValue({
      from: fromMock,
    });

    getDbMock.mockResolvedValue({
      select: selectMock,
    });

    await expect(FinanceService.getBillingCategories()).resolves.toEqual([
      expect.objectContaining({
        id: "cat-1",
        name: "SPP Bulanan",
      }),
      expect.objectContaining({
        id: "cat-2",
        name: "Daftar Ulang",
      }),
    ]);
  });
});

describe("FinanceService.processPayment", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    isTauriMock.mockReturnValue(false);
  });

  it("uses the desktop non-transactional path in Tauri runtime", async () => {
    const transactionMock = vi.fn();
    const db = {
      transaction: transactionMock,
    };
    getDbMock.mockResolvedValue(db);
    isTauriMock.mockReturnValue(true);
    const processPaymentOnDbSpy = vi
      .spyOn(FinanceService, "processPaymentOnDb")
      .mockResolvedValue({
        paymentId: "payment-1",
        paymentNo: "PAY/2026/04/0001/ABC123",
        receiptNo: "RCP/2026/04/0001/ABC123",
        credit: 100000,
      });

    await expect(
      FinanceService.processPayment("staff-1", {
        studentId: "00000000-0000-4000-8000-000000000001",
        methodId: "00000000-0000-4000-8000-000000000002",
        amount: 200000,
        date: new Date("2026-04-30T10:00:00.000Z"),
        useCreditBalance: false,
      }),
    ).resolves.toEqual({
      paymentId: "payment-1",
      paymentNo: "PAY/2026/04/0001/ABC123",
      receiptNo: "RCP/2026/04/0001/ABC123",
      credit: 100000,
    });

    expect(transactionMock).not.toHaveBeenCalled();
    expect(processPaymentOnDbSpy).toHaveBeenCalledWith(
      db,
      "staff-1",
      expect.objectContaining({
        amount: 200000,
        studentId: "00000000-0000-4000-8000-000000000001",
      }),
    );
  });
});
