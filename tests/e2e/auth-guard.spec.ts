import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from "@playwright/test";

async function gotoWithRetry(page: Page, path: string) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await page.goto(path, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("ERR_CONNECTION_REFUSED") || attempt === 9) {
        throw error;
      }
      await page.waitForTimeout(3_000);
    }
  }
}

async function waitForAuthServerReady(request: APIRequestContext) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await request.get("/api/auth/providers", {
        timeout: 10_000,
      });
      if (response.ok()) {
        return;
      }
    } catch {
      // Retry below.
    }

    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }

  throw new Error(
    "Auth server did not become ready for unauthenticated guard checks.",
  );
}

test.describe("Auth guard", () => {
  for (const protectedPath of [
    "/dashboard",
    "/dashboard/attendance",
    "/dashboard/students",
    "/dashboard/settings",
  ]) {
    test(`redirects unauthenticated access from ${protectedPath} to login`, async ({
      page,
      request,
    }) => {
      await waitForAuthServerReady(request);
      await gotoWithRetry(page, protectedPath);

      await page.waitForURL((url) => {
        const pathname = new URL(url.toString()).pathname;
        return pathname === "/" || pathname === "/login";
      });
      await expect(
        page.getByRole("heading", { name: /Educore/i }),
      ).toBeVisible();
    });
  }
});
