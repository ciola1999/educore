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
  }

  async goto() {
    await this.page.goto("/dashboard/settings", {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await expect(this.page.getByTestId("settings-page-title")).toBeVisible({
      timeout: 20_000,
    });
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
    await expect(this.lastSessionRefreshCard).not.toHaveText("-");
  }

  async logout() {
    await this.logoutButton.click();
  }
}
