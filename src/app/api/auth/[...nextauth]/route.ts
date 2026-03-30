import type { NextRequest } from "next/server";
import { handlers } from "@/lib/auth/web/auth";

function unavailableAuthHandler() {
  return Response.json(
    {
      success: false,
      error: "Auth handlers unavailable",
      code: "AUTH_HANDLERS_UNAVAILABLE",
    },
    { status: 500 },
  );
}

export async function GET(
  request: NextRequest,
  _context: { params: Promise<Record<string, string | string[] | undefined>> },
) {
  const handler = handlers?.GET;
  if (!handler) {
    return unavailableAuthHandler();
  }

  return handler(request);
}

export async function POST(
  request: NextRequest,
  _context: { params: Promise<Record<string, string | string[] | undefined>> },
) {
  const handler = handlers?.POST;
  if (!handler) {
    return unavailableAuthHandler();
  }

  return handler(request);
}
