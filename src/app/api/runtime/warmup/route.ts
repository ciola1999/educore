import { NextResponse } from "next/server";
import { getDatabase } from "@/core/db/connection";

export async function GET() {
  try {
    await getDatabase();
    return NextResponse.json({
      success: true,
      data: {
        ready: true,
      },
    });
  } catch (error) {
    console.error("[RUNTIME_WARMUP_ERROR]", error);
    return NextResponse.json(
      {
        success: false,
        error: "APP_WARMUP_FAILED",
        message: "Gagal menyiapkan runtime aplikasi.",
      },
      { status: 500 },
    );
  }
}
