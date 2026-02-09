// Script to clear invalid holiday records

import { eq } from "drizzle-orm";
import { getDb } from "../src/lib/db/index";
import { holidays } from "../src/lib/db/schema";

async function clearInvalidHolidays() {
	console.log("🔍 Checking for invalid holiday records...");

	const db = await getDb();

	// Find all holidays
	const allHolidays = await db.select().from(holidays);

	console.log(`Found ${allHolidays.length} holiday records`);

	// Find invalid ones (null or empty name)
	const invalidHolidays = allHolidays.filter(
		(h) => !h.name || h.name.trim().length === 0,
	);

	if (invalidHolidays.length === 0) {
		console.log("✅ No invalid holiday records found");
		return;
	}

	console.log(`⚠️  Found ${invalidHolidays.length} invalid holiday records:`);
	invalidHolidays.forEach((h) => {
		console.log(
			`  - ID: ${h.id}, Date: ${h.date}, Name: "${h.name || "NULL"}"`,
		);
	});

	// Delete invalid records
	for (const holiday of invalidHolidays) {
		await db.delete(holidays).where(eq(holidays.id, holiday.id));
		console.log(`  ✅ Deleted holiday ID: ${holiday.id}`);
	}

	console.log(
		`\n✨ Cleaned up ${invalidHolidays.length} invalid holiday records`,
	);
}

clearInvalidHolidays()
	.then(() => {
		console.log("\n✅ Done!");
		process.exit(0);
	})
	.catch((err) => {
		console.error("❌ Error:", err);
		process.exit(1);
	});
