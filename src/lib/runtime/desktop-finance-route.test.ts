import { beforeEach, describe, expect, it, vi } from "vitest";

const getDbMock = vi.hoisted(() => vi.fn());
const getStateMock = vi.hoisted(() => vi.fn());
const createBatchInvoicesMock = vi.hoisted(() => vi.fn());
const createPeriodMock = vi.hoisted(() => vi.fn());
const createManualAdjustmentMock = vi.hoisted(() => vi.fn());
const approveRequestMock = vi.hoisted(() => vi.fn());
const getBatchStudentCandidatesMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  getDb: getDbMock,
}));

vi.mock("@/lib/store/use-store", () => ({
  useStore: {
    getState: getStateMock,
  },
}));

vi.mock("@/core/services/finance-service", () => ({
  FinanceService: {
    getDashboardSummary: vi.fn(),
    getInvoices: vi.fn(),
    getLogs: vi.fn(),
    getPaymentMethods: vi.fn(),
    getPeriods: vi.fn(),
    getApprovalRequests: vi.fn(),
    getBillingCategories: vi.fn(),
    getBatchStudentCandidates: getBatchStudentCandidatesMock,
    getStudentOpenInvoices: vi.fn(),
    createBatchInvoices: createBatchInvoicesMock,
    processPayment: vi.fn(),
    updateInvoiceStatus: vi.fn(),
  },
}));

vi.mock("@/core/services/finance-control-service", () => ({
  FinanceControlService: {
    createPeriod: createPeriodMock,
    updatePeriodStatus: vi.fn(),
    approveRequest: approveRequestMock,
    rejectRequest: vi.fn(),
  },
}));

vi.mock("@/core/services/accounting-service", () => ({
  AccountingService: {
    getJournalEntries: vi.fn(),
    getAccounts: vi.fn(),
    createManualAdjustment: createManualAdjustmentMock,
  },
}));

import { handleDesktopFinanceRoute } from "./desktop-finance-route";

