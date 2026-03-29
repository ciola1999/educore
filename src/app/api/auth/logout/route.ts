import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/web/auth";

/**
 * Logout API Route
 *
 * POST /api/auth/logout
 *
 * Clears the session and logs out the user
 */

export async function POST() {
  try {
    await auth();

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
