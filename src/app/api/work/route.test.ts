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
import { DELETE, PATCH, POST } from "./route";

const state = vi.hoisted(() => ({
  adapter: null as unknown,
  user: null as SessionUser | null,
}));

vi.mock("@/lib/db/d1-adapter", () => ({ getD1QueryAdapter: () => state.adapter }));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: async () => state.user }));
vi.mock("@/lib/engagement/server", () => ({ notifyAndEmail: vi.fn(async () => undefined) }));
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
});

async function create(body: Record<string, unknown>) {
  const response = await POST(jsonRequest("/api/work", "POST", { title: "Lab report", classId: "class-1", ...body }));
  return { response, body: await readJson(response) };
}

function patch(body: Record<string, unknown>) {
  return PATCH(jsonRequest("/api/work", "PATCH", body));
}

function deadlineCount(id: string) {
  return Number(selectOne(db, "SELECT COUNT(*) AS n FROM schedule_events WHERE json_extract(metadata, '$.workItemId') = ?", id)?.n);
}

/** class-3 and its lesson-4 belong to the same teacher as class-1. */
function seedTeachersOtherClass() {
  insertRows(db, "classes", [{ id: "class-3", teacher_id: TEACHER.id, name: "Physics" }]);
  insertRows(db, "lessons", [{ id: "lesson-4", teacher_id: TEACHER.id, class_id: "class-3", title: "Forces", status: "published" }]);
}

function workRow(id: string): Record<string, unknown> | undefined {
  const row = selectOne(db, "SELECT * FROM learning_work_items WHERE id = ?", id);
  return row ? { ...row, settings: JSON.parse(String(row.settings)), rubric: JSON.parse(String(row.rubric)) } : undefined;
}

describe("POST /api/work", () => {
  it("keeps a draft deadline private until publication", async () => {
    const { response, body } = await create({ status: "draft", dueAt: "2999-01-02T09:00:00Z" });
    expect(response.status).toBe(200);
    const id = String(body.data?.id);
    expect(deadlineCount(id)).toBe(0);
    expect((await patch({ id, title: "Draft revision" })).status).toBe(200);
    expect(deadlineCount(id)).toBe(0);
    expect((await patch({ id, status: "published" })).status).toBe(200);
    expect(deadlineCount(id)).toBe(1);
  });

  it("accepts a lesson and category from the same class", async () => {
    const { response, body } = await create({ lessonId: "lesson-1", categoryId: "cat-tests" });
    expect(response.status).toBe(200);
    expect(workRow(String(body.data?.id))).toMatchObject({ lesson_id: "lesson-1", category_id: "cat-tests", class_id: "class-1" });
  });

  it("rejects a lesson or category from another class", async () => {
    const lesson = await create({ lessonId: "lesson-3" });
    expect(lesson.response.status).toBe(400);
    expect(lesson.body.error).toBe("Choose a lesson from this class.");
    const category = await create({ categoryId: "cat-labs" });
    expect(category.response.status).toBe(400);
    expect(category.body.error).toBe("Choose a grade category from this class.");
    const classless = await create({ classId: null, categoryId: "cat-tests" });
    expect(classless.response.status).toBe(400);
    expect(selectOne(db, "SELECT COUNT(*) AS n FROM learning_work_items")?.n).toBe(0);
  });

  it("rejects the teacher's own lesson from another class", async () => {
    seedTeachersOtherClass();
    const otherClass = await create({ lessonId: "lesson-4" });
    expect(otherClass.response.status).toBe(400);
    expect(otherClass.body.error).toBe("Choose a lesson from this class.");
    expect(selectOne(db, "SELECT COUNT(*) AS n FROM learning_work_items")?.n).toBe(0);

    insertRows(db, "lesson_assignments", [
      { id: "assign-4", lesson_id: "lesson-4", class_id: "class-1", assigned_by: TEACHER.id, is_active: 1 },
    ]);
    expect((await create({ lessonId: "lesson-4" })).response.status).toBe(200);
  });

  it("lets work without a class link only lessons the teacher owns", async () => {
    seedTeachersOtherClass();
    expect((await create({ classId: null, lessonId: "lesson-4" })).response.status).toBe(200);
    expect((await create({ classId: null, lessonId: "lesson-3" })).response.status).toBe(400);
  });

  it("links discussion threads to the tenant", async () => {
    const { body } = await create({ workType: "discussion", instructions: "Debate the prompt." });
    const thread = selectOne(db, "SELECT id, prompt FROM discussion_threads WHERE work_item_id = ?", String(body.data?.id));
    expect(thread).toMatchObject({ prompt: "Debate the prompt." });
    expect(
      selectOne(db, "SELECT tenant_id FROM tenant_object_links WHERE object_table = 'discussion_threads' AND object_id = ?", String(thread?.id)),
    ).toMatchObject({ tenant_id: "tenant_edsync_default" });
    expect(
      selectOne(db, "SELECT tenant_id FROM tenant_object_links WHERE object_table = 'learning_work_items' AND object_id = ?", String(body.data?.id)),
    ).toMatchObject({ tenant_id: "tenant_edsync_default" });
  });

  it("returns 400/401/403 for bad requests", async () => {
    expect((await POST(jsonRequest("/api/work", "POST", "{"))).status).toBe(400);
    expect((await create({ title: "  " })).response.status).toBe(400);
    expect((await create({ dueAt: "someday" })).response.status).toBe(400);
    expect((await create({ classId: "class-2" })).response.status).toBe(400);
    state.user = STUDENT;
    expect((await create({})).response.status).toBe(403);
    state.user = null;
    expect((await create({})).response.status).toBe(401);
  });
});

