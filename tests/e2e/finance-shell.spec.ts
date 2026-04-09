import { expect, test } from "@playwright/test";
import { FinancePage } from "../page-objects/finance-page";
import { LoginPage } from "../page-objects/login-page";

const financeIdentifier =
  process.env.E2E_FINANCE_IDENTIFIER || process.env.E2E_SETTINGS_IDENTIFIER;
const financePassword =
  process.env.E2E_FINANCE_PASSWORD || process.env.E2E_SETTINGS_PASSWORD;
const financeStudentQuery = process.env.E2E_FINANCE_STUDENT_QUERY?.trim() ?? "";

test.describe("Finance shell @smoke", () => {
  test.skip(
    !financeIdentifier || !financePassword,
    "Set E2E_FINANCE_IDENTIFIER/E2E_FINANCE_PASSWORD atau fallback E2E_SETTINGS_* untuk menjalankan Finance E2E.",
  );

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.login({
      identifier: financeIdentifier ?? "",
      password: financePassword ?? "",
    });

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 45_000 });
  });

  test("opens finance overview and core control surfaces", async ({ page }) => {
    test.setTimeout(300_000);

    const financePage = new FinancePage(page);

    await financePage.gotoOverview();
    await financePage.expectOverviewReady();

    await financePage.openNav(/Invoices/i);
    await expect(page).toHaveURL(/\/dashboard\/finance\/invoices/, {
      timeout: 45_000,
    });
    await financePage.expectInvoicesReady();
    await financePage.switchInvoiceTab(/Overdue/i);
    await expect(page.getByRole("button", { name: /Overdue/i })).toHaveClass(
      /text-white/,
    );

    await financePage.openNav(/Periods/i);
    await expect(page).toHaveURL(/\/dashboard\/finance\/periods/, {
      timeout: 45_000,
    });
    await financePage.expectPeriodsReady();

    await financePage.openNav(/Payments/i);
    await expect(page).toHaveURL(/\/dashboard\/finance\/payments/, {
      timeout: 45_000,
    });
    await financePage.expectPaymentsReady();

    await financePage.openNav(/Audit Logs/i);
    await expect(page).toHaveURL(/\/dashboard\/finance\/audit/, {
      timeout: 45_000,
    });
    await financePage.expectAuditReady();
  });

  test("can search a student in payments without executing payment", async ({
    page,
  }) => {
    test.skip(
      !financeStudentQuery,
      "Set E2E_FINANCE_STUDENT_QUERY untuk memverifikasi student lookup pada Payments.",
    );
    test.setTimeout(300_000);

    const financePage = new FinancePage(page);

    await financePage.gotoOverview();
    await financePage.openNav(/Payments/i);
    await expect(page).toHaveURL(/\/dashboard\/finance\/payments/, {
      timeout: 45_000,
    });
    await financePage.expectPaymentsReady();
    await financePage.searchPaymentStudent(financeStudentQuery);
    await financePage.expectPaymentSearchResults();
    await financePage.selectFirstPaymentSearchResult();
    await financePage.expectPaymentFormActivated();
  });
});
