import { expect, test } from "@playwright/test";
import { LoginPage } from "../page-objects/login-page";
import { SettingsAuthPage } from "../page-objects/settings-auth-page";

const settingsIdentifier =
  process.env.E2E_SETTINGS_IDENTIFIER || process.env.E2E_ATTENDANCE_IDENTIFIER;
const settingsPassword =
  process.env.E2E_SETTINGS_PASSWORD || process.env.E2E_ATTENDANCE_PASSWORD;

function deriveExpectedEmail(identifier: string | undefined): string | null {
  if (!identifier) {
    return null;
  }

  const value = identifier.trim().toLowerCase();
  if (!value) {
    return null;
  }

  if (value.includes("@")) {
    return value;
  }

  // Common username aliases map to school email format.
  if (/^[a-z0-9._-]+$/i.test(value)) {
    return `${value}@educore.school`;
  }

  return null;
}

test.describe("Settings/Auth shell @smoke", () => {
  test.skip(
    !settingsIdentifier || !settingsPassword,
    "Set E2E_SETTINGS_IDENTIFIER dan E2E_SETTINGS_PASSWORD untuk menjalankan Settings/Auth E2E.",
  );

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.login({
      identifier: settingsIdentifier ?? "",
      password: settingsPassword ?? "",
    });

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 45_000 });
  });

  test("enforces web sync action boundary and session panel visibility", async ({
    page,
  }) => {
    const settingsPage = new SettingsAuthPage(page);
    const telemetryResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/telemetry/settings-auth"),
      { timeout: 45_000 },
    );

    await settingsPage.goto();
    await settingsPage.expectSessionSectionReady();
    await settingsPage.expectIncidentPlaybookReady();
    await settingsPage.expectWebSyncBoundary();
    await settingsPage.expectTraceControlsOnWeb();
    await settingsPage.refreshSession();
    const telemetryResponse = await telemetryResponsePromise;
    expect(telemetryResponse.status()).toBe(200);
    await settingsPage.expectTraceEntriesAvailable();
    await settingsPage.toggleTraceFilterRoundTrip();
    await settingsPage.toggleTraceRedactionRoundTrip();
  });

  test("keeps auth source and active identity in sync", async ({ page }) => {
    const settingsPage = new SettingsAuthPage(page);

    await settingsPage.goto();
    await settingsPage.expectSessionSectionReady();
    await settingsPage.expectIdentityConsistency({
      email: deriveExpectedEmail(settingsIdentifier),
    });
  });

  test("refreshes session indicator and revokes route access after logout", async ({
    page,
  }) => {
    const settingsPage = new SettingsAuthPage(page);

    await settingsPage.goto();
    await settingsPage.refreshSession();
    await settingsPage.expectSessionRefreshTimestampUpdated();

    await settingsPage.logout();
    await expect(page).toHaveURL(/\/$/, { timeout: 60_000 });
    await expect(page.getByRole("heading", { name: /Educore/i })).toBeVisible();

    await page.goto("/dashboard/settings");
    await expect(page).toHaveURL(/\/(\?.*)?$/, { timeout: 60_000 });
    await expect(page.getByRole("heading", { name: /Educore/i })).toBeVisible();
  });

  test("keeps session refresh functional when telemetry endpoint fails", async ({
    page,
  }) => {
    const settingsPage = new SettingsAuthPage(page);

    await page.route("**/api/telemetry/settings-auth", async (route) => {
      await route.abort("failed");
    });

    await settingsPage.goto();
    await settingsPage.expectSessionSectionReady();
    await settingsPage.refreshSession();
    await settingsPage.expectSessionRefreshTimestampUpdated();
  });
});
