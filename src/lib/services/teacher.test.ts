import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../db";
import { users } from "../db/schema";
import type { UserInsertInput } from "../validations/schemas";
import { addTeacher, deleteTeacher, getTeachers } from "./teacher";

vi.mock("../db", () => ({
	getDb: vi.fn(),
}));

vi.mock("../auth/hash", () => ({
	hashPassword: vi.fn().mockResolvedValue("hashed_password"),
}));

describe("Teacher Service", () => {
	const mockDb = {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		limit: vi.fn().mockReturnThis(),
		insert: vi.fn().mockReturnThis(),
		values: vi.fn().mockReturnThis(),
		delete: vi.fn().mockReturnThis(),
		orderBy: vi.fn().mockReturnThis(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
		(getDb as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockDb);
	});

	const validTeacherData: UserInsertInput = {
		fullName: "Guru Baru",
		email: "guru.baru@example.com",
		role: "teacher" as const,
		passwordHash: "password123",
	};

	it("should success adding teacher with unique email", async () => {
		mockDb.limit.mockResolvedValue([]); // No existing user

		const result = await addTeacher(validTeacherData);

		expect(result.success).toBe(true);
		expect(mockDb.insert).toHaveBeenCalled();
	});

	it("should fail when email already exists", async () => {
		mockDb.limit.mockResolvedValue([{ id: "existing-id" }]); // User exists

		const result = await addTeacher(validTeacherData);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.code).toBe("EMAIL_EXISTS");
		}
		expect(mockDb.insert).not.toHaveBeenCalled();
	});

	it("should handle database errors when saving", async () => {
		mockDb.limit.mockResolvedValue([]);
		mockDb.values.mockRejectedValue(new Error("Database Failure"));

		const result = await addTeacher(validTeacherData);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toContain("Gagal");
		}
	});

	describe("getTeachers", () => {
		it("should fetch teachers with default filters", async () => {
			mockDb.limit.mockResolvedValue([{ id: "1", fullName: "Guru 1" }]);

			const result = await getTeachers();

			expect(result).toHaveLength(1);
			expect(mockDb.from).toHaveBeenCalledWith(users);
		});

		it("should handle empty results", async () => {
			mockDb.limit.mockResolvedValue([]);

			const result = await getTeachers();

			expect(result).toEqual([]);
		});
	});

	describe("deleteTeacher", () => {
		it("should return true on successful deletion", async () => {
			mockDb.where.mockResolvedValue(true);

			const result = await deleteTeacher("some-id");

			expect(result).toBe(true);
			expect(mockDb.delete).toHaveBeenCalled();
		});

		it("should return false on failure", async () => {
			mockDb.where.mockRejectedValue(new Error("Delete failed"));

			const result = await deleteTeacher("some-id");

			expect(result).toBe(false);
		});
	});
});
