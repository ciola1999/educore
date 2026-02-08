import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../db";
import { supabase } from "./client";
import { fullSync, pullFromSupabase, pushToSupabase } from "./sync";

vi.mock("../db", () => ({
	getDb: vi.fn(),
}));

vi.mock("./client", () => ({
	supabase: {
		from: vi.fn(),
		select: vi.fn(),
		upsert: vi.fn(),
	},
}));

const mockedSupabase = vi.mocked(supabase);
const mockedGetDb = vi.mocked(getDb);

describe("Supabase Sync Service", () => {
	// A more robust mock that is both a builder and a thenable
	const createMockDb = () => {
		const mock: any = {
			// biome-ignore lint/suspicious/noThenProperty: Required for Drizzle awaitable mocking
			then: vi.fn((onFulfilled) => Promise.resolve([]).then(onFulfilled)),
			select: vi.fn(),
			from: vi.fn(),
			where: vi.fn(),
			limit: vi.fn(),
			insert: vi.fn(),
			values: vi.fn(),
			update: vi.fn(),
			set: vi.fn(),
			groupBy: vi.fn(),
			leftJoin: vi.fn(),
			delete: vi.fn(),
			transaction: vi.fn(),
		};

		mock.select.mockReturnValue(mock);
		mock.from.mockReturnValue(mock);
		mock.where.mockReturnValue(mock);
		mock.limit.mockReturnValue(mock);
		mock.insert.mockReturnValue(mock);
		mock.values.mockReturnValue(mock);
		mock.update.mockReturnValue(mock);
		mock.set.mockReturnValue(mock);
		mock.groupBy.mockReturnValue(mock);
		mock.leftJoin.mockReturnValue(mock);
		mock.delete.mockReturnValue(mock);

		return mock;
	};

	let mockDb: any;

	beforeEach(() => {
		vi.clearAllMocks();
		mockDb = createMockDb();
		mockedGetDb.mockResolvedValue(mockDb);

		// Setup Supabase defaults
		const mockSb = mockedSupabase as any;
		mockSb.from.mockReturnValue(mockSb);
		mockSb.select.mockResolvedValue({ data: [], error: null });
		mockSb.upsert.mockResolvedValue({ error: null });
	});

	describe("pushToSupabase", () => {
		it("should push students to Supabase", async () => {
			// Override the thenable to return data for this test
			mockDb.then.mockImplementation((onFulfilled: any) =>
				Promise.resolve([{ id: "1", fullName: "Test" }]).then(onFulfilled),
			);

			const result = await pushToSupabase();

			expect(result.status).toBe("success");
			expect(result.uploaded).toBeGreaterThanOrEqual(0);
			expect(mockedSupabase.from).toHaveBeenCalledWith("students");
		});

		it("should handle push errors", async () => {
			mockDb.then.mockImplementation((onFulfilled: any) =>
				Promise.resolve([{ id: "1" }]).then(onFulfilled),
			);
			(mockedSupabase as any).upsert.mockResolvedValue({
				error: { message: "Supabase Error" },
			});

			const result = await pushToSupabase();
			expect(result.status).toBe("error");
			expect(result.message).toBe("Supabase Error");
		});
	});

	describe("pullFromSupabase", () => {
		it("should pull new students from Supabase", async () => {
			(mockedSupabase as any).select.mockResolvedValueOnce({
				data: [{ id: "remote-1", full_name: "Remote User" }],
				error: null,
			});
			// Should return empty array for existing check
			mockDb.then.mockImplementation((onFulfilled: any) =>
				Promise.resolve([]).then(onFulfilled),
			);

			const result = await pullFromSupabase();

			expect(result.status).toBe("success");
			expect(result.downloaded).toBe(1);
			expect(mockDb.insert).toHaveBeenCalled();
		});

		it("should skip pull if records exist locally", async () => {
			(mockedSupabase as any).select.mockResolvedValueOnce({
				data: [{ id: "local-1" }],
				error: null,
			});
			// Should return existing record
			mockDb.then.mockImplementation((onFulfilled: any) =>
				Promise.resolve([{ id: "local-1" }]).then(onFulfilled),
			);

			const result = await pullFromSupabase();
			expect(result.downloaded).toBe(0);
			expect(mockDb.insert).not.toHaveBeenCalled();
		});
	});

	describe("fullSync", () => {
		it("should run push then pull", async () => {
			const result = await fullSync();
			expect(result.status).toBe("success");
		});
	});
});