describe("desktop finance route", () => {
  const ensurePermission = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    ensurePermission.mockReturnValue(null);
    getStateMock.mockReturnValue({
      user: {
        id: "staff-1",
      },
    });
  });

  function mockActor(role: string) {
    const whereMock = vi.fn().mockReturnValue({
      limit: vi
        .fn()
        .mockResolvedValue([{ id: "staff-1", role, isActive: true }]),
    });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    getDbMock.mockResolvedValue({
      select: selectMock,
    });
  }

  function mockActorWithStudentResolution(role: string, studentIds: string[]) {
    const actorWhereMock = vi.fn().mockReturnValue({
      limit: vi
        .fn()
        .mockResolvedValue([{ id: "staff-1", role, isActive: true }]),
    });
    const actorFromMock = vi.fn().mockReturnValue({ where: actorWhereMock });

    const studentWhereMock = vi
      .fn()
      .mockResolvedValue(studentIds.map((id) => ({ id })));
    const studentFromMock = vi
      .fn()
      .mockReturnValue({ where: studentWhereMock });

    const selectMock = vi
      .fn()
      .mockReturnValueOnce({ from: actorFromMock })
      .mockReturnValueOnce({ from: studentFromMock });

    getDbMock.mockResolvedValue({
      select: selectMock,
    });
  }

  it("blocks finance period creation for non-admin desktop actors", async () => {
    mockActor("staff");

    await expect(
      handleDesktopFinanceRoute(
        new URL("http://desktop.local/api/finance/periods"),
        "POST",
        ["api", "finance", "periods"],
        {
          actorId: "staff-1",
          name: "Q3 2026",
          startDate: new Date("2026-07-01T00:00:00.000Z"),
          endDate: new Date("2026-09-30T00:00:00.000Z"),
        },
        {
          ensurePermission,
        },
      ),
    ).rejects.toThrow(
      "Akses ditolak. Hanya admin finance yang boleh memproses approval request.",
    );

    expect(ensurePermission).toHaveBeenCalledWith("finance:write");
    expect(createPeriodMock).not.toHaveBeenCalled();
  });

  it("blocks manual adjustments for non-admin desktop actors", async () => {
    mockActor("staff");

    await expect(
      handleDesktopFinanceRoute(
        new URL("http://desktop.local/api/finance/accounting/adjustments"),
        "POST",
        ["api", "finance", "accounting", "adjustments"],
        {
          actorId: "staff-1",
          description: "Koreksi saldo",
          reason: "Audit harian.",
          date: new Date("2026-04-17T00:00:00.000Z"),
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
        },
        {
          ensurePermission,
        },
      ),
    ).rejects.toThrow(
      "Akses ditolak. Hanya admin finance yang boleh memproses approval request.",
    );

    expect(createManualAdjustmentMock).not.toHaveBeenCalled();
  });

  it("allows finance period creation for admin desktop actors", async () => {
    mockActor("admin");
    createPeriodMock.mockResolvedValue({
      id: "period-1",
      name: "Q3 2026",
      status: "OPEN",
    });

    const response = await handleDesktopFinanceRoute(
      new URL("http://desktop.local/api/finance/periods"),
      "POST",
      ["api", "finance", "periods"],
      {
        actorId: "admin-1",
        name: "Q3 2026",
        startDate: new Date("2026-07-01T00:00:00.000Z"),
        endDate: new Date("2026-09-30T00:00:00.000Z"),
      },
      {
        ensurePermission,
      },
    );

    expect(ensurePermission).toHaveBeenCalledWith("finance:write");
    expect(createPeriodMock).toHaveBeenCalledWith(
      "staff-1",
      expect.objectContaining({
        name: "Q3 2026",
      }),
    );
    expect(response?.status).toBe(201);
  });

  it("passes approval reasons through the local desktop route", async () => {
    mockActor("super_admin");
    approveRequestMock.mockResolvedValue({
      success: true,
      status: "APPROVED",
    });

    const response = await handleDesktopFinanceRoute(
      new URL("http://desktop.local/api/finance/approvals/approval-1/approve"),
      "POST",
      ["api", "finance", "approvals", "approval-1", "approve"],
      {
        actorId: "super-admin-1",
        reason: "Dokumen pendukung lengkap.",
      },
      {
        ensurePermission,
      },
    );

    expect(approveRequestMock).toHaveBeenCalledWith(
      "staff-1",
      "approval-1",
      "Dokumen pendukung lengkap.",
    );
    expect(response?.status).toBe(200);
  });

  it("delegates all-students batch generation to the finance service", async () => {
    mockActorWithStudentResolution("staff", ["student-1", "student-2"]);
    createBatchInvoicesMock.mockResolvedValue({
      processed: 2,
      skipped: 0,
    });

    const response = await handleDesktopFinanceRoute(
      new URL("http://desktop.local/api/finance/batches"),
      "POST",
      ["api", "finance", "batches"],
      {
        name: "SPP April 2026",
        categoryId: "550e8400-e29b-41d4-a716-446655440010",
        dueDate: new Date("2026-04-30T00:00:00.000Z"),
        studentIds: [],
        items: [
          {
            description: "SPP Bulanan",
            amount: 250000,
          },
        ],
      },
      {
        ensurePermission,
      },
    );

    expect(createBatchInvoicesMock).toHaveBeenCalledWith(
      "staff-1",
      expect.objectContaining({
        targetMode: "ALL_STUDENTS",
        studentIds: [],
      }),
    );
    expect(response?.status).toBe(201);
  });

  it("returns searchable batch student candidates from the finance service", async () => {
    mockActor("staff");
    getBatchStudentCandidatesMock.mockResolvedValue([
      {
        id: "student-1",
        nis: "1001",
        nisn: "9001",
        fullName: "Alya Putri",
        grade: "X-A",
        hasExistingInvoiceForPeriod: false,
      },
    ]);

    const response = await handleDesktopFinanceRoute(
      new URL(
        "http://desktop.local/api/finance/batch-students?query=alya&limit=25&categoryId=550e8400-e29b-41d4-a716-446655440010&dueDate=2026-05-31T00:00:00.000Z",
      ),
      "GET",
      ["api", "finance", "batch-students"],
      null,
      {
        ensurePermission,
      },
    );

    expect(getBatchStudentCandidatesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "alya",
        limit: 25,
        categoryId: "550e8400-e29b-41d4-a716-446655440010",
        dueDate: expect.any(Date),
      }),
    );
    expect(response?.status).toBe(200);
  });
});
