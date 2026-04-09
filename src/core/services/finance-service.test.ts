import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getDbMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  getDb: getDbMock,
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
