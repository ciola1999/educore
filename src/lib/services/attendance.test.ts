import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../db";
import { recordBulkAttendance } from "./attendance";

vi.mock("../db", () => ({
	getDb: vi.fn(),
}));

describe("Attendance Service", () => {
	const mockTx: any = {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		limit: vi.fn().mockReturnThis(),
		update: vi.fn().mockReturnThis(),
		set: vi.fn().mockReturnThis(),
		insert: vi.fn().mockReturnThis(),
		values: vi.fn().mockReturnThis(),
	};

	const mockDb: any = {
		transaction: vi.fn().mockImplementation(async (cb) => cb(mockTx)),
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		limit: vi.fn().mockReturnThis(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
		(getDb as any).mockResolvedValue(mockDb);
	});

	const validBulkData = {
		classId: "550e8400-e29b-41d4-a716-446655440000",
		date: "2026-02-07",
		recordedBy: "550e8400-e29b-41d4-a716-446655440001",
		records: [
			{
				studentId: "550e8400-e29b-41d4-a716-446655440002",
				status: "present" as const,
				notes: "Good",
			},
			{
				studentId: "550e8400-e29b-41d4-a716-446655440003",
				status: "sick" as const,
				notes: "Flu",
			},
		],
	};

	it("should record bulk attendance with new entries (insert)", async () => {
		mockTx.limit.mockResolvedValue([]); // No existing records

		const result = await recordBulkAttendance(validBulkData);

		expect(result.success).toBe(true);
		expect(result.count).toBe(2);
		expect(mockTx.insert).toHaveBeenCalledTimes(2);
		expect(mockTx.update).not.toHaveBeenCalled();
	});

	it("should update existing attendance records", async () => {
		// Mock existing record for first student
		mockTx.limit.mockResolvedValueOnce([{ id: "existing-id" }]);
		// No existing for second student
		mockTx.limit.mockResolvedValueOnce([]);

		const result = await recordBulkAttendance(validBulkData);

		expect(result.success).toBe(true);
		expect(mockTx.update).toHaveBeenCalledTimes(1);
		expect(mockTx.insert).toHaveBeenCalledTimes(1);
	});

	it("should return error on validation failure", async () => {
		const invalidData = {
			...validBulkData,
			date: "invalid-date", // Should fail regex YYYY-MM-DD
		};

		const result = await recordBulkAttendance(invalidData as any);

		expect(result.success).toBe(false);
		expect(result.error).toBe("Validation failed");
	});

	it("should handle database errors gracefully", async () => {
		mockDb.transaction.mockRejectedValue(new Error("Transaction Failed"));

		const result = await recordBulkAttendance(validBulkData);

		expect(result.success).toBe(false);
		expect(result.error).toBe("Failed to record attendance");
	});
});
