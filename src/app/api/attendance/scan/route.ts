import { requirePermission } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  const guard = requirePermission(session, "attendance:write");
  if (guard) {
    return guard;
  }

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError(
        "Payload QR scan harus berupa JSON yang valid",
        400,
        "VALIDATION_ERROR",
      );
    }

    const { qrScanSchema } = await import("@/core/validation/schemas");
    const parsed = qrScanSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        parsed.error.issues[0]?.message || "Payload QR scan tidak valid",
        400,
        "VALIDATION_ERROR",
      );
    }

    const { qrData } = parsed.data;
    const { processQRScan } = await import(
      "@/core/services/attendance-service"
    );
    const result = await processQRScan(qrData);
    return apiOk(result);
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Internal Server Error",
      500,
    );
  }
}
