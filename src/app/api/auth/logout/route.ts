import { NextResponse } from "next/server";

/**
 * Logout API Route
 *
 * POST /api/auth/logout
 *
 * Clears the session and logs out the user
 */

export async function POST() {
  try {
    const response = NextResponse.json({
      success: true,
      message: "Logout berhasil",
    });

    const securePrefix =
      process.env.NODE_ENV === "production" ? "__Secure-" : "";
    const cookiesToClear = [
      `${securePrefix}next-auth.session-token`,
      `${securePrefix}next-auth.callback-url`,
      "next-auth.csrf-token",
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
