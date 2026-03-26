import { expect, type Page } from "@playwright/test";

export class LoginPage {
  constructor(private readonly page: Page) {}

  private async waitForLoginOrDashboard() {
    const identifierField = this.page.getByLabel(
      /Email \/ Username \/ NIP \/ NIS/i,
    );

    await Promise.race([
      this.page.waitForURL(/\/dashboard/, { timeout: 15_000 }),
      expect(identifierField).toBeVisible({ timeout: 15_000 }),
    ]).catch(() => undefined);
  }

  async goto() {
    await this.page.goto("/");
    await this.waitForLoginOrDashboard();
    await expect(
      this.page
        .getByRole("heading", { name: /Educore/i })
        .or(this.page.getByRole("heading", { name: /Dashboard/i })),
    ).toBeVisible();
  }

  async login(params: { identifier: string; password: string }) {
    const { identifier, password } = params;
    const identifierField = this.page.getByLabel(
      /Email \/ Username \/ NIP \/ NIS/i,
    );
    const passwordField = this.page.getByLabel(/Password/i);

    await this.waitForLoginOrDashboard();

    if (this.page.url().includes("/dashboard")) {
      return;
    }

    await identifierField.fill(identifier);
    await passwordField.fill(password);

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      await passwordField.press("Enter");

      try {
        await this.page.waitForURL(/\/dashboard/, { timeout: 12_000 });
        return;
      } catch {
        if (attempt === 2) {
          break;
        }

        if (this.page.url().includes("/dashboard")) {
          return;
        }

        await this.waitForLoginOrDashboard();

        await expect(identifierField).toBeVisible();
        await expect(passwordField).toBeVisible();
      }
    }
  }
}
