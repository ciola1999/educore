import { describe, expect, it } from "vitest";
import {
  camelToSnake,
  generateUpsertSql,
  snakeToCamel,
  sortColumns,
  toLibsqlArgs,
} from "./turso-sync";

describe("turso sync contract", () => {
  it("normalizes camelCase records to snake_case sync payloads", () => {
    const payload = camelToSnake({
      id: "user-1",
      fullName: "Admin",
      createdAt: new Date("2026-03-18T09:00:00.000Z"),
      updatedAt: new Date("2026-03-18T10:00:00.000Z"),
      deletedAt: null,
      syncStatus: "pending",
      passwordHash: "hash-1",
      optionalField: undefined,
    });

    expect(payload).toEqual({
      id: "user-1",
      full_name: "Admin",
      created_at: 1_773_824_400,
      updated_at: 1_773_828_000,
      deleted_at: null,
      password_hash: "hash-1",
    });
  });

  it("rebuilds remote snake_case payloads into local camelCase values", () => {
    const payload = snakeToCamel({
      id: "user-1",
      full_name: "Admin",
      updated_at: 1_763_292_000,
      deleted_at: null,
    });

    expect(payload).toEqual({
      id: "user-1",
      fullName: "Admin",
      updatedAt: new Date(1_763_292_000 * 1000),
      deletedAt: null,
    });
  });

  it("normalizes string timestamps from cloud rows into Date values", () => {
    const payload = snakeToCamel({
      created_at: "1763292000",
      updated_at: "1763295600",
      deleted_at: null,
    });

    expect(payload).toEqual({
      createdAt: new Date(1_763_292_000 * 1000),
      updatedAt: new Date(1_763_295_600 * 1000),
      deletedAt: null,
    });
  });

  it("normalizes non-_at timestamp columns used by schema", () => {
    const payload = snakeToCamel({
      tanggal_lahir: 1_763_000_000,
      check_in_time: "1763292000",
      tanggal_bayar: null,
    });

    expect(payload).toEqual({
      tanggalLahir: new Date(1_763_000_000 * 1000),
      checkInTime: new Date(1_763_292_000 * 1000),
      tanggalBayar: null,
    });
  });

  it("sorts columns and builds an explicit upsert statement", () => {
    const columns = sortColumns({
      updated_at: 1,
      id: "user-1",
      full_name: "Admin",
    });

    expect(columns).toEqual(["full_name", "id", "updated_at"]);
    expect(generateUpsertSql("users", columns, "id")).toContain(
      'excluded.updated_at > "users".updated_at',
    );
    expect(generateUpsertSql("users", ["full_name"], "id")).toBeNull();
  });

  it("converts only libsql-safe values into args", () => {
    expect(
      toLibsqlArgs(["id", "is_active", "deleted_at"], {
        id: "user-1",
        is_active: true,
        deleted_at: null,
      }),
    ).toEqual(["user-1", true, null]);

    expect(() =>
      toLibsqlArgs(["meta"], {
        meta: Symbol("bad"),
      }),
    ).toThrow('Unsupported sync value for column "meta"');
  });
});
