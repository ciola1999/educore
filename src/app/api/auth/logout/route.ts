import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/web/auth";
import { createAuthDbClient } from "@/lib/auth/web/db";

/**
 * Logout API Route
 *
 * POST /api/auth/logout
 *
 * Clears the session and logs out the user
 */

export async function POST() {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (userId) {
      const client = createAuthDbClient();
      await client.execute({
        sql: `UPDATE users
              SET version = COALESCE(version, 1) + 1,
                  updated_at = CAST(strftime('%s', 'now') AS INTEGER),
                  sync_status = 'pending'
              WHERE id = ?`,
        args: [userId],
      });
    }

    const response = NextResponse.json({
      success: true,
      message: "Logout berhasil",
    });

    const securePrefix =
      process.env.NODE_ENV === "production" ? "__Secure-" : "";
    const cookiesToClear = [
      `${securePrefix}next-auth.session-token`,
      `${securePrefix}next-auth.callback-url`,
      `${securePrefix}authjs.session-token`,
      `${securePrefix}authjs.callback-url`,
      "authjs.session-token",
      "authjs.callback-url",
      "next-auth.csrf-token",
      "authjs.csrf-token",
    ];

    for (const cookieName of cookiesToClear) {
      response.cookies.set(cookieName, "", {
        expires: new Date(0),
        httpOnly: true,
        path: "/",
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
      });
    }

    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat logout" },
      { status: 500 },
    );
  }
}
