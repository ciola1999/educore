import { describe, expect, it } from "vitest";
import { getDefaultAdminHash, hashPassword, verifyPassword } from "./hash";

describe("Auth Hash Utilities", () => {
	it("should hash a password successfully", async () => {
		const password = "mySecretPassword";
		const hash = await hashPassword(password);

		expect(hash).toBeDefined();
		expect(hash).not.toBe(password);
		expect(hash.length).toBeGreaterThan(20);
	});

	it("should verify a correct password", async () => {
		const password = "mySecretPassword";
		const hash = await hashPassword(password);

		const isValid = await verifyPassword(password, hash);
		expect(isValid).toBe(true);
	});

	it("should reject an incorrect password", async () => {
		const password = "mySecretPassword";
		const wrongPassword = "wrongPassword";
		const hash = await hashPassword(password);

		const isValid = await verifyPassword(wrongPassword, hash);
		expect(isValid).toBe(false);
	});

	it("should generate a correct default admin hash", async () => {
		const hash = await getDefaultAdminHash();
		const isValid = await verifyPassword("admin123", hash);
		expect(isValid).toBe(true);
	});
});
