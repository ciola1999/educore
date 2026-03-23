import { isTauri } from "@/core/env";

const PASSWORD_HASH_OPTIONS = {
  type: 2 as const,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

function isNodeRuntime(): boolean {
  return (
    typeof process !== "undefined" &&
    typeof process.versions === "object" &&
    typeof process.versions.node === "string"
  );
}

async function hashPasswordNode(password: string): Promise<string> {
  const argon2 = await import("argon2");
  return argon2.hash(password, PASSWORD_HASH_OPTIONS);
}

async function verifyPasswordNode(
  password: string,
  hash: string,
): Promise<boolean> {
  const argon2 = await import("argon2");
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/**
 * Hash a plain-text password with secure parameters
 * Note: This function only works in Tauri desktop environment or server-side
 */
export async function hashPassword(password: string): Promise<string> {
  // For Tauri desktop, use argon2 via Tauri command
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    const result = await invoke<{
      success: boolean;
      hash?: string;
      error?: string;
    }>("set_password", {
      request: {
        user_id: "temp", // user_id is still required by the struct but we focus on return hash
        password: password,
        is_first_time: true,
      },
    });

    if (result.success && result.hash) {
      return result.hash;
    }
    throw new Error(result.error || "Gagal membuat hash password");
  }

  if (isNodeRuntime()) {
    return hashPasswordNode(password);
  }

  throw new Error(
    "Password hashing is only supported in Tauri or server runtime",
  );
}

/**
 * Verify a password against a hash
 * Works in Tauri desktop environment
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  // For Tauri desktop, use argon2 via Tauri command
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");

    try {
      const result = await invoke<{ success: boolean; error?: string }>(
        "verify_password",
        {
          request: {
            password: password,
            stored_hash: hash,
          },
        },
      );

      return result.success;
    } catch (e) {
      console.error("Password verification error:", e);
      return false;
    }
  }

  if (isNodeRuntime()) {
    return verifyPasswordNode(password, hash);
  }

  throw new Error(
    "Password verification is only supported in Tauri or server runtime",
  );
}

/**
 * Generate a default password hash for seeding
 * Default: "admin123"
 */
export async function getDefaultAdminHash(): Promise<string> {
  return hashPassword("admin123");
}
