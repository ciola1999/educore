import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../db";
import { verifyPassword } from "./hash";
import { login } from "./service";

// Mock the database and hash utilities
vi.mock("../db", () => ({
	getDb: vi.fn(),
}));

vi.mock("./hash", () => ({
	hashPassword: vi.fn(),
	verifyPassword: vi.fn(),
}));

describe("Auth Service", () => {
	const mockDb: any = {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		limit: vi.fn().mockReturnThis(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
		(getDb as any).mockResolvedValue(mockDb);
	});

	it("should return error if user not found", async () => {
		mockDb.limit.mockResolvedValue([]);

		const result = await login("none@example.com", "password");
		expect(result.success).toBe(false);
		expect(result.error).toBe("Email tidak ditemukan");
	});

	it("should return error if password not set", async () => {
		mockDb.limit.mockResolvedValue([
			{ id: "1", email: "test@example.com", passwordHash: null },
		]);

		const result = await login("test@example.com", "password");
		expect(result.success).toBe(false);
		expect(result.error).toBe("Password belum diatur. Hubungi admin.");
	});

	it("should return error if password incorrect", async () => {
		mockDb.limit.mockResolvedValue([
			{ id: "1", email: "test@example.com", passwordHash: "hashed_pw" },
		]);
		(verifyPassword as any).mockResolvedValue(false);

		const result = await login("test@example.com", "wrong_password");
		expect(result.success).toBe(false);
		expect(result.error).toBe("Password salah");
	});

	it("should return success and user if credentials correct", async () => {
		const mockUser = {
			id: "1",
			fullName: "Test User",
			email: "test@example.com",
			role: "admin",
			passwordHash: "hashed_pw",
		};
		mockDb.limit.mockResolvedValue([mockUser]);
		(verifyPassword as any).mockResolvedValue(true);

		const result = await login("test@example.com", "correct_password");

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.user.id).toBe("1");
			expect(result.user.fullName).toBe("Test User");
			// @ts-expect-error
			expect(result.user.passwordHash).toBeUndefined();
		}
	});

	it("should handle system errors gracefully", async () => {
		mockDb.limit.mockRejectedValue(new Error("DB Error"));

		const result = await login("test@example.com", "password");
		expect(result.success).toBe(false);
		expect(result.error).toBe("Terjadi kesalahan sistem");
	});
});
