import { expect, type Page } from "@playwright/test";

export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/");
    await expect(
      this.page.getByRole("heading", { name: /Educore/i }),
    ).toBeVisible();
  }

  async login(params: { identifier: string; password: string }) {
    const { identifier, password } = params;
    await this.page
      .getByLabel(/Email \/ Username \/ NIP \/ NIS/i)
      .fill(identifier);
    await this.page.getByLabel(/Password/i).fill(password);

    const callbackResponse = this.page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/auth/callback/credentials"),
      { timeout: 45_000 },
    );

    await this.page.getByRole("button", { name: /^Masuk$/i }).click();
    await callbackResponse;
  }
}
