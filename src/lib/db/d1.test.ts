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

const lastSql = () => String(query.mock.calls.at(-1)?.[0]);
const lastParams = () => query.mock.calls.at(-1)?.[1];
const ownScope = { sql: "student_id = ?", params: ["s1"] };

describe("guarded writes", () => {
  beforeEach(() => query.mockReset().mockResolvedValue([]));

  it.each(["delete", "update"] as const)("refuses to %s without a filter", async (action) => {
    const result = await executeDataRequest({
      table: "learning_goals",
      action,
      values: action === "update" ? { is_complete: true } : undefined,
      filters: [],
    });
    expect(result.error).toEqual({ message: `Refusing to ${action} rows without a filter.`, status: 400 });
    expect(query).not.toHaveBeenCalled();
  });

  it("returns the updated rows and scopes the update", async () => {
    query.mockResolvedValueOnce([{ id: "g1", is_complete: 1 }]);
    const result = await executeDataRequest(
      { table: "learning_goals", action: "update", values: { is_complete: true }, filters: [{ op: "eq", column: "id", value: "g1" }] },
      { scope: ownScope },
    );
    expect(lastSql()).toBe('UPDATE "learning_goals" SET "is_complete" = ? WHERE "id" = ? AND (student_id = ?) RETURNING *');
    expect(lastParams()).toEqual([1, "g1", "s1"]);
    expect(result).toEqual({ data: [{ id: "g1", is_complete: true }], error: null });
  });

  it("ANDs the scope into deletes", async () => {
    await executeDataRequest(
      { table: "learning_goals", action: "delete", filters: [{ op: "eq", column: "id", value: "g1" }] },
      { scope: ownScope },
    );
    expect(lastSql()).toBe('DELETE FROM "learning_goals" WHERE "id" = ? AND (student_id = ?)');
    expect(lastParams()).toEqual(["g1", "s1"]);
  });
});

describe("null filters", () => {
  beforeEach(() => query.mockReset().mockResolvedValue([]));

  it("translates is(null) and not(is, null) to IS NULL / IS NOT NULL", async () => {
    await executeDataRequest({
      table: "quiz_questions",
      action: "delete",
      filters: [
        { op: "eq", column: "lesson_id", value: "l1" },
        { op: "is", column: "section_id", value: null },
      ],
    });
    expect(lastSql()).toBe('DELETE FROM "quiz_questions" WHERE "lesson_id" = ? AND "section_id" IS NULL');
    expect(lastParams()).toEqual(["l1"]);

    await executeDataRequest({
      table: "student_progress",
      action: "select",
      columns: "score",
      filters: [{ op: "is_not", column: "score", value: null }],
    });
    expect(lastSql()).toBe('SELECT "score" FROM "student_progress" WHERE "score" IS NOT NULL');
  });

  it("binds boolean is() filters", async () => {
    await executeDataRequest({ table: "teacher_alerts", action: "select", filters: [{ op: "is", column: "is_dismissed", value: false }] });
    expect(lastSql()).toBe('SELECT * FROM "teacher_alerts" WHERE "is_dismissed" IS ?');
    expect(lastParams()).toEqual([0]);
  });

  it("binds an in() list as a single JSON parameter, however long", async () => {
    const values = Array.from({ length: 300 }, (_, i) => `id-${i}`);
    await executeDataRequest(
      { table: "learning_goals", action: "select", filters: [{ op: "in", column: "id", value: values }] },
      { scope: ownScope },
    );
    expect(lastSql()).toBe('SELECT * FROM "learning_goals" WHERE "id" IN (SELECT value FROM json_each(?)) AND (student_id = ?)');
    expect(lastParams()).toEqual([JSON.stringify(values), "s1"]);

    await executeDataRequest({ table: "learning_goals", action: "delete", filters: [{ op: "in", column: "id", value: [] }] });
    expect(lastSql()).toBe('DELETE FROM "learning_goals" WHERE 1 = 0');
    expect(lastParams()).toEqual([]);
  });

  it("rejects unknown operators", async () => {
    const result = await executeDataRequest({
      table: "profiles",
      action: "select",
      filters: [{ op: "like", column: "email", value: "%" } as never],
    });
    expect(result.error).toEqual({ message: "Unsupported filter operator.", status: 400 });
    expect(query).not.toHaveBeenCalled();
  });
});

