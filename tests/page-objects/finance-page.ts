import { expect, type Page } from "@playwright/test";

export class FinancePage {
  constructor(private readonly page: Page) {}

  async gotoOverview() {
    await this.page.goto("/dashboard/finance", {
      waitUntil: "domcontentloaded",
      timeout: 240_000,
    });
    await expect(
      this.page.getByRole("heading", { name: /FinanceEngine/i }),
    ).toBeVisible({ timeout: 20_000 });
  }

  async expectOverviewReady() {
    await expect(this.page.getByText(/Revenue \(Month\)/i)).toBeVisible();
    await expect(this.page.getByText(/Open Invoices/i)).toBeVisible();
    await expect(
      this.page.getByRole("heading", { name: /Quick Actions/i }),
    ).toBeVisible();
    await expect(
      this.page.getByRole("button", { name: /Generate Invoices/i }),
    ).toBeVisible();
  }

  async openNav(label: RegExp | string) {
    await this.page.getByRole("link", { name: label }).click();
  }

  async expectInvoicesReady() {
    await expect(
      this.page.getByPlaceholder(/Search student or invoice number/i),
    ).toBeVisible();
    await expect(this.page.getByText(/All Invoices/i)).toBeVisible();
    await expect(
      this.page.getByRole("button", { name: /Generate Batch/i }),
    ).toBeVisible();
  }

  async switchInvoiceTab(label: RegExp | string) {
    await this.page.getByRole("button", { name: label }).click();
  }

  async expectPeriodsReady() {
    await expect(
      this.page.getByRole("heading", { name: /Finance Control Center/i }),
    ).toBeVisible();
    await expect(
      this.page.getByRole("heading", { name: /Approval Gate/i }),
    ).toBeVisible();
  }

  async expectAuditReady() {
    await expect(
      this.page.getByPlaceholder(/Search events, actors, details/i),
    ).toBeVisible();
    await expect(
      this.page.getByText(/Clear Audit Trail|REVIEW METADATA/i).first(),
    ).toBeVisible();
  }

  async expectPaymentsReady() {
    await expect(
      this.page.getByRole("heading", { name: /Entry Payment/i }),
    ).toBeVisible();
    await expect(this.page.getByLabel(/Revenue Ingress/i)).toBeDisabled();
    await expect(
      this.page.getByRole("button", { name: /EXECUTE PAYMENT/i }),
    ).toBeDisabled();
    await expect(
      this.page
        .getByText(/Waiting for Entry|Select a student to start/i)
        .first(),
    ).toBeVisible();
  }

  async searchPaymentStudent(query: string) {
    await this.page.getByPlaceholder(/Type NIS or Student Name/i).fill(query);
  }

  async expectPaymentSearchResults() {
    await expect(
      this.page.getByRole("button").filter({ hasText: /NIS:/i }).first(),
    ).toBeVisible();
  }

  async selectFirstPaymentSearchResult() {
    await this.page
      .getByRole("button")
      .filter({ hasText: /NIS:/i })
      .first()
      .click();
  }

  async expectPaymentFormActivated() {
    await expect(this.page.getByLabel(/Revenue Ingress/i)).toBeEnabled();
    await expect(this.page.getByLabel(/Posting Date/i)).toBeEnabled();
    await expect(
      this.page.getByRole("button", { name: /EXECUTE PAYMENT/i }),
    ).toBeEnabled();
    await expect(
      this.page.getByRole("button", { name: /Change/i }),
    ).toBeVisible();
  }
}
