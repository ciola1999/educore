import { expect, type Locator, type Page } from "@playwright/test";

export class SettingsAuthPage {
  readonly pushSyncButton: Locator;
  readonly pullSyncButton: Locator;
  readonly refreshSessionButton: Locator;
  readonly logoutButton: Locator;
  readonly lastSessionRefreshCard: Locator;
  readonly runtimeSyncInfo: Locator;
  readonly authSourceValue: Locator;
  readonly activeRoleValue: Locator;
  readonly activeEmailValue: Locator;
  readonly tracePanelTitle: Locator;
  readonly traceErrorOnlyButton: Locator;
  readonly traceAllEventsButton: Locator;
  readonly traceClearButton: Locator;
  readonly traceCopyReportButton: Locator;
  readonly traceExportJsonButton: Locator;
  readonly traceRedactToggleButton: Locator;
  readonly incidentPlaybookCard: Locator;
  readonly incidentPlaybookTitle: Locator;

  constructor(private readonly page: Page) {
    this.pushSyncButton = page.getByRole("button", { name: /Push Sync/i });
    this.pullSyncButton = page.getByRole("button", { name: /Pull Sync/i });
    this.refreshSessionButton = page.getByTestId("settings-refresh-session");
    this.logoutButton = page.getByTestId("settings-logout-button");
    this.lastSessionRefreshCard = page.getByTestId(
      "settings-last-session-refresh",
    );
    this.runtimeSyncInfo = page.getByText("/api/sync/*", { exact: true });
    this.authSourceValue = page.getByTestId("settings-auth-source");
    this.activeRoleValue = page.getByTestId("settings-active-role");
    this.activeEmailValue = page.getByTestId("settings-active-email");
    this.tracePanelTitle = page.getByText(/Auth\/Sync Event Trace/i);
    this.traceErrorOnlyButton = page.getByRole("button", {
      name: /^Error Only$/i,
    });
    this.traceAllEventsButton = page.getByRole("button", {
      name: /^All Events$/i,
    });
    this.traceClearButton = page.getByRole("button", { name: /^Clear$/i });
    this.traceCopyReportButton = page.getByRole("button", {
      name: /^Copy Report$/i,
    });
    this.traceExportJsonButton = page.getByRole("button", {
      name: /^Export JSON$/i,
    });
    this.traceRedactToggleButton = page.getByRole("button", { name: /^On$/i });
    this.incidentPlaybookCard = page.getByTestId("settings-incident-playbook");
    this.incidentPlaybookTitle = page.getByText(/Incident Playbook/i);
  }

  async goto() {
    await this.page.goto("/dashboard/settings", {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await this.page.waitForURL(/\/dashboard\/settings/, {
      timeout: 45_000,
    });

    const title = this.page.getByTestId("settings-page-title");
    const sessionSection = this.page.getByText(/Status Session & Akun Aktif/i);

    try {
      await expect(title.or(sessionSection).first()).toBeVisible({
        timeout: 25_000,
      });
    } catch {
      await this.page.reload({
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      await this.page.waitForURL(/\/dashboard\/settings/, {
        timeout: 45_000,
      });
      await expect(title.or(sessionSection).first()).toBeVisible({
        timeout: 25_000,
      });
    }
  }

  async expectSessionSectionReady() {
    await expect(
      this.page.getByText(/Status Session & Akun Aktif/i),
    ).toBeVisible();
    await expect(this.page.getByText(/State auth sinkron/i)).toBeVisible();
  }

  async expectWebSyncBoundary() {
    await expect(this.runtimeSyncInfo).toBeVisible();
    await expect(this.pushSyncButton).toBeDisabled();
    await expect(this.pullSyncButton).toBeDisabled();
  }

  async expectTraceControlsOnWeb() {
    await expect(this.tracePanelTitle).toBeVisible();
    await expect(this.traceErrorOnlyButton).toBeVisible();
    await expect(this.traceClearButton).toBeVisible();
    await expect(this.traceCopyReportButton).toBeVisible();
    await expect(this.traceRedactToggleButton).toBeVisible();
    await expect(this.traceExportJsonButton).toHaveCount(0);
  }

  async expectIncidentPlaybookReady() {
    await expect(this.incidentPlaybookCard).toBeVisible();
    await expect(this.incidentPlaybookTitle).toBeVisible();
    await expect(
      this.page.getByRole("button", { name: /Run Recovery/i }),
    ).toBeVisible();
    await expect(
      this.page.getByRole("button", { name: /Full Sync Check/i }),
    ).toBeVisible();
  }

  async expectTraceEntriesAvailable() {
    await expect(this.page.getByText(/session-refresh/i).first()).toBeVisible();
  }

  async toggleTraceFilterRoundTrip() {
    await this.traceErrorOnlyButton.click();
    await expect(this.traceAllEventsButton).toBeVisible();
    await this.traceAllEventsButton.click();
    await expect(this.traceErrorOnlyButton).toBeVisible();
  }

  async toggleTraceRedactionRoundTrip() {
    await this.traceRedactToggleButton.click();
    const offButton = this.page.getByRole("button", { name: /^Off$/i });
    await expect(offButton).toBeVisible();
    await offButton.click();
    await expect(this.traceRedactToggleButton).toBeVisible();
  }

  async expectIdentityConsistency(params?: {
    role?: string;
    email?: string | null;
  }) {
    await expect(this.authSourceValue).toContainText(
      /next-auth|desktop-store/i,
    );
    await expect(this.activeRoleValue).not.toHaveText("-");
    await expect(this.activeEmailValue).not.toHaveText("-");

    if (params?.role) {
      await expect(this.activeRoleValue).toHaveText(
        new RegExp(params.role, "i"),
      );
    }

    if (params?.email) {
      await expect(this.activeEmailValue).toContainText(params.email);
    }
  }

  async refreshSession() {
    await this.refreshSessionButton.click();
  }

  async expectSessionRefreshTimestampUpdated() {
    const currentValue = (
      await this.lastSessionRefreshCard.textContent()
    )?.trim();
    if (currentValue === "-" || !currentValue) {
      await this.refreshSessionButton.click();
    }

    await expect(this.lastSessionRefreshCard).not.toHaveText("-", {
      timeout: 20_000,
    });
  }

  async logout() {
    await this.logoutButton.click();
  }
}
