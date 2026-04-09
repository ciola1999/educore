import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePathMock = vi.hoisted(() => vi.fn());
const getDbMock = vi.hoisted(() => vi.fn());
const authMock = vi.hoisted(() => vi.fn());
const financeServiceMock = vi.hoisted(() => ({
  createBatchInvoices: vi.fn(),
  getDashboardSummary: vi.fn(),
  getInvoices: vi.fn(),
  processPayment: vi.fn(),
  updateInvoiceStatus: vi.fn(),
}));
const financeControlServiceMock = vi.hoisted(() => ({
  approveRequest: vi.fn(),
  rejectRequest: vi.fn(),
}));
const accountingServiceMock = vi.hoisted(() => ({
  getJournalEntries: vi.fn(),
  getAccounts: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
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

vi.mock("@/core/services/finance-control-service", () => ({
  FinanceControlService: financeControlServiceMock,
}));

vi.mock("@/core/services/accounting-service", () => ({
  AccountingService: accountingServiceMock,
}));

import {
  approveFinanceRequestAction,
  createBatchInvoicesAction,
  processPaymentAction,
  rejectFinanceRequestAction,
  updateInvoiceStatusAction,
} from "./actions";

describe("finance actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.EDUCORE_DESKTOP_RUNTIME;
    authMock.mockResolvedValue({
      user: {
        id: "user-1",
        role: "staff",
      },
    });
    const actorWhereMock = vi.fn().mockReturnValue({
      limit: vi
        .fn()
        .mockResolvedValue([{ id: "user-1", role: "staff", isActive: true }]),
    });
    const actorFromMock = vi.fn().mockReturnValue({ where: actorWhereMock });
    const selectMock = vi.fn().mockReturnValue({ from: actorFromMock });
    getDbMock.mockResolvedValue({
      select: selectMock,
    });
  });

  it("uses the authenticated actor id and expands empty student selection to all students", async () => {
    const actorWhereMock = vi.fn().mockReturnValue({
      limit: vi
        .fn()
        .mockResolvedValue([{ id: "user-1", role: "staff", isActive: true }]),
    });
    const actorFromMock = vi.fn().mockReturnValue({ where: actorWhereMock });
    const studentWhereMock = vi
      .fn()
      .mockResolvedValue([{ id: "student-1" }, { id: "student-2" }]);
    const studentFromMock = vi.fn().mockReturnValue({
      where: studentWhereMock,
    });
    const selectMock = vi
      .fn()
      .mockReturnValueOnce({ from: actorFromMock })
      .mockReturnValueOnce({ from: studentFromMock });

    getDbMock.mockResolvedValue({
      select: selectMock,
    });
    financeServiceMock.createBatchInvoices.mockResolvedValue({
      batchId: "batch-1",
      processed: 2,
    });

    const result = await createBatchInvoicesAction("user-1", {
      name: "SPP April 2026",
      description: null,
      categoryId: "550e8400-e29b-41d4-a716-446655440000",
      dueDate: new Date("2026-04-30T00:00:00.000Z"),
      studentIds: [],
      items: [{ description: "SPP", amount: 150000 }],
    });

    expect(financeServiceMock.createBatchInvoices).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        studentIds: ["student-1", "student-2"],
      }),
    );
    expect(result).toEqual({
      batchId: "batch-1",
      processed: 2,
    });
  });

  it("forwards invoice void requests to the finance service approval flow", async () => {
    const whereMock = vi.fn().mockReturnValue({
      limit: vi
        .fn()
        .mockResolvedValue([{ id: "user-1", role: "admin", isActive: true }]),
    });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    getDbMock.mockResolvedValue({
      select: selectMock,
    });
    authMock.mockResolvedValue({
      user: { id: "user-1", role: "admin" },
    });

    financeServiceMock.updateInvoiceStatus.mockResolvedValue({
      status: "PENDING_APPROVAL",
      approvalRequestId: "approval-1",
      invoiceId: "invoice-1",
      requestedStatus: "VOID",
    });

    await expect(
      updateInvoiceStatusAction("user-1", "invoice-1", "VOID"),
    ).resolves.toEqual({
      status: "PENDING_APPROVAL",
      approvalRequestId: "approval-1",
      invoiceId: "invoice-1",
      requestedStatus: "VOID",
    });

    expect(financeServiceMock.updateInvoiceStatus).toHaveBeenCalledWith(
      "user-1",
      "invoice-1",
      "VOID",
    );
  });

  it("rejects batch invoice generation for non-finance operators", async () => {
    const whereMock = vi.fn().mockReturnValue({
      limit: vi
        .fn()
        .mockResolvedValue([
          { id: "teacher-1", role: "teacher", isActive: true },
        ]),
    });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    getDbMock.mockResolvedValue({
      select: selectMock,
    });

    await expect(
      createBatchInvoicesAction("teacher-1", {
        name: "SPP April 2026",
        description: null,
        categoryId: "550e8400-e29b-41d4-a716-446655440000",
        dueDate: new Date("2026-04-30T00:00:00.000Z"),
        studentIds: [],
        items: [{ description: "SPP", amount: 150000 }],
      }),
    ).rejects.toThrow(
      "Akses ditolak. Hanya operator finance yang boleh memproses pembayaran.",
    );

    expect(financeServiceMock.createBatchInvoices).not.toHaveBeenCalled();
  });

  it("rejects invoice void requests for non-finance approvers", async () => {
    const whereMock = vi.fn().mockReturnValue({
      limit: vi
        .fn()
        .mockResolvedValue([{ id: "staff-1", role: "staff", isActive: true }]),
    });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    getDbMock.mockResolvedValue({
      select: selectMock,
    });

    await expect(
      updateInvoiceStatusAction("staff-1", "invoice-1", "VOID"),
    ).rejects.toThrow(
      "Akses ditolak. Hanya admin finance yang boleh memproses approval request.",
    );

    expect(financeServiceMock.updateInvoiceStatus).not.toHaveBeenCalled();
  });

  it("allows finance operators to reopen invoice status", async () => {
    const whereMock = vi.fn().mockReturnValue({
      limit: vi
        .fn()
        .mockResolvedValue([{ id: "staff-1", role: "staff", isActive: true }]),
    });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    getDbMock.mockResolvedValue({
      select: selectMock,
    });
    authMock.mockResolvedValue({
      user: { id: "staff-1", role: "staff" },
    });

    financeServiceMock.updateInvoiceStatus.mockResolvedValue({
      status: "UPDATED",
      invoiceId: "invoice-2",
      newStatus: "OPEN",
    });

    await expect(
      updateInvoiceStatusAction("staff-1", "invoice-2", "OPEN"),
    ).resolves.toEqual({
      status: "UPDATED",
      invoiceId: "invoice-2",
      newStatus: "OPEN",
    });
  });

  it("allows finance operators to process payments through the finance service", async () => {
    const whereMock = vi.fn().mockReturnValue({
      limit: vi
        .fn()
        .mockResolvedValue([{ id: "staff-1", role: "staff", isActive: true }]),
    });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    getDbMock.mockResolvedValue({
      select: selectMock,
    });
    authMock.mockResolvedValue({
      user: { id: "staff-1", role: "staff" },
    });

    financeServiceMock.processPayment.mockResolvedValue({
      paymentId: "payment-1",
      paymentNo: "PAY/2026/04/0001",
      receiptNo: "RCP/2026/04/0001",
      credit: 0,
    });

    await expect(
      processPaymentAction("staff-1", {
        studentId: "550e8400-e29b-41d4-a716-446655440000",
        methodId: "550e8400-e29b-41d4-a716-446655440001",
        amount: 150000,
        date: new Date("2026-04-08T00:00:00.000Z"),
        useCreditBalance: false,
        referenceNo: "REF-001",
      }),
    ).resolves.toEqual({
      paymentId: "payment-1",
      paymentNo: "PAY/2026/04/0001",
      receiptNo: "RCP/2026/04/0001",
      credit: 0,
    });

    expect(financeServiceMock.processPayment).toHaveBeenCalledWith(
      "staff-1",
      expect.objectContaining({
        amount: 150000,
      }),
    );
  });

  it("approves finance requests through the control service", async () => {
    const whereMock = vi.fn().mockReturnValue({
      limit: vi
        .fn()
        .mockResolvedValue([
          { id: "approver-1", role: "admin", isActive: true },
        ]),
    });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    getDbMock.mockResolvedValue({
      select: selectMock,
    });
    authMock.mockResolvedValue({
      user: { id: "approver-1", role: "admin" },
    });

    financeControlServiceMock.approveRequest.mockResolvedValue({
      success: true,
      status: "APPROVED",
      requestId: "approval-1",
      targetId: "invoice-1",
      targetType: "INVOICE",
    });

    await expect(
      approveFinanceRequestAction("approver-1", "approval-1"),
    ).resolves.toEqual({
      success: true,
      status: "APPROVED",
      requestId: "approval-1",
      targetId: "invoice-1",
      targetType: "INVOICE",
    });

    expect(financeControlServiceMock.approveRequest).toHaveBeenCalledWith(
      "approver-1",
      "approval-1",
    );
  });

  it("rejects finance requests through the control service", async () => {
    const whereMock = vi.fn().mockReturnValue({
      limit: vi
        .fn()
        .mockResolvedValue([
          { id: "approver-1", role: "super_admin", isActive: true },
        ]),
    });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    getDbMock.mockResolvedValue({
      select: selectMock,
    });
    authMock.mockResolvedValue({
      user: { id: "approver-1", role: "super_admin" },
    });

    financeControlServiceMock.rejectRequest.mockResolvedValue({
      success: true,
      status: "REJECTED",
      requestId: "approval-2",
      targetId: "invoice-2",
      targetType: "INVOICE",
    });

    await expect(
      rejectFinanceRequestAction("approver-1", "approval-2"),
    ).resolves.toEqual({
      success: true,
      status: "REJECTED",
      requestId: "approval-2",
      targetId: "invoice-2",
      targetType: "INVOICE",
    });

    expect(financeControlServiceMock.rejectRequest).toHaveBeenCalledWith(
      "approver-1",
      "approval-2",
    );
  });

  it("rejects approval processing for non-finance approvers", async () => {
    const whereMock = vi.fn().mockReturnValue({
      limit: vi
        .fn()
        .mockResolvedValue([
          { id: "teacher-1", role: "teacher", isActive: true },
        ]),
    });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    getDbMock.mockResolvedValue({
      select: selectMock,
    });
    authMock.mockResolvedValue({
      user: { id: "teacher-1", role: "teacher" },
    });

    await expect(
      approveFinanceRequestAction("teacher-1", "approval-3"),
    ).rejects.toThrow(
      "Akses ditolak. Hanya admin finance yang boleh memproses approval request.",
    );

    expect(financeControlServiceMock.approveRequest).not.toHaveBeenCalled();
  });

  it("rejects payment processing for non-finance operators", async () => {
    const whereMock = vi.fn().mockReturnValue({
      limit: vi
        .fn()
        .mockResolvedValue([
          { id: "teacher-1", role: "teacher", isActive: true },
        ]),
    });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    getDbMock.mockResolvedValue({
      select: selectMock,
    });
    authMock.mockResolvedValue({
      user: { id: "teacher-1", role: "teacher" },
    });

    await expect(
      processPaymentAction("teacher-1", {
        studentId: "550e8400-e29b-41d4-a716-446655440000",
        methodId: "550e8400-e29b-41d4-a716-446655440001",
        amount: 100000,
        date: new Date("2026-04-08T00:00:00.000Z"),
        useCreditBalance: false,
      }),
    ).rejects.toThrow(
      "Akses ditolak. Hanya operator finance yang boleh memproses pembayaran.",
    );

    expect(financeServiceMock.processPayment).not.toHaveBeenCalled();
  });

  it("rejects finance mutation when client actor id does not match session actor", async () => {
    authMock.mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    });

    await expect(
      updateInvoiceStatusAction("spoofed-admin", "invoice-1", "VOID"),
    ).rejects.toThrow(
      "Akses ditolak. Aktor finance tidak cocok dengan sesi aktif.",
    );

    expect(financeServiceMock.updateInvoiceStatus).not.toHaveBeenCalled();
  });
});
