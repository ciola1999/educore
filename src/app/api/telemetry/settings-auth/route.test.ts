import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const executeMock = vi.hoisted(() => vi.fn());
const createAuthDbClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/web/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/auth/web/db", () => ({
  createAuthDbClient: createAuthDbClientMock,
}));

import { GET, POST } from "./route";

describe("POST /api/telemetry/settings-auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createAuthDbClientMock.mockReturnValue({
      execute: executeMock,
    });
    executeMock.mockResolvedValue({
      rows: [],
    });
  });

  it("returns 401 when session is missing", async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/telemetry/settings-auth", {
        method: "POST",
        body: JSON.stringify({
          events: [],
        }),
      }),
    );

    expect(response.status).toBe(401);
    const payload = (await response.json()) as {
      success: boolean;
      code?: string;
    };
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 when payload shape is invalid", async () => {
    authMock.mockResolvedValue({
      user: { id: "admin-1", email: "admin@educore.school" },
    });

    const response = await POST(
      new Request("http://localhost/api/telemetry/settings-auth", {
        method: "POST",
        body: JSON.stringify({
          events: [
            {
              page: "dashboard/settings",
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(400);
    const payload = (await response.json()) as {
      success: boolean;
      code?: string;
    };
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("INVALID_TELEMETRY");
  });

  it("accepts valid payload and redacts sensitive tokens in detail", async () => {
    authMock.mockResolvedValue({
      user: { id: "admin-1", email: "admin@educore.school" },
    });
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const response = await POST(
      new Request("http://localhost/api/telemetry/settings-auth", {
        method: "POST",
        body: JSON.stringify({
          events: [
            {
              page: "dashboard/settings",
              sessionStatus: "authenticated",
              authSource: "next-auth",
              activeRole: "admin",
              event: {
                id: "evt-1",
                at: "2026-03-25T12:00:00.000Z",
                action: "sync",
                status: "error",
                runtime: "web",
                detail:
                  "sync failed bearer abc.def.ghi token=eyJhbGciOiJIUzI1NiJ9.aaa.bbb",
              },
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      success: boolean;
      data?: { accepted?: number };
    };
    expect(payload.success).toBe(true);
    expect(payload.data?.accepted).toBe(1);

    expect(executeMock).toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const logged = infoSpy.mock.calls[0]?.[1] as
      | {
          events?: Array<{
            event?: {
              detail?: string;
            };
          }>;
        }
      | undefined;
    const detail = logged?.events?.[0]?.event?.detail ?? "";
    expect(detail).not.toMatch(/bearer\s+abc\.def\.ghi/i);
    expect(detail).not.toMatch(
      /\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/,
    );
    expect(detail).toContain("bearer [redacted]");
    expect(detail).toContain("[jwt-redacted]");
  });

  it("returns 401 for summary endpoint when session missing", async () => {
    authMock.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/telemetry/settings-auth?hours=24"),
    );

    expect(response.status).toBe(401);
  });

  it("returns telemetry summary for current user", async () => {
    authMock.mockResolvedValue({
      user: { id: "admin-1", email: "admin@educore.school" },
    });
    executeMock
      .mockResolvedValueOnce({ rows: [] }) // ensure table
      .mockResolvedValueOnce({ rows: [] }) // retention
      .mockResolvedValueOnce({
        rows: [
          {
            total_events: 12,
            total_errors: 3,
            total_warnings: 2,
            total_escalations: 1,
            web_events: 8,
            desktop_events: 4,
          },
        ],
      });

    const response = await GET(
      new Request("http://localhost/api/telemetry/settings-auth?hours=24"),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      success: boolean;
      data?: {
        totalEvents: number;
        totalErrors: number;
        totalEscalations: number;
        runtimeBreakdown: { web: number; desktop: number };
      };
    };
    expect(payload.success).toBe(true);
    expect(payload.data?.totalEvents).toBe(12);
    expect(payload.data?.totalErrors).toBe(3);
    expect(payload.data?.totalEscalations).toBe(1);
    expect(payload.data?.runtimeBreakdown.web).toBe(8);
    expect(payload.data?.runtimeBreakdown.desktop).toBe(4);
  });
});
