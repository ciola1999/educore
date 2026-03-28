import { describe, expect, it } from "vitest";
import { SYNC_TABLE_NAMES } from "./turso-sync";

describe("turso sync table coverage", () => {
  it("includes phase 2.1 academic master data in dependency order", () => {
    expect(SYNC_TABLE_NAMES).toContain("tahun_ajaran");
    expect(SYNC_TABLE_NAMES).toContain("semester");
    expect(SYNC_TABLE_NAMES).toContain("subjects");
    expect(SYNC_TABLE_NAMES).toContain("classes");
    expect(SYNC_TABLE_NAMES).toContain("guru_mapel");

    expect(SYNC_TABLE_NAMES.indexOf("tahun_ajaran")).toBeLessThan(
      SYNC_TABLE_NAMES.indexOf("semester"),
    );
    expect(SYNC_TABLE_NAMES.indexOf("semester")).toBeLessThan(
      SYNC_TABLE_NAMES.indexOf("guru_mapel"),
    );
  });

  it("syncs canonical jadwal and does not depend on legacy schedule table", () => {
    expect(SYNC_TABLE_NAMES).toContain("jadwal");
    expect(SYNC_TABLE_NAMES).not.toContain("schedule");
    expect(SYNC_TABLE_NAMES.indexOf("guru_mapel")).toBeLessThan(
      SYNC_TABLE_NAMES.indexOf("jadwal"),
    );
  });
});