describe("PATCH /api/work", () => {
  async function seedWork() {
    const { body } = await create({
      description: "Write up the titration lab.",
      instructions: "Use the template.",
      rubric: [{ criterion: "Accuracy", points: 20 }],
      pointsPossible: 40,
      lessonId: "lesson-1",
      categoryId: "cat-tests",
      allowLate: false,
      gradingMode: "weighted",
      gradeWeightPercent: 10,
      allowResubmission: true,
      maxAttempts: 3,
      status: "published",
    });
    return String(body.data?.id);
  }

  it("merges only the provided fields", async () => {
    const id = await seedWork();
    const before = workRow(id);

    const response = await patch({ id, title: "Lab report v2" });
    expect(response.status).toBe(200);
    expect(workRow(id)).toEqual({ ...before, title: "Lab report v2", updated_at: expect.any(String) });
  });

  it("keeps description, rubric and grading settings when the teacher page omits them", async () => {
    const id = await seedWork();
    // Shape of the current teacher work page save payload.
    const response = await patch({
      id,
      title: "Lab report",
      workType: "task",
      classId: "class-1",
      instructions: "Use the new template.",
      pointsPossible: 50,
      dueAt: "2999-01-02T09:00",
      status: "published",
    });
    expect(response.status).toBe(200);
    expect(workRow(id)).toMatchObject({
      description: "Write up the titration lab.",
      rubric: [{ criterion: "Accuracy", points: 20 }],
      instructions: "Use the new template.",
      points_possible: 50,
      due_at: "2999-01-02T09:00",
      allow_late: 0,
      lesson_id: "lesson-1",
      category_id: "cat-tests",
      settings: expect.objectContaining({ mode: "weighted", gradeWeightPercent: 10, allowResubmission: true, maxAttempts: 3 }),
    });
    const deadline = selectOne(db, "SELECT due_at, title FROM schedule_events WHERE json_extract(metadata, '$.workItemId') = ?", id);
    expect(deadline).toMatchObject({ due_at: "2999-01-02T09:00", title: "Lab report" });

    await patch({ id, dueAt: null });
    expect(selectAll(db, "SELECT id FROM schedule_events WHERE json_extract(metadata, '$.workItemId') = ?", id)).toEqual([]);
  });

  it("verifies lesson and category changes against the work item's class", async () => {
    const id = await seedWork();
    seedTeachersOtherClass();
    expect((await patch({ id, categoryId: "cat-labs" })).status).toBe(400);
    expect((await patch({ id, lessonId: "lesson-3" })).status).toBe(400);
    expect((await patch({ id, lessonId: "lesson-4" })).status).toBe(400);
    expect((await patch({ id, categoryId: "cat-homework" })).status).toBe(200);
    expect(workRow(id)).toMatchObject({ category_id: "cat-homework", lesson_id: "lesson-1" });
    expect((await patch({ id, categoryId: null })).status).toBe(200);
    expect(workRow(id)?.category_id).toBeNull();
  });

  it("does not put an archived item's deadline back when it is edited", async () => {
    const id = await seedWork();
    expect((await patch({ id, dueAt: "2999-01-02T09:00" })).status).toBe(200);
    expect(deadlineCount(id)).toBe(1);

    const archived = await DELETE(new Request(`http://localhost/api/work?id=${id}`, { method: "DELETE" }));
    expect(archived.status).toBe(200);
    expect(deadlineCount(id)).toBe(0);

    // The teacher page sends the stored status back when an archived item is edited.
    expect((await patch({ id, title: "Lab report (old)", status: "archived", dueAt: "2999-01-03T09:00" })).status).toBe(200);
    expect(workRow(id)).toMatchObject({ status: "archived", title: "Lab report (old)" });
    expect(deadlineCount(id)).toBe(0);

    expect((await patch({ id, status: "published" })).status).toBe(200);
    expect(deadlineCount(id)).toBe(1);
  });

  it("does not change the work type after students submit", async () => {
    const id = await seedWork();
    insertRows(db, "learning_submissions", [{ id: "sub-1", work_item_id: id, student_id: STUDENT.id, class_id: "class-1" }]);
    const response = await patch({ id, workType: "quiz" });
    expect(response.status).toBe(409);
    expect(workRow(id)?.work_type).toBe("task");
    expect((await patch({ id, workType: "task", title: "Same type" })).status).toBe(200);
  });

  it("links a discussion thread created by switching the work type", async () => {
    const id = await seedWork();
    expect((await patch({ id, workType: "discussion" })).status).toBe(200);
    const thread = selectOne(db, "SELECT id FROM discussion_threads WHERE work_item_id = ?", id);
    expect(
      selectOne(db, "SELECT COUNT(*) AS n FROM tenant_object_links WHERE object_table = 'discussion_threads' AND object_id = ?", String(thread?.id))?.n,
    ).toBe(1);
  });

  it("returns 400/403/404 for bad requests", async () => {
    const id = await seedWork();
    expect((await patch({ title: "No id" })).status).toBe(400);
    expect((await patch({ id, title: "" })).status).toBe(400);
    expect((await patch({ id, rubric: "none" })).status).toBe(400);
    expect((await patch({ id: "missing" })).status).toBe(404);
    state.user = OTHER_TEACHER;
    expect((await patch({ id, title: "Hijack" })).status).toBe(404);
    state.user = STUDENT;
    expect((await patch({ id, title: "Hijack" })).status).toBe(403);
    expect(workRow(id)?.title).toBe("Lab report");
  });
});
