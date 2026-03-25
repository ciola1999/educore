import { expect, test } from "@playwright/test";

test.describe("Auth guard", () => {
  test("redirects unauthenticated access from dashboard settings to login", async ({
    page,
  }) => {
    await page.goto("/dashboard/settings", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    await expect(page).toHaveURL(/\/(\?.*)?$/, { timeout: 60_000 });
    await expect(page.getByRole("heading", { name: /Educore/i })).toBeVisible();
  });
});
