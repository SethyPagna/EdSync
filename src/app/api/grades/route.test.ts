// @vitest-environment node
import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/auth/session";
import type { D1QueryAdapter } from "@/lib/db/d1-adapter";
import {
  OTHER_TEACHER,
  STUDENT,
  TEACHER,
  createGradingDatabase,
  insertRows,
  jsonRequest,
  readJson,
  selectAll,
  selectOne,
  sqliteAdapter,
} from "@/lib/grades/test-support";
import { GET, POST } from "./route";

const state = vi.hoisted(() => ({
  adapter: null as unknown,
  user: null as SessionUser | null,
}));

vi.mock("@/lib/db/d1-adapter", () => ({ getD1QueryAdapter: () => state.adapter }));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: async () => state.user }));
vi.mock("@/lib/tenancy", () => ({
  DEFAULT_TENANT_ID: "tenant_edsync_default",
  resolveTenantContext: async () => ({ tenant: { id: "tenant_edsync_default" }, portal: null, membership: null }),
  linkTenantObject: async (input: { tenantId: string; portalId?: string | null; table: string; objectId: string }) => {
    await (state.adapter as D1QueryAdapter).query(
      `INSERT OR IGNORE INTO tenant_object_links (id, tenant_id, portal_id, object_table, object_id, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [crypto.randomUUID(), input.tenantId, input.portalId ?? null, input.table, input.objectId],
    );
  },
}));

let db: DatabaseSync;

beforeEach(() => {
  db = createGradingDatabase();
  state.adapter = sqliteAdapter(db);
  state.user = TEACHER;
  insertRows(db, "learning_work_items", [
    { id: "work-bio", teacher_id: TEACHER.id, class_id: "class-1", title: "Cell diagram", work_type: "task", status: "published" },
    { id: "work-chem", teacher_id: OTHER_TEACHER.id, class_id: "class-2", title: "Titration", work_type: "task", status: "published" },
  ]);
});

function grade(body: Record<string, unknown>) {
  return POST(
    jsonRequest("/api/grades", "POST", {
      studentId: STUDENT.id,
      classId: "class-1",
      title: "Quiz",
      pointsEarned: 8,
      pointsPossible: 10,
      ...body,
    }),
  );
}

function scoresFor(sourceType: string, sourceId: string) {
  return selectAll(
    db,
    "SELECT * FROM gradebook_scores WHERE student_id = ? AND source_type = ? AND source_id = ?",
    STUDENT.id,
    sourceType,
    sourceId,
  );
}

describe("POST /api/grades (manual scores)", () => {
  it("generates manual source ids on the server", async () => {
    const first = await readJson(await grade({ sourceType: "manual" }));
    const second = await readJson(await grade({ title: "Another" }));
    expect(first.data?.sourceType).toBe("manual");
    expect(first.data?.sourceId).toEqual(expect.any(String));
    expect(second.data?.sourceId).not.toBe(first.data?.sourceId);
    expect(selectOne(db, "SELECT COUNT(*) AS n FROM gradebook_scores WHERE source_type = 'manual'")?.n).toBe(2);
    expect(JSON.parse(String(scoresFor("manual", String(first.data?.sourceId))[0].metadata))).toMatchObject({
      gradedByRole: "teacher",
      gradedBy: TEACHER.id,
    });
  });

  it("updates an existing manual score only through its own class", async () => {
    const created = await readJson(await grade({}));
    const sourceId = String(created.data?.sourceId);

    const updated = await grade({ sourceId, pointsEarned: 10 });
    expect(updated.status).toBe(200);
    expect(scoresFor("manual", sourceId)[0]).toMatchObject({ percent: 100 });

    expect((await grade({ sourceId: "made-up-id" })).status).toBe(404);
    expect(selectOne(db, "SELECT COUNT(*) AS n FROM gradebook_scores")?.n).toBe(1);
  });

  it("refuses to write a score for another class's work item", async () => {
    state.user = OTHER_TEACHER;
    expect((await grade({ classId: "class-2", sourceType: "task", sourceId: "work-chem", pointsEarned: 9 })).status).toBe(200);

    state.user = TEACHER;
    const crossClass = await grade({ classId: "class-1", sourceType: "task", sourceId: "work-chem", pointsEarned: 0 });
    expect(crossClass.status).toBe(404);
    expect((await readJson(crossClass)).error).toBe("Graded item not found in this class.");
    expect((await grade({ classId: "class-2", sourceType: "task", sourceId: "work-chem", pointsEarned: 0 })).status).toBe(404);
    expect((await grade({ classId: null, sourceType: "task", sourceId: "work-chem", pointsEarned: 0 })).status).toBe(404);
    expect(scoresFor("task", "work-chem")).toEqual([expect.objectContaining({ percent: 90, teacher_id: OTHER_TEACHER.id })]);

    expect((await grade({ sourceType: "task", sourceId: "work-bio" })).status).toBe(200);
    expect((await grade({ sourceType: "test", sourceId: "work-bio" })).status).toBe(404);
    expect((await grade({ sourceType: "task" })).status).toBe(400);
  });

  it("rejects source types the database does not allow with 400", async () => {
    const response = await grade({ sourceType: "manual.override" });
    expect(response.status).toBe(400);
    expect((await readJson(response)).error).toContain("Grade source must be one of");
  });

  it("persists the category and weights the student overall like the teacher view", async () => {
    await grade({ title: "Unit test", categoryId: "cat-tests", pointsEarned: 9, pointsPossible: 10 });
    await grade({ title: "Worksheet", categoryId: "cat-homework", pointsEarned: 5, pointsPossible: 10 });
    expect(
      selectAll(db, "SELECT title, category_id FROM gradebook_scores ORDER BY title").map((row) => ({ ...row })),
    ).toEqual([
      { title: "Unit test", category_id: "cat-tests" },
      { title: "Worksheet", category_id: "cat-homework" },
    ]);

    const teacherView = await readJson(await GET(new Request("http://localhost/api/grades?classId=class-1")));
    const rows = teacherView.data?.rows as Array<{ studentId: string; overall: number }>;
    // Tests weigh 3, homework 1: (90 * 3 + 50) / 4 = 80 (an unweighted mean would be 70).
    expect(rows).toEqual([expect.objectContaining({ studentId: STUDENT.id, overall: 80 })]);

    state.user = STUDENT;
    const studentView = await readJson(await GET(new Request("http://localhost/api/grades")));
    expect(studentView.data).toMatchObject({ overall: 80, overallByClass: { "class-1": 80 } });
  });

  it("gives each class an equal share of the student overall, whatever its category weights", async () => {
    insertRows(db, "gradebook_categories", [
      { id: "cat-major", class_id: "class-1", teacher_id: TEACHER.id, name: "Major", weight: 60 },
      { id: "cat-minor", class_id: "class-1", teacher_id: TEACHER.id, name: "Minor", weight: 40 },
    ]);
    await grade({ title: "Exam", categoryId: "cat-major", pointsEarned: 9, pointsPossible: 10 });
    await grade({ title: "Quiz", categoryId: "cat-minor", pointsEarned: 9, pointsPossible: 10 });
    state.user = OTHER_TEACHER;
    expect((await grade({ classId: "class-2", title: "Lab", pointsEarned: 1, pointsPossible: 10 })).status).toBe(200);

    state.user = STUDENT;
    const twoClasses = await readJson(await GET(new Request("http://localhost/api/grades")));
    // Pooling the categories across classes would give (90 * 60 + 90 * 40 + 10) / 101 = 89.21.
    expect(twoClasses.data).toMatchObject({ overall: 50, overallByClass: { "class-1": 90, "class-2": 10 } });

    state.user = TEACHER;
    expect((await grade({ classId: null, title: "Extra credit", pointsEarned: 2, pointsPossible: 10 })).status).toBe(200);
    state.user = STUDENT;
    const withClassless = await readJson(await GET(new Request("http://localhost/api/grades")));
    expect(withClassless.data).toMatchObject({ overall: 40, overallByClass: { "class-1": 90, "class-2": 10 } });
    expect(Object.keys(withClassless.data?.overallByClass as object)).toHaveLength(2);
  });

  it("keeps the category when a later write does not send one, and clears it when sent as null", async () => {
    const created = await readJson(await grade({ categoryId: "cat-tests" }));
    const sourceId = String(created.data?.sourceId);
    await grade({ sourceId, pointsEarned: 7 });
    expect(scoresFor("manual", sourceId)[0]).toMatchObject({ category_id: "cat-tests", percent: 70 });
    await grade({ sourceId, categoryId: null });
    expect(scoresFor("manual", sourceId)[0]).toMatchObject({ category_id: null });
  });

  it("rejects categories from another class", async () => {
    expect((await grade({ categoryId: "cat-labs" })).status).toBe(404);
    expect(selectOne(db, "SELECT COUNT(*) AS n FROM gradebook_scores")?.n).toBe(0);
  });

  it("returns 400/401/403 for bad requests", async () => {
    expect((await POST(jsonRequest("/api/grades", "POST", "not json"))).status).toBe(400);
    expect((await grade({ studentId: "" })).status).toBe(400);
    state.user = STUDENT;
    expect((await grade({})).status).toBe(403);
    state.user = null;
    expect((await grade({})).status).toBe(401);
  });
});
