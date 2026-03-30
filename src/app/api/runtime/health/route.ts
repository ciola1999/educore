import { NextResponse } from "next/server";
import { getDatabase } from "@/core/db/connection";

export const dynamic = "force-dynamic";

function resolveAppVersion() {
  const rawVersion = process.env.NEXT_PUBLIC_APP_VERSION?.trim();
  return rawVersion && rawVersion.length > 0 ? rawVersion : "0.1.0";
}

export async function GET() {
  try {
    await getDatabase();

    return NextResponse.json({
      success: true,
      data: {
        ok: true,
        runtime: "next-app-server",
        version: resolveAppVersion(),
        db: "ready",
        capabilities: {
          appRouter: true,
          authRoutes: true,
          apiRoutes: true,
        },
      },
    });
  } catch (error) {
    console.error("[RUNTIME_HEALTH_ERROR]", error);
    return NextResponse.json(
      {
        success: false,
        error: "APP_RUNTIME_HEALTH_FAILED",
        message:
          "Runtime aplikasi belum sehat untuk menerima startup handshake.",
        data: {
          ok: false,
          runtime: "next-app-server",
          version: resolveAppVersion(),
          db: "failed",
        },
      },
      { status: 500 },
    );
  }
}
