import { beforeEach, describe, expect, it, vi } from "vitest";
const query = vi.hoisted(() =>
  vi
    .fn<(sql: string, params?: unknown[]) => Promise<unknown[]>>()
    .mockResolvedValue([]),
);
vi.mock("./d1-adapter", () => ({ getD1QueryAdapter: () => ({ query }) }));
import { executeDataRequest } from "./d1";

describe("data upserts", () => {
  beforeEach(() => query.mockReset().mockResolvedValue([]));
  it("returns the persisted enrollment identity after conflict", async () => {
    query.mockResolvedValueOnce([
      { id: "original-id", class_id: "c1", student_id: "s1", is_active: 1 },
    ]);
    const result = await executeDataRequest({
      table: "class_enrollments",
      action: "upsert",
      values: { class_id: "c1", student_id: "s1", is_active: true },
      onConflict: "class_id,student_id",
      single: true,
    });
    expect(result.data).toMatchObject({ id: "original-id" });
  });
  it("resolves existing identities when there is nothing to update", async () => {
    query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: "original-id", class_id: "c1", student_id: "s1" },
      ]);
    const result = await executeDataRequest({
      table: "class_enrollments",
      action: "upsert",
      values: { class_id: "c1", student_id: "s1" },
      onConflict: "class_id,student_id",
      single: true,
    });
    expect(result.data).toMatchObject({ id: "original-id" });
  });
  it("joins a class using a compound unique key without replacing the enrollment id", async () => {
    const result = await executeDataRequest({
      table: "class_enrollments",
      action: "upsert",
      values: { class_id: "class-1", student_id: "learner-1", is_active: true },
      onConflict: "class_id,student_id",
    });
    expect(result.error).toBeNull();
    const sql = query.mock.calls[0]?.[0] as unknown as string;
    expect(sql).toContain('ON CONFLICT("class_id", "student_id")');
    expect(sql.split("DO UPDATE SET")[1]).not.toContain('"id"');
    expect(sql).toContain('"is_active" = excluded."is_active"');
  });
  it("rejects malformed conflict identifiers before querying", async () => {
    const result = await executeDataRequest({
      table: "class_enrollments",
      action: "upsert",
      values: { class_id: "a" },
      onConflict: "class_id); DROP TABLE profiles;--",
    });
    expect(result.error?.message).toContain("Invalid SQL identifier");
    expect(query).not.toHaveBeenCalled();
  });
});