describe("scoped reads", () => {
  beforeEach(() => query.mockReset().mockResolvedValue([]));

  it("applies the scope to the count and the rows, and clamps the limit", async () => {
    query.mockResolvedValueOnce([{ count: 2 }]).mockResolvedValueOnce([{ id: "a" }, { id: "b" }]);
    const result = await executeDataRequest(
      {
        table: "student_progress",
        action: "select",
        count: "exact",
        filters: [{ op: "eq", column: "lesson_id", value: "l1" }],
        limit: 5000,
      },
      { scope: ownScope },
    );
    expect(query.mock.calls[0]?.[0]).toBe('SELECT COUNT(*) AS count FROM "student_progress" WHERE "lesson_id" = ? AND (student_id = ?)');
    expect(lastSql()).toBe('SELECT * FROM "student_progress" WHERE "lesson_id" = ? AND (student_id = ?) LIMIT 1000');
    expect(lastParams()).toEqual(["l1", "s1"]);
    expect(result.count).toBe(2);
  });

  it("looks up embedded lesson titles and class names with one parameter each", async () => {
    const assignments = Array.from({ length: 150 }, (_, i) => ({ id: `a${i}`, lesson_id: `l${i}`, class_id: `c${i % 120}` }));
    query
      .mockResolvedValueOnce(assignments)
      .mockResolvedValueOnce([{ id: "l0", title: "Fractions" }])
      .mockResolvedValueOnce(assignments)
      .mockResolvedValueOnce([{ id: "c0", name: "Math 7" }]);

    const lessons = await executeDataRequest({ table: "lesson_assignments", action: "select", columns: "id, lesson_id, lessons(title)" });
    expect(query.mock.calls[1]).toEqual([
      "SELECT id, title FROM lessons WHERE id IN (SELECT value FROM json_each(?))",
      [JSON.stringify(assignments.map((row) => row.lesson_id))],
    ]);
    expect((lessons.data as Record<string, unknown>[]).slice(0, 2)).toEqual([
      expect.objectContaining({ id: "a0", lessons: { id: "l0", title: "Fractions" } }),
      expect.objectContaining({ id: "a1", lessons: null }),
    ]);

    const classes = await executeDataRequest({ table: "lesson_assignments", action: "select", columns: "id, class_id, classes(name)" });
    expect(query.mock.calls[3]).toEqual([
      "SELECT id, name FROM classes WHERE id IN (SELECT value FROM json_each(?))",
      [JSON.stringify(Array.from({ length: 120 }, (_, i) => `c${i}`))],
    ]);
    expect((classes.data as Record<string, unknown>[])[0]).toMatchObject({ classes: { id: "c0", name: "Math 7" } });
  });
});

describe("upsert ownership", () => {
  beforeEach(() => query.mockReset().mockResolvedValue([]));

  it("only accepts id or a declared unique key as the conflict target", async () => {
    const result = await executeDataRequest({
      table: "student_progress",
      action: "upsert",
      values: { lesson_id: "l1", status: "completed" },
      onConflict: "lesson_id",
    });
    expect(result.error).toEqual({ message: "Unsupported conflict target for student_progress: lesson_id.", status: 400 });
    expect(query).not.toHaveBeenCalled();
  });

  it("guards DO UPDATE with the caller's scope", async () => {
    query.mockResolvedValueOnce([{ id: "p1", student_id: "s1", lesson_id: "l1", status: "completed" }]);
    const result = await executeDataRequest(
      { table: "student_progress", action: "upsert", values: { id: "p1", student_id: "s1", lesson_id: "l1", status: "completed" } },
      { scope: ownScope },
    );
    expect(lastSql()).toContain('ON CONFLICT("id") DO UPDATE SET');
    expect(lastSql()).toMatch(/ WHERE \(student_id = \?\) RETURNING \*$/);
    expect(lastParams()).toEqual(["p1", "s1", "l1", "completed", "s1"]);
    expect(result.error).toBeNull();
  });

  it("rejects an upsert whose conflicting row belongs to someone else", async () => {
    const result = await executeDataRequest(
      { table: "student_progress", action: "upsert", values: { id: "someone-elses", student_id: "s1", lesson_id: "l1", score: 100 } },
      { scope: ownScope },
    );
    expect(result).toEqual({ data: null, error: { message: "That record belongs to someone else.", status: 403 } });
  });

  it("does not return someone else's row when there is nothing to update", async () => {
    const result = await executeDataRequest(
      { table: "class_enrollments", action: "upsert", values: { class_id: "c1", student_id: "s1" }, onConflict: "class_id,student_id" },
      { scope: ownScope },
    );
    expect(lastSql()).toBe(
      'SELECT * FROM "class_enrollments" WHERE "class_id" IS ? AND "student_id" IS ? AND (student_id = ?) LIMIT 1',
    );
    expect(result.error).toEqual({ message: "That record belongs to someone else.", status: 403 });
  });

  it("maps constraint failures to 409 and hides other database errors", async () => {
    query.mockRejectedValueOnce(new Error("D1_ERROR: UNIQUE constraint failed: classes.join_code"));
    const conflict = await executeDataRequest({ table: "classes", action: "insert", values: { name: "x", teacher_id: "t1" } });
    expect(conflict.error?.status).toBe(409);

    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    query.mockRejectedValueOnce(new Error("no such column: secret_internal"));
    const hidden = await executeDataRequest({ table: "classes", action: "select" });
    expect(hidden.error).toEqual({ message: "The data request could not be completed.", status: 500 });
    log.mockRestore();
  });
});
