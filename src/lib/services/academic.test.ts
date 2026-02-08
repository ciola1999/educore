import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../db";
import { addClass, addSubject, deleteClass, updateClass } from "./academic";

vi.mock("../db", () => ({
	getDb: vi.fn(),
}));

describe("Academic Service", () => {
	const mockDb: any = {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		limit: vi.fn().mockReturnThis(),
		leftJoin: vi.fn().mockReturnThis(),
		insert: vi.fn().mockReturnThis(),
		values: vi.fn().mockReturnThis(),
		update: vi.fn().mockReturnThis(),
		set: vi.fn().mockReturnThis(),
		delete: vi.fn().mockReturnThis(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
		(getDb as any).mockResolvedValue(mockDb);

		// Mock global crypto for UUID generation
		vi.spyOn(crypto, "randomUUID").mockReturnValue("test-uuid" as any);
	});

	it("should add a class successfully", async () => {
		const classData = { name: "Class 1A", academicYear: "2025/2026" };
		const result = await addClass(classData);

		expect(result.success).toBe(true);
		expect(mockDb.insert).toHaveBeenCalled();
		expect(mockDb.values).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "Class 1A",
				academicYear: "2025/2026",
			}),
		);
	});

	it("should update a class successfully", async () => {
		const updateData = { name: "Class 1B", academicYear: "2025/2026" };
		const result = await updateClass("class-id", updateData);

		expect(result.success).toBe(true);
		expect(mockDb.update).toHaveBeenCalled();
		expect(mockDb.set).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "Class 1B",
			}),
		);
	});

	it("should delete a class successfully", async () => {
		const result = await deleteClass("class-id");

		expect(result.success).toBe(true);
		expect(mockDb.delete).toHaveBeenCalled();
	});

	it("should add a subject successfully", async () => {
		const subjectData = { name: "Mathematics", code: "MATH101" };
		const result = await addSubject(subjectData);

		expect(result.success).toBe(true);
		expect(mockDb.insert).toHaveBeenCalled();
		expect(mockDb.values).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "Mathematics",
				code: "MATH101",
			}),
		);
	});
});
