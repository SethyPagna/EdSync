// @vitest-environment node
import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/auth/session";
import type { D1QueryAdapter } from "@/lib/db/d1-adapter";
import { parseQuizAnswers, quizAnswersFingerprint } from "@/lib/grades/quiz-grading";
import {
  OTHER_STUDENT,
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
import { GET as getGrades, POST as postManualGrade } from "../route";
import { POST } from "./route";

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
  state.user = STUDENT;
});

function submit(body: unknown) {
  return POST(jsonRequest("/api/grades/lesson-quiz", "POST", body));
}

function scoreRow(lessonId = "lesson-1", studentId = STUDENT.id) {
  const row = selectOne(
    db,
    "SELECT * FROM gradebook_scores WHERE student_id = ? AND source_type = 'lesson_quiz' AND source_id = ?",
    studentId,
    lessonId,
  );
  return row ? { ...row, metadata: JSON.parse(String(row.metadata)) as Record<string, unknown> } : undefined;
}

function countRows(sql: string, ...params: string[]) {
  return Number(selectOne(db, sql, ...params)?.n);
}

/** A class-less lesson assigned to class-1, a draft lesson in class-1, and a lesson with no final quiz. */
function seedSharedLessons() {
  insertRows(db, "lessons", [
    { id: "lesson-shared", teacher_id: TEACHER.id, class_id: null, title: "Shared", status: "published" },
    { id: "lesson-draft", teacher_id: TEACHER.id, class_id: "class-1", title: "Draft", status: "draft" },
    { id: "lesson-reading", teacher_id: TEACHER.id, class_id: "class-1", title: "Reading", status: "published" },
  ]);
  insertRows(db, "lesson_assignments", [
    { id: "assign-shared", lesson_id: "lesson-shared", class_id: "class-1", assigned_by: TEACHER.id, is_active: 1 },
  ]);
  const question = (id: string, lessonId: string) => ({
    id,
    lesson_id: lessonId,
    question_text: "Pick one",
    question_type: "multiple_choice",
    options: JSON.stringify([
      { id: "a", text: "A", is_correct: true },
      { id: "b", text: "B", is_correct: false },
    ]),
    correct_answer: "a",
    points: 1,
    is_final_quiz: 1,
    order_index: 0,
  });
  insertRows(db, "quiz_questions", [question("q-shared", "lesson-shared"), question("q-draft", "lesson-draft")]);
}

const ALL_CORRECT = { "q-mcq": "a", "q-tf": true, "q-short": " photosynthesis " };

