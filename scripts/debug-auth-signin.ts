type NullableString = string | null;

function parseSetCookie(raw: NullableString): string {
  if (!raw) {
    return "";
  }

  const entries = raw
    .split(/,(?=[^;]+=[^;]+)/g)
    .map((item) => item.trim())
    .filter(Boolean);

  return entries
    .map((entry) => entry.split(";")[0]?.trim() ?? "")
    .filter(Boolean)
    .join("; ");
}

async function main() {
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
  const identifier =
    process.env.E2E_SETTINGS_IDENTIFIER ||
    process.env.E2E_ATTENDANCE_IDENTIFIER ||
    "admin@educore.school";
  const password =
    process.env.E2E_SETTINGS_PASSWORD ||
    process.env.E2E_ATTENDANCE_PASSWORD ||
    "admin123";

  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`, {
    redirect: "manual",
  });
  const csrfCookie = parseSetCookie(csrfResponse.headers.get("set-cookie"));
  const csrfJson = (await csrfResponse.json()) as { csrfToken?: string };
  const csrfToken = csrfJson.csrfToken || "";

  if (!csrfToken) {
    throw new Error("CSRF token missing from /api/auth/csrf");
  }

  const form = new URLSearchParams({
    csrfToken,
    email: identifier,
    password,
    callbackUrl: `${baseUrl}/dashboard`,
    json: "true",
  });

  const loginResponse = await fetch(
    `${baseUrl}/api/auth/callback/credentials?json=true`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: csrfCookie,
      },
      body: form.toString(),
      redirect: "manual",
    },
  );

  const bodyText = await loginResponse.text();

  console.log(
    JSON.stringify(
      {
        baseUrl,
        identifier,
        csrfStatus: csrfResponse.status,
        loginStatus: loginResponse.status,
        location: loginResponse.headers.get("location"),
        setCookie: loginResponse.headers.get("set-cookie"),
        body: bodyText.slice(0, 500),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("debug-auth-signin failed:", error);
  process.exit(1);
});
