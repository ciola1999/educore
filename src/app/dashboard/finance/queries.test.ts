import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const getDbMock = vi.hoisted(() => vi.fn());
const financeServiceMock = vi.hoisted(() => ({
  getDashboardSummary: vi.fn(),
  getInvoices: vi.fn(),
  getLogs: vi.fn(),
  getPaymentMethods: vi.fn(),
  getPeriods: vi.fn(),
  getApprovalRequests: vi.fn(),
}));
const accountingServiceMock = vi.hoisted(() => ({
  getJournalEntries: vi.fn(),
}));

vi.mock("@/lib/auth/web/auth", () => ({
  auth: authMock,
}));

vi.mock("@/core/db/connection", () => ({
  getDb: getDbMock,
}));

vi.mock("@/core/services/finance-service", () => ({
  FinanceService: financeServiceMock,
}));

vi.mock("@/core/services/accounting-service", () => ({
  AccountingService: accountingServiceMock,
}));

import { getFinanceDashboardSummary, getInvoices } from "./queries";

describe("finance queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.EDUCORE_DESKTOP_RUNTIME;
    authMock.mockResolvedValue({
      user: {
        id: "auditor-1",
        role: "auditor",
      },
    });
    const actorWhereMock = vi.fn().mockReturnValue({
      limit: vi
        .fn()
        .mockResolvedValue([
          { id: "auditor-1", role: "auditor", isActive: true },
        ]),
    });
    const actorFromMock = vi.fn().mockReturnValue({ where: actorWhereMock });
    const selectMock = vi.fn().mockReturnValue({ from: actorFromMock });
    getDbMock.mockResolvedValue({
      select: selectMock,
    });
  });

  it("returns the real finance dashboard summary from the service", async () => {
    financeServiceMock.getDashboardSummary.mockResolvedValue({
      revenue: 2500000,
      receivables: 750000,
      collectionRate: 0.82,
      invoiceCount: 12,
    });

    await expect(getFinanceDashboardSummary()).resolves.toEqual({
      revenue: 2500000,
      receivables: 750000,
      collectionRate: 0.82,
      invoiceCount: 12,
    });
  });

  it("derives overdue invoice status and applies search filtering in invoice list query", async () => {
    financeServiceMock.getInvoices.mockResolvedValue([
      {
        id: "invoice-1",
        invoiceNo: "INV-001",
        status: "OPEN",
        totalAmount: 200000,
        outstanding: 200000,
        dueDate: new Date("2026-01-01T00:00:00.000Z"),
        studentSnapshot: JSON.stringify({
          fullName: "Budi Santoso",
          nis: "1001",
        }),
      },
      {
        id: "invoice-2",
        invoiceNo: "INV-002",
        status: "PAID",
        totalAmount: 200000,
        outstanding: 0,
        dueDate: new Date("2026-12-01T00:00:00.000Z"),
        studentSnapshot: JSON.stringify({
          fullName: "Siti Aminah",
          nis: "1002",
        }),
      },
    ]);

    await expect(
      getInvoices({ status: "ALL", search: "budi" }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: "invoice-1",
        status: "OVERDUE",
        baseStatus: "OPEN",
      }),
    ]);
  });

  it("fails secure in embedded desktop runtime for finance reads", async () => {
    process.env.EDUCORE_DESKTOP_RUNTIME = "embedded-local-web-server";

    await expect(getFinanceDashboardSummary()).resolves.toEqual({
      revenue: 0,
      receivables: 0,
      collectionRate: 1.0,
      invoiceCount: 0,
    });

    expect(financeServiceMock.getDashboardSummary).not.toHaveBeenCalled();
  });
});