describe("POST /api/grades/lesson-quiz", () => {
  it("grades the final quiz on the server", async () => {
    db.prepare("UPDATE quiz_questions SET explanation = ? WHERE id = 'q-mcq'").run("The organelle releases energy.");
    const response = await submit({ lessonId: "lesson-1", answers: ALL_CORRECT });
    expect(response.status).toBe(200);
    const { data } = await readJson(response);
    expect(data).toMatchObject({ score: 4, maxScore: 4, percent: 100, status: "graded", attemptNumber: 1, recorded: true });
    expect(data?.results).toEqual([
      { questionId: "q-mcq", correct: true, pointsEarned: 2, pointsPossible: 2, correctOptionIds: ["a"], explanation: "The organelle releases energy." },
      { questionId: "q-tf", correct: true, pointsEarned: 1, pointsPossible: 1, correctOptionIds: ["true"] },
      { questionId: "q-short", correct: true, pointsEarned: 1, pointsPossible: 1, correctOptionIds: [] },
    ]);

    expect(scoreRow()).toMatchObject({
      status: "graded",
      percent: 100,
      points_earned: 4,
      points_possible: 4,
      class_id: "class-1",
      teacher_id: TEACHER.id,
      metadata: expect.objectContaining({ gradedByRole: "system", attemptNumber: 1 }),
    });
    const attempts = selectAll(db, "SELECT question_id, is_correct, attempt_number FROM quiz_attempts ORDER BY question_id");
    expect(attempts).toEqual([
      { question_id: "q-mcq", is_correct: 1, attempt_number: 1 },
      { question_id: "q-short", is_correct: 1, attempt_number: 1 },
      { question_id: "q-tf", is_correct: 1, attempt_number: 1 },
    ]);
  });

  it("scores incorrect and partially correct attempts", async () => {
    const wrong = await readJson(await submit({ lessonId: "lesson-1", answers: { "q-mcq": "b", "q-tf": "false", "q-short": "" } }));
    expect(wrong.data).toMatchObject({ score: 0, maxScore: 4, percent: 0, status: "graded", attemptNumber: 1 });

    const partial = await readJson(await submit({ lessonId: "lesson-1", answers: { "q-mcq": "a", "q-tf": false } }));
    expect(partial.data).toMatchObject({ score: 2, maxScore: 4, percent: 50, attemptNumber: 2 });
    expect((partial.data?.results as Array<{ correct: boolean }>).map((result) => result.correct)).toEqual([true, false, false]);
    expect(scoreRow()).toMatchObject({ status: "graded", percent: 50 });
  });

  it("sends a short answer that differs from the key to teacher review", async () => {
    const { data } = await readJson(
      await submit({ lessonId: "lesson-1", answers: { "q-mcq": "a", "q-tf": true, "q-short": "Plants make sugar from light" } }),
    );
    expect(data).toMatchObject({ score: 3, maxScore: 4, status: "submitted", recorded: true });
    expect((data?.results as Array<{ correct: boolean | null }>).map((result) => result.correct)).toEqual([true, true, null]);
    expect(scoreRow()).toMatchObject({
      status: "submitted",
      percent: null,
      metadata: expect.objectContaining({ gradedByRole: "system", pendingReview: 1 }),
    });
    expect(selectOne(db, "SELECT is_correct FROM quiz_attempts WHERE question_id = 'q-short'")).toEqual({ is_correct: null });
  });

  it("replays an identical submission without recording a new attempt", async () => {
    await submit({ lessonId: "lesson-1", answers: ALL_CORRECT });
    const again = await readJson(await submit({ lessonId: "lesson-1", answers: { "q-short": "photosynthesis", "q-tf": true, "q-mcq": "a" } }));
    expect(again.data).toMatchObject({ replayed: true, recorded: true, attemptNumber: 1, percent: 100 });
    expect(selectOne(db, "SELECT COUNT(*) AS n FROM quiz_attempts")?.n).toBe(3);
    expect(selectOne(db, "SELECT COUNT(*) AS n FROM learning_events WHERE event_type = 'grade.lesson_quiz.recorded'")?.n).toBe(1);
  });

  it("ignores client-written events when replaying and numbering attempts", async () => {
    await submit({ lessonId: "lesson-1", answers: ALL_CORRECT });
    const bad = { "q-mcq": "b", "q-tf": false, "q-short": "" };
    const questions = [{ id: "q-mcq" }, { id: "q-tf" }, { id: "q-short" }];
    // What a student can append through POST /api/events.
    insertRows(db, "learning_events", [
      {
        id: "forged-event",
        tenant_id: "tenant_edsync_default",
        actor_id: STUDENT.id,
        student_id: STUDENT.id,
        source_type: "lesson_quiz",
        source_id: "lesson-1",
        event_type: "grade.lesson_quiz.recorded",
        payload: JSON.stringify({
          attemptNumber: 5000,
          fingerprint: await quizAnswersFingerprint(questions, parseQuizAnswers(bad)),
          score: 0,
          maxScore: 4,
          pendingReview: 0,
        }),
        created_at: "2999-01-01 00:00:00",
      },
    ]);

    const response = await readJson(await submit({ lessonId: "lesson-1", answers: bad }));
    expect(response.data).toMatchObject({ recorded: true, attemptNumber: 2, percent: 0 });
    expect(response.data?.replayed).toBeUndefined();
    expect(scoreRow()).toMatchObject({ status: "graded", percent: 0, metadata: expect.objectContaining({ attemptNumber: 2 }) });
    expect(countRows("SELECT COUNT(*) AS n FROM quiz_attempts WHERE attempt_number = 2")).toBe(3);
  });

  it("records a client-reported score as submitted, never graded", async () => {
    const response = await submit({ lessonId: "lesson-1", score: 100 });
    expect(response.status).toBe(200);
    const claim = (await readJson(response)).data;
    expect(claim).toMatchObject({ status: "submitted", recorded: true });
    expect(claim?.results).toBeUndefined();
    expect(scoreRow()).toMatchObject({
      status: "submitted",
      percent: null,
      graded_at: null,
      metadata: expect.objectContaining({ gradedByRole: "student", claimedScore: 100 }),
    });
    const again = await readJson(await submit({ lessonId: "lesson-1", score: 100 }));
    expect(again.data).toMatchObject({ status: "submitted", recorded: true, replayed: true });
  });

  it("does not let a client-reported score replace a server grade", async () => {
    await submit({ lessonId: "lesson-1", answers: { "q-mcq": "a" } });
    const legacy = await readJson(await submit({ lessonId: "lesson-1", score: 100 }));
    expect(legacy.data).toMatchObject({ status: "submitted", recorded: false });
    expect(scoreRow()).toMatchObject({ status: "graded", percent: 50 });
  });

  it("does not let a client-reported score replace a server grade waiting for review", async () => {
    const answers = { "q-mcq": "a", "q-tf": true, "q-short": "Plants make sugar from light" };
    await submit({ lessonId: "lesson-1", answers });
    const before = scoreRow();
    expect(before).toMatchObject({ status: "submitted", points_earned: 3, points_possible: 4 });

    const legacy = await readJson(await submit({ lessonId: "lesson-1", score: 100 }));
    expect(legacy.data).toMatchObject({ status: "submitted", recorded: false });
    expect(scoreRow()).toEqual(before);

    const again = await readJson(await submit({ lessonId: "lesson-1", answers }));
    expect(again.data).toMatchObject({ replayed: true, recorded: true, attemptNumber: 1 });
    expect(scoreRow()).toEqual(before);
  });

  it("records nothing for a client-reported score on a lesson without a final quiz", async () => {
    seedSharedLessons();
    const response = await submit({ lessonId: "lesson-reading", score: 100 });
    expect(response.status).toBe(200);
    expect((await readJson(response)).data).toEqual({ status: "ungraded", recorded: false });
    expect(scoreRow("lesson-reading")).toBeUndefined();
    expect(countRows("SELECT COUNT(*) AS n FROM learning_events WHERE source_id = 'lesson-reading'")).toBe(0);
  });

  it("never overwrites a score last written by a teacher", async () => {
    state.user = TEACHER;
    const manual = await postManualGrade(
      jsonRequest("/api/grades", "POST", {
        studentId: STUDENT.id,
        classId: "class-1",
        sourceType: "lesson_quiz",
        sourceId: "lesson-1",
        title: "Cells final quiz",
        pointsEarned: 3,
        pointsPossible: 4,
      }),
    );
    expect(manual.status).toBe(200);

    state.user = STUDENT;
    const graded = await readJson(await submit({ lessonId: "lesson-1", answers: ALL_CORRECT }));
    expect(graded.data).toMatchObject({ percent: 100, recorded: false, locked: true });
    const legacy = await readJson(await submit({ lessonId: "lesson-1", score: 100 }));
    expect(legacy.data).toMatchObject({ recorded: false });
    expect(scoreRow()).toMatchObject({
      status: "graded",
      percent: 75,
      metadata: expect.objectContaining({ gradedByRole: "teacher", gradedBy: TEACHER.id }),
    });
  });

  it("leaves open-ended questions for teacher review", async () => {
    const { data } = await readJson(await submit({ lessonId: "lesson-2", answers: { "q-essay": "Water moves..." } }));
    expect(data).toMatchObject({ status: "submitted", score: 0, maxScore: 4 });
    expect(scoreRow("lesson-2")).toMatchObject({ status: "submitted", percent: null });
  });

  it("returns 404 for lessons the student cannot take, and writes nothing", async () => {
    seedSharedLessons();
    state.user = OTHER_STUDENT;
    expect((await submit({ lessonId: "lesson-shared", answers: { "q-shared": "b" } })).status).toBe(404);
    expect((await submit({ lessonId: "lesson-shared", score: 100 })).status).toBe(404);
    expect(scoreRow("lesson-shared", OTHER_STUDENT.id)).toBeUndefined();

    state.user = STUDENT;
    expect((await submit({ lessonId: "lesson-draft", answers: { "q-draft": "b" } })).status).toBe(404);
    expect((await submit({ lessonId: "lesson-draft", score: 100 })).status).toBe(404);
    expect((await submit({ lessonId: "missing-lesson", answers: {} })).status).toBe(404);

    db.prepare("UPDATE lesson_assignments SET is_active = 0").run();
    expect((await submit({ lessonId: "lesson-shared", answers: { "q-shared": "a" } })).status).toBe(404);
    expect(countRows("SELECT COUNT(*) AS n FROM gradebook_scores")).toBe(0);
    expect(countRows("SELECT COUNT(*) AS n FROM quiz_attempts")).toBe(0);
    expect(countRows("SELECT COUNT(*) AS n FROM learning_events")).toBe(0);
  });

  it("files an assigned lesson's grade under the assigned class so the teacher sees it", async () => {
    seedSharedLessons();
    const response = await submit({ lessonId: "lesson-shared", answers: { "q-shared": "b" } });
    expect(response.status).toBe(200);
    expect(scoreRow("lesson-shared")).toMatchObject({ class_id: "class-1", teacher_id: TEACHER.id, percent: 0 });

    state.user = TEACHER;
    const finalized = await postManualGrade(
      jsonRequest("/api/grades", "POST", {
        studentId: STUDENT.id,
        classId: "class-1",
        sourceType: "lesson_quiz",
        sourceId: "lesson-shared",
        title: "Shared final quiz",
        pointsEarned: 1,
        pointsPossible: 1,
      }),
    );
    expect(finalized.status).toBe(200);
    const classView = await readJson(await getGrades(new Request("http://localhost/api/grades?classId=class-1")));
    expect(classView.data?.scores).toEqual([
      expect.objectContaining({ source_id: "lesson-shared", class_id: "class-1", percent: 100, status: "graded" }),
    ]);

    state.user = STUDENT;
    const studentView = await readJson(await getGrades(new Request("http://localhost/api/grades")));
    expect(studentView.data?.overallByClass).toEqual({ "class-1": 100 });
  });

  it("accepts lessons assigned to the student directly or covered by an entitlement", async () => {
    seedSharedLessons();
    state.user = OTHER_STUDENT;
    insertRows(db, "lesson_assignments", [
      { id: "assign-direct", lesson_id: "lesson-shared", student_id: OTHER_STUDENT.id, assigned_by: TEACHER.id, is_active: 1 },
    ]);
    const direct = await submit({ lessonId: "lesson-shared", answers: { "q-shared": "a" } });
    expect(direct.status).toBe(200);
    expect(scoreRow("lesson-shared", OTHER_STUDENT.id)).toMatchObject({ class_id: null, percent: 100 });

    db.prepare("DELETE FROM lesson_assignments WHERE id = 'assign-direct'").run();
    expect((await submit({ lessonId: "lesson-shared", score: 90 })).status).toBe(404);
    insertRows(db, "billing_products", [
      { id: "product-shared", tenant_id: "tenant_edsync_default", title: "Shared course", course_id: "lesson-shared", status: "active" },
    ]);
    insertRows(db, "entitlements", [
      { id: "entitlement-1", tenant_id: "tenant_edsync_default", user_id: OTHER_STUDENT.id, product_id: "product-shared", status: "active" },
    ]);
    expect((await submit({ lessonId: "lesson-shared", answers: { "q-shared": "b" } })).status).toBe(200);

    db.prepare("UPDATE entitlements SET status = 'revoked'").run();
    expect((await submit({ lessonId: "lesson-shared", answers: { "q-shared": "a" } })).status).toBe(404);
  });

  it("returns 400/401/403/404 for bad requests", async () => {
    expect((await POST(jsonRequest("/api/grades/lesson-quiz", "POST", "{"))).status).toBe(400);
    expect((await submit({ answers: {} })).status).toBe(400);
    expect((await submit({ lessonId: "lesson-1" })).status).toBe(400);
    expect((await submit({ lessonId: "lesson-1", answers: { "q-mcq": 5 } })).status).toBe(400);
    expect((await submit({ lessonId: "lesson-1", score: "lots" })).status).toBe(400);

    state.user = OTHER_STUDENT;
    expect((await submit({ lessonId: "lesson-1", answers: ALL_CORRECT })).status).toBe(404);
    state.user = TEACHER;
    expect((await submit({ lessonId: "lesson-1", answers: ALL_CORRECT })).status).toBe(403);
    state.user = null;
    expect((await submit({ lessonId: "lesson-1", answers: ALL_CORRECT })).status).toBe(401);
    expect(scoreRow()).toBeUndefined();
  });
});
