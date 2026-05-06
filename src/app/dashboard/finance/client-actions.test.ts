import { beforeEach, describe, expect, it, vi } from "vitest";

const isTauriMock = vi.hoisted(() => vi.fn());
const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());
const apiPatchMock = vi.hoisted(() => vi.fn());
const actionsMock = vi.hoisted(() => ({
  approveFinanceRequestAction: vi.fn(),
  createBatchInvoicesAction: vi.fn(),
  createFinancePeriodAction: vi.fn(),
  createManualJournalAdjustmentAction: vi.fn(),
  processPaymentAction: vi.fn(),
  rejectFinanceRequestAction: vi.fn(),
  updateFinancePeriodStatusAction: vi.fn(),
  updateInvoiceStatusAction: vi.fn(),
}));
const queriesMock = vi.hoisted(() => ({
  getBillingCategoriesAction: vi.fn(),
  getFinanceAccountsAction: vi.fn(),
}));

vi.mock("@/core/env", () => ({
  isTauri: isTauriMock,
}));

vi.mock("@/lib/api/request", () => ({
  apiGet: apiGetMock,
  apiPost: apiPostMock,
  apiPatch: apiPatchMock,
}));

vi.mock("./actions", () => actionsMock);
vi.mock("./queries", () => queriesMock);

import {
  approveFinanceRequestRuntimeAction,
  createManualJournalAdjustmentRuntimeAction,
  updateFinancePeriodStatusRuntimeAction,
} from "./client-actions";

describe("finance client actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes approval decisions to local desktop API when tauri runtime is active", async () => {
    isTauriMock.mockReturnValue(true);
    apiPostMock.mockResolvedValue({ success: true, status: "APPROVED" });

    await expect(
      approveFinanceRequestRuntimeAction(
        "admin-1",
        "approval-1",
        "Dokumen lengkap dan valid.",
      ),
    ).resolves.toEqual({
      success: true,
      status: "APPROVED",
    });

    expect(apiPostMock).toHaveBeenCalledWith(
      "/api/finance/approvals/approval-1/approve",
      {
        actorId: "admin-1",
        reason: "Dokumen lengkap dan valid.",
      },
    );
    expect(actionsMock.approveFinanceRequestAction).not.toHaveBeenCalled();
  });

  it("routes period transitions to local desktop API when tauri runtime is active", async () => {
    isTauriMock.mockReturnValue(true);
    apiPatchMock.mockResolvedValue({
      success: true,
      periodId: "period-1",
      previousStatus: "OPEN",
      nextStatus: "SOFT_CLOSED",
    });

    await expect(
      updateFinancePeriodStatusRuntimeAction(
        "admin-1",
        "period-1",
        "SOFT_CLOSED",
        "Mulai rekonsiliasi akhir periode.",
      ),
    ).resolves.toEqual({
      success: true,
      periodId: "period-1",
      previousStatus: "OPEN",
      nextStatus: "SOFT_CLOSED",
    });

    expect(apiPatchMock).toHaveBeenCalledWith(
      "/api/finance/periods/period-1/status",
      {
        actorId: "admin-1",
        status: "SOFT_CLOSED",
        reason: "Mulai rekonsiliasi akhir periode.",
      },
    );
    expect(actionsMock.updateFinancePeriodStatusAction).not.toHaveBeenCalled();
  });

  it("routes manual adjustments to local desktop API when tauri runtime is active", async () => {
    isTauriMock.mockReturnValue(true);
    apiPostMock.mockResolvedValue({
      journalId: "journal-1",
      lineCount: 2,
    });

    await expect(
      createManualJournalAdjustmentRuntimeAction("admin-1", {
        date: new Date("2026-04-17T00:00:00.000Z"),
        description: "Koreksi saldo kas",
        reason: "Audit kas harian.",
        lines: [
          {
            accountId: "550e8400-e29b-41d4-a716-446655440000",
            debit: 100000,
            credit: 0,
          },
          {
            accountId: "550e8400-e29b-41d4-a716-446655440001",
            debit: 0,
            credit: 100000,
          },
        ],
      }),
    ).resolves.toEqual({
      journalId: "journal-1",
      lineCount: 2,
    });

    expect(apiPostMock).toHaveBeenCalledWith(
      "/api/finance/accounting/adjustments",
      expect.objectContaining({
        actorId: "admin-1",
        description: "Koreksi saldo kas",
      }),
    );
    expect(
      actionsMock.createManualJournalAdjustmentAction,
    ).not.toHaveBeenCalled();
  });

  it("falls back to server actions when desktop runtime is not active", async () => {
    isTauriMock.mockReturnValue(false);
    actionsMock.approveFinanceRequestAction.mockResolvedValue({
      success: true,
      status: "APPROVED",
    });

    await approveFinanceRequestRuntimeAction(
      "admin-1",
      "approval-9",
      "Fallback ke jalur web.",
    );

    expect(actionsMock.approveFinanceRequestAction).toHaveBeenCalledWith(
      "admin-1",
      "approval-9",
      "Fallback ke jalur web.",
    );
    expect(apiPostMock).not.toHaveBeenCalled();
  });
});
