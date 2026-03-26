import { expect, type Page } from "@playwright/test";

type BrowserCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Lax" | "None" | "Strict";
};

function splitSetCookieHeader(raw: string | null): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(/,(?=[^;]+=[^;]+)/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseSetCookieHeader(
  raw: string | null,
  origin: URL,
): BrowserCookie[] {
  const nowSeconds = Math.floor(Date.now() / 1000);

  return splitSetCookieHeader(raw)
    .map((entry) => {
      const parts = entry.split(";").map((part) => part.trim());
      const [nameValue, ...attributes] = parts;
      const separatorIndex = nameValue.indexOf("=");

      if (separatorIndex <= 0) {
        return null;
      }

      const cookie: BrowserCookie = {
        name: nameValue.slice(0, separatorIndex),
        value: nameValue.slice(separatorIndex + 1),
        domain: origin.hostname,
        path: "/",
      };

      for (const attribute of attributes) {
        const [rawKey, ...rawValueParts] = attribute.split("=");
        const key = rawKey.toLowerCase();
        const value = rawValueParts.join("=");

        if (key === "path" && value) {
          cookie.path = value;
          continue;
        }

        if (key === "domain" && value) {
          cookie.domain = value.replace(/^\./, "");
          continue;
        }

        if (key === "max-age") {
          const parsed = Number(value);
          if (Number.isFinite(parsed)) {
            cookie.expires = nowSeconds + parsed;
          }
          continue;
        }

        if (key === "expires") {
          const parsed = Date.parse(value);
          if (Number.isFinite(parsed)) {
            cookie.expires = Math.floor(parsed / 1000);
          }
          continue;
        }

        if (key === "httponly") {
          cookie.httpOnly = true;
          continue;
        }

        if (key === "secure") {
          cookie.secure = true;
          continue;
        }

        if (key === "samesite") {
          if (value === "Lax" || value === "None" || value === "Strict") {
            cookie.sameSite = value;
          }
        }
      }

      return cookie;
    })
    .filter((cookie): cookie is BrowserCookie => Boolean(cookie));
}

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

    await this.waitForLoginOrDashboard();

    if (this.page.url().includes("/dashboard")) {
      return;
    }

    const cookieSeedRaw = process.env.E2E_SESSION_COOKIES_JSON?.trim();
    if (cookieSeedRaw) {
      const seededCookies = JSON.parse(cookieSeedRaw) as BrowserCookie[];
      if (seededCookies.length > 0) {
        await this.page.context().addCookies(seededCookies);
        await this.page.goto("/api/auth/session", { waitUntil: "networkidle" });
        await this.page.waitForFunction(async () => {
          const response = await fetch("/api/auth/session", {
            credentials: "include",
          });
          if (!response.ok) {
            return false;
          }

          const payload = (await response.json()) as {
            user?: { id?: string | null } | null;
          } | null;

          return Boolean(payload?.user?.id);
        });

        await this.page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await this.page.waitForURL(
          (url) => new URL(url.toString()).pathname.startsWith("/dashboard"),
          { timeout: 45_000 },
        );
        return;
      }
    }

    const origin = new URL(this.page.url());
    const csrfResponse = await fetch(new URL("/api/auth/csrf", origin), {
      redirect: "manual",
    });
    const csrfPayload = (await csrfResponse.json()) as { csrfToken?: string };
    const csrfToken = csrfPayload.csrfToken?.trim() ?? "";

    if (!csrfResponse.ok || !csrfToken) {
      throw new Error(
        `Browser sign-in failed: ${JSON.stringify({
          csrfStatus: csrfResponse.status,
          signInStatus: null,
        })}`,
      );
    }

    const csrfCookies = parseSetCookieHeader(
      csrfResponse.headers.get("set-cookie"),
      origin,
    );

    const signInResponse = await fetch(
      new URL("/api/auth/callback/credentials?json=true", origin),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: splitSetCookieHeader(csrfResponse.headers.get("set-cookie"))
            .map((entry) => entry.split(";")[0] ?? "")
            .filter(Boolean)
            .join("; "),
        },
        body: new URLSearchParams({
          csrfToken,
          email: identifier,
          password,
          callbackUrl: new URL("/dashboard", origin).toString(),
          json: "true",
        }).toString(),
        redirect: "manual",
      },
    );

    const signInCookies = parseSetCookieHeader(
      signInResponse.headers.get("set-cookie"),
      origin,
    );

    if (signInResponse.status !== 302 || signInCookies.length === 0) {
      throw new Error(
        `Browser sign-in failed: ${JSON.stringify({
          csrfStatus: csrfResponse.status,
          signInStatus: signInResponse.status,
          location: signInResponse.headers.get("location"),
        })}`,
      );
    }

    await this.page.context().addCookies([...csrfCookies, ...signInCookies]);

    await this.page.goto("/api/auth/session", { waitUntil: "networkidle" });
    await this.page.waitForFunction(async () => {
      const response = await fetch("/api/auth/session", {
        credentials: "include",
      });
      if (!response.ok) {
        return false;
      }

      const payload = (await response.json()) as {
        user?: { id?: string | null } | null;
      } | null;

      return Boolean(payload?.user?.id);
    });

    await this.page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await this.page.waitForURL(
      (url) => new URL(url.toString()).pathname.startsWith("/dashboard"),
      { timeout: 45_000 },
    );
  }
}
