import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDatabaseMock } = vi.hoisted(() => ({
  getDatabaseMock: vi.fn(),
}));

vi.mock("@/core/db/connection", () => ({
  getDatabase: getDatabaseMock,
  getDb: getDatabaseMock,
}));

describe("Auth Service", () => {
  let mockDb: {
    select: ReturnType<typeof vi.fn>;
    from: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };
    getDatabaseMock.mockResolvedValue(mockDb);
  });

  it("should return error if user not found", async () => {
    const { login } = await import("./service");
    mockDb.limit.mockResolvedValue([]);

    const result = await login("none@example.com", "password");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Email tidak ditemukan");
    }
  }, 20000);

  it("should return error if password not set", async () => {
    const { login } = await import("./service");
    mockDb.limit.mockResolvedValue([
      { id: "1", email: "test@example.com", passwordHash: null },
    ]);

    const result = await login("test@example.com", "password");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Password belum diatur. Hubungi admin.");
    }
  }, 20000);

  it("should return error if password incorrect", async () => {
    const { hashPassword } = await import("./hash");
    const { login } = await import("./service");
    const passwordHash = await hashPassword("correct_password");
    mockDb.limit.mockResolvedValue([
      { id: "1", email: "test@example.com", passwordHash },
    ]);

    const result = await login("test@example.com", "wrong_password");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Password salah");
    }
  }, 20000);

  it("should return success and user if credentials correct", async () => {
    const { hashPassword } = await import("./hash");
    const { login } = await import("./service");
    const passwordHash = await hashPassword("correct_password");
    const mockUser = {
      id: "1",
      fullName: "Test User",
      email: "test@example.com",
      role: "admin",
      passwordHash,
    };
    mockDb.limit.mockResolvedValue([mockUser]);

    const result = await login("test@example.com", "correct_password");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.user.id).toBe("1");
      expect(result.user.fullName).toBe("Test User");
      expect("passwordHash" in result.user).toBe(false);
    }
  }, 20000);

  it("should handle system errors gracefully", async () => {
    const { login } = await import("./service");
    mockDb.limit.mockRejectedValue(new Error("DB Error"));

    const result = await login("test@example.com", "password");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Terjadi kesalahan sistem");
    }
  }, 20000);
});
