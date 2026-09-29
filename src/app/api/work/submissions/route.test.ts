// @vitest-environment node
import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/auth/session";
import type { D1QueryAdapter } from "@/lib/db/d1-adapter";
import {
  OTHER_STUDENT,
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
import { GET, PATCH, POST } from "./route";

const state = vi.hoisted(() => ({
  adapter: null as unknown,
  user: null as SessionUser | null,
  tenantId: "tenant_edsync_default" as string,
  membershipStatus: null as string | null,
}));

vi.mock("@/lib/db/d1-adapter", () => ({ getD1QueryAdapter: () => state.adapter }));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: async () => state.user }));
vi.mock("@/lib/tenancy", () => ({
  DEFAULT_TENANT_ID: "tenant_edsync_default",
  resolveTenantContext: async () => ({ tenant: { id: state.tenantId }, portal: null, membership: state.membershipStatus ? { status: state.membershipStatus } : null }),
  linkTenantObject: async (input: { tenantId: string; portalId?: string | null; table: string; objectId: string }) => {
    await (state.adapter as D1QueryAdapter).query(
      `INSERT OR IGNORE INTO tenant_object_links (id, tenant_id, portal_id, object_table, object_id, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [crypto.randomUUID(), input.tenantId, input.portalId ?? null, input.table, input.objectId],
    );
  },
}));

const PAST = "2020-01-01T09:00:00Z";
const FUTURE = "2999-01-01T09:00:00Z";

let db: DatabaseSync;

function workItem(id: string, fields: Record<string, string | number | null> = {}) {
  insertRows(db, "learning_work_items", [
    {
      id,
      teacher_id: TEACHER.id,
      class_id: "class-1",
      category_id: "cat-tests",
      title: `Work ${id}`,
      work_type: "task",
      points_possible: 10,
      status: "published",
      due_at: FUTURE,
      allow_late: 1,
      settings: "{}",
      ...fields,
    },
  ]);
}

beforeEach(() => {
  db = createGradingDatabase();
  state.adapter = sqliteAdapter(db);
  state.user = STUDENT;
  state.tenantId = "tenant_edsync_default";
  state.membershipStatus = null;
});

it("blocks outsiders from reading, submitting and grading organization work", async () => {
  state.tenantId = "tenant_school";
  expect((await GET(new Request("http://localhost/api/work/submissions"))).status).toBe(403);
  expect((await submit("any-work")).status).toBe(403);
  state.user = TEACHER;
  expect((await PATCH(jsonRequest("/api/work/submissions", "PATCH", { submissionId: "any-submission", pointsEarned: 1 }))).status).toBe(403);
});

it("blocks assignment submissions when the global work flag is disabled", async () => {
  workItem("flagged-work");
  insertRows(db, "feature_flags", [{ id: "flag-work", flag_key: "work_items", label: "Assignments", enabled: 0 }]);
  expect((await submit("flagged-work")).status).toBe(403);
  expect((await GET(new Request("http://localhost/api/work/submissions"))).status).toBe(403);
  expect(submissionRow("flagged-work")).toBeUndefined();
});

function submit(workItemId: string, text = "My answer") {
  return POST(jsonRequest("/api/work/submissions", "POST", { workItemId, response: { text } }));
}

async function gradeSubmission(workItemId: string, pointsEarned = 8) {
  const previous = state.user;
  state.user = TEACHER;
  const submission = selectOne(db, "SELECT id FROM learning_submissions WHERE work_item_id = ? AND student_id = ?", workItemId, STUDENT.id);
  const response = await PATCH(
    jsonRequest("/api/work/submissions", "PATCH", { submissionId: submission?.id, pointsEarned, pointsPossible: 10, feedback: "Nice" }),
  );
  state.user = previous;
  return response;
}

function submissionRow(workItemId: string) {
  return selectOne(db, "SELECT * FROM learning_submissions WHERE work_item_id = ? AND student_id = ?", workItemId, STUDENT.id);
}

function attempts(workItemId: string) {
  return selectAll(
    db,
    "SELECT attempt_number, is_late, response FROM learning_submission_attempts WHERE work_item_id = ? ORDER BY attempt_number",
    workItemId,
  ).map((row) => ({ ...row }));
}

describe("POST /api/work/submissions", () => {
  it("requires answers to the work item's own questions and saves a reviewable response", async () => {
    workItem("w-quiz", { work_type: "quiz" });
    insertRows(db, "learning_work_questions", [
      { id: "q-choice", work_item_id: "w-quiz", prompt: "Which gas?", question_type: "multiple_choice", options: '["Oxygen","Nitrogen"]', correct_answer: "Oxygen", points: 5, order_index: 0 },
      { id: "q-text", work_item_id: "w-quiz", prompt: "Explain it.", question_type: "short_answer", options: "[]", correct_answer: "Photosynthesis", points: 5, order_index: 1 },
    ]);
    const send = (answers: unknown) => POST(jsonRequest("/api/work/submissions", "POST", { workItemId: "w-quiz", response: { answers } }));
    expect((await submit("w-quiz")).status).toBe(400);
    expect((await send([{ questionId: "q-choice", answer: "Oxygen" }])).status).toBe(400);
    expect((await send([{ questionId: "q-choice", answer: "Helium" }, { questionId: "q-text", answer: "Plants use light." }])).status).toBe(400);
    expect((await send([{ questionId: "q-choice", answer: "Oxygen" }, { questionId: "outside", answer: "Plants use light." }])).status).toBe(400);
    expect(attempts("w-quiz")).toEqual([]);

    const response = await send([
      { questionId: "q-text", prompt: "Forged", answer: " Plants use light. " },
      { questionId: "q-choice", answer: "Oxygen" },
    ]);
    expect(response.status).toBe(200);
    expect(JSON.parse(String(submissionRow("w-quiz")?.response))).toEqual({ answers: [
      { questionId: "q-choice", prompt: "Which gas?", answer: "Oxygen" },
      { questionId: "q-text", prompt: "Explain it.", answer: "Plants use light." },
    ] });
    expect(submissionRow("w-quiz")?.status).toBe("submitted");
    expect(attempts("w-quiz")).toHaveLength(1);
  });

  it("records the first attempt", async () => {
    workItem("w1");
    const response = await submit("w1");
    expect(response.status).toBe(200);
    const { data } = await readJson(response);
    expect(data).toMatchObject({ id: submissionRow("w1")?.id, attemptNumber: 1, late: false });
    expect(attempts("w1")).toEqual([{ attempt_number: 1, is_late: 0, response: '{"text":"My answer"}' }]);
  });

  it("rejects late submissions when late work is not allowed", async () => {
    workItem("w-late", { due_at: PAST, allow_late: 0 });
    const response = await submit("w-late");
    expect(response.status).toBe(403);
    expect((await readJson(response)).error).toBe("The due date has passed.");
    expect(submissionRow("w-late")).toBeUndefined();
    expect(attempts("w-late")).toEqual([]);
  });

  it("accepts and flags late submissions when late work is allowed", async () => {
    workItem("w-late-ok", { due_at: PAST, allow_late: 1 });
    const { data } = await readJson(await submit("w-late-ok"));
    expect(data).toMatchObject({ late: true, attemptNumber: 1 });
    expect(attempts("w-late-ok")[0]).toMatchObject({ is_late: 1 });
  });

  it("numbers resubmissions before grading", async () => {
    workItem("w2");
    await submit("w2", "first");
    const { data } = await readJson(await submit("w2", "second"));
    expect(data).toMatchObject({ attemptNumber: 2 });
    expect(JSON.parse(String(submissionRow("w2")?.response))).toEqual({ text: "second" });
    expect(attempts("w2").map((row) => row.attempt_number)).toEqual([1, 2]);
  });

  it("locks graded work unless resubmission is allowed", async () => {
    workItem("w3");
    await submit("w3", "graded answer");
    expect((await gradeSubmission("w3")).status).toBe(200);

    const blocked = await submit("w3", "rewritten after feedback");
    expect(blocked.status).toBe(409);
    expect((await readJson(blocked)).error).toBe("This work is already graded.");
    expect(submissionRow("w3")).toMatchObject({ status: "graded", percent: 80 });
    expect(JSON.parse(String(submissionRow("w3")?.response))).toEqual({ text: "graded answer" });
    expect(attempts("w3")).toHaveLength(1);
  });

  it("allows resubmission after grading when the work allows it", async () => {
    workItem("w4", { settings: JSON.stringify({ allowResubmission: true }) });
    await submit("w4", "first");
    await gradeSubmission("w4");
    const { data } = await readJson(await submit("w4", "revised"));
    expect(data).toMatchObject({ attemptNumber: 2 });
    expect(submissionRow("w4")).toMatchObject({ status: "submitted" });
  });

  it("enforces the attempt limit", async () => {
    workItem("w5", { settings: JSON.stringify({ maxAttempts: 2 }) });
    await submit("w5");
    await submit("w5");
    const third = await submit("w5");
    expect(third.status).toBe(409);
    expect((await readJson(third)).error).toBe("No attempts left.");
    expect(attempts("w5")).toHaveLength(2);
  });

  it("returns 400/401/403/404 for bad requests", async () => {
    workItem("w6");
    workItem("w-draft", { status: "draft" });
    expect((await POST(jsonRequest("/api/work/submissions", "POST", "{"))).status).toBe(400);
    expect((await POST(jsonRequest("/api/work/submissions", "POST", { response: {} }))).status).toBe(400);
    expect((await POST(jsonRequest("/api/work/submissions", "POST", { workItemId: "w6", response: "text" }))).status).toBe(400);
    expect((await submit("w-draft")).status).toBe(404);
    expect((await submit("missing")).status).toBe(404);
    state.user = OTHER_STUDENT;
    expect((await submit("w6")).status).toBe(404);
    state.user = TEACHER;
    expect((await submit("w6")).status).toBe(403);
    state.user = null;
    expect((await submit("w6")).status).toBe(401);
  });
});

describe("PATCH /api/work/submissions (grading)", () => {
  it("writes a teacher-owned gradebook score in the work item's category", async () => {
    workItem("w7");
    await submit("w7");
    const response = await gradeSubmission("w7", 9);
    expect(response.status).toBe(200);
    const score = selectOne(db, "SELECT * FROM gradebook_scores WHERE source_type = 'task' AND source_id = 'w7'");
    expect(score).toMatchObject({ category_id: "cat-tests", percent: 90, status: "graded", teacher_id: TEACHER.id });
    expect(JSON.parse(String(score?.metadata))).toMatchObject({ gradedByRole: "teacher", gradedBy: TEACHER.id });
  });

  it("hides other teachers' submissions", async () => {
    workItem("w8");
    await submit("w8");
    state.user = OTHER_TEACHER;
    const submission = submissionRow("w8");
    const response = await PATCH(jsonRequest("/api/work/submissions", "PATCH", { submissionId: submission?.id, pointsEarned: 1 }));
    expect(response.status).toBe(404);
    state.user = STUDENT;
    expect((await PATCH(jsonRequest("/api/work/submissions", "PATCH", { submissionId: submission?.id }))).status).toBe(403);
  });

  it("lists attempt counts and lateness", async () => {
    workItem("w9", { due_at: PAST });
    await submit("w9");
    await submit("w9");
    const { data } = await readJson(await GET(new Request("http://localhost/api/work/submissions?workItemId=w9")));
    expect(data).toEqual([expect.objectContaining({ work_item_id: "w9", attempt_count: 2, is_late: 1 })]);
  });
});
