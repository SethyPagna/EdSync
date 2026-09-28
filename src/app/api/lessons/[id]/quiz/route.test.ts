// @vitest-environment node
import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/auth/session";
import type { D1QueryAdapter } from "@/lib/db/d1-adapter";
import {
  STUDENT,
  TEACHER,
  createGradingDatabase,
  insertRows,
  jsonRequest,
  selectOne,
  sqliteAdapter,
} from "@/lib/grades/test-support";
import { POST as check } from "../check/route";
import { POST as progress } from "../progress/route";
import { GET as quiz } from "./route";

const state = vi.hoisted(() => ({ adapter: null as unknown, user: null as SessionUser | null }));

vi.mock("@/lib/db/d1-adapter", () => ({ getD1QueryAdapter: () => state.adapter }));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: async () => state.user }));
vi.mock("@/lib/tenancy", () => ({
  DEFAULT_TENANT_ID: "tenant_edsync_default",
  resolveTenantContext: async () => ({
    tenant: { id: "tenant_edsync_default" },
    portal: null,
    membership: { id: "membership-1" },
  }),
}));

let db: DatabaseSync;

beforeEach(() => {
  db = createGradingDatabase();
  state.adapter = sqliteAdapter(db) satisfies D1QueryAdapter;
  state.user = STUDENT;
  insertRows(db, "lesson_sections", [
    { id: "section-a", lesson_id: "lesson-1", title: "Read", order_index: 0 },
    { id: "section-b", lesson_id: "lesson-1", title: "Try", order_index: 1 },
  ]);
  insertRows(db, "quiz_questions", [
    {
      id: "q-multi", lesson_id: "lesson-1", section_id: "section-a", question_text: "Choose both",
      question_type: "multiple_choice", options: JSON.stringify([
        { id: "a", text: "A", is_correct: true },
        { id: "b", text: "B", is_correct: true },
        { id: "c", text: "C", is_correct: false },
      ]), correct_answer: "a", explanation: "Two choices.", is_micro_check: 1, order_index: 4,
    },
    {
      id: "q-blank", lesson_id: "lesson-1", section_id: "section-a", question_text: "Fill the blank",
      question_type: "fill_blank", correct_answer: "hidden-key-73", explanation: "The exact term.", is_micro_check: 1, order_index: 5,
    },
    {
      id: "q-essay-check", lesson_id: "lesson-1", section_id: "section-b", question_text: "Explain",
      question_type: "long_answer", is_micro_check: 1, order_index: 6,
    },
    {
      id: "q-matching", lesson_id: "lesson-1", section_id: "section-b", question_text: "Match",
      question_type: "matching", is_micro_check: 1, order_index: 7,
    },
    {
      id: "q-choice-check", lesson_id: "lesson-1", section_id: "section-b", question_text: "Pick A",
      question_type: "multiple_choice", options: JSON.stringify([
        { id: "a", text: "A", is_correct: true }, { id: "b", text: "B", is_correct: false },
      ]), correct_answer: "a", is_micro_check: 1, order_index: 8,
    },
    {
      id: "q-true-check", lesson_id: "lesson-1", section_id: "section-b", question_text: "True?",
      question_type: "true_false", correct_answer: "true", is_micro_check: 1, order_index: 9,
    },
  ]);
});

function context(id = "lesson-1") {
  return { params: Promise.resolve({ id }) };
}

function postCheck(questionId: string, answer: unknown, id = "lesson-1") {
  return check(jsonRequest(`/api/lessons/${id}/check`, "POST", { questionId, answer }), context(id));
}

function postProgress(body: unknown, id = "lesson-1") {
  return progress(jsonRequest(`/api/lessons/${id}/progress`, "POST", body), context(id));
}

async function dataOf(response: Response) {
  return (await response.json()) as { data: Record<string, unknown> | null; error?: string };
}

describe("lesson-player API", () => {
  it("sends only player-safe questions to students", async () => {
    const response = await quiz(new Request("http://localhost/api/lessons/lesson-1/quiz"), context());
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toMatch(/correct_answer|is_correct|explanation|hidden-key-73/);
    const body = JSON.parse(text) as { data: { questions: Array<Record<string, unknown>> } };
    expect(body.data.questions.find((question) => question.id === "q-multi")).toMatchObject({
      type: "multi",
      sectionId: "section-a",
      isFinal: false,
      purpose: "check",
      options: [{ id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", text: "C" }],
    });
    expect(body.data.questions.find((question) => question.id === "q-mcq")).toMatchObject({ type: "mcq", isFinal: true });
  });

  it("allows a teacher to preview an owned lesson, and denies unauthenticated callers", async () => {
    state.user = TEACHER;
    expect((await quiz(new Request("http://localhost/api/lessons/lesson-1/quiz"), context())).status).toBe(200);
    state.user = null;
    expect((await quiz(new Request("http://localhost/api/lessons/lesson-1/quiz"), context())).status).toBe(401);
  });

  it("does not open an unrelated published lesson or an unpublished class lesson to a student", async () => {
    insertRows(db, "lessons", [
      { id: "lesson-private", teacher_id: TEACHER.id, title: "Private", status: "published" },
      { id: "lesson-draft", teacher_id: TEACHER.id, class_id: "class-1", title: "Draft", status: "draft" },
    ]);
    for (const id of ["lesson-private", "lesson-draft"]) {
      const response = await quiz(new Request(`http://localhost/api/lessons/${id}/quiz`), context(id));
      expect(response.status).toBe(404);
    }
  });

  it("does not inherit default-tenant access from a class when a lesson belongs to another tenant", async () => {
    insertRows(db, "tenants", [{ id: "tenant-foreign", slug: "foreign", name: "Foreign", status: "active" }]);
    insertRows(db, "tenant_object_links", [{
      id: "foreign-lesson-link", tenant_id: "tenant-foreign", object_table: "lessons", object_id: "lesson-1",
    }]);
    const response = await quiz(new Request("http://localhost/api/lessons/lesson-1/quiz"), context());
    expect(response.status).toBe(404);
  });

  it("checks non-final answers across choice, text, and manual-review types without grading", async () => {
    expect((await dataOf(await postCheck("q-multi", ["a", "b"]))).data).toMatchObject({
      correct: true, correctOptionIds: ["a", "b"], explanation: "Two choices.",
    });
    expect((await dataOf(await postCheck("q-multi", ["a"]))).data?.correct).toBe(false);
    expect((await dataOf(await postCheck("q-choice-check", "a"))).data).toMatchObject({ correct: true, correctOptionIds: ["a"] });
    expect((await dataOf(await postCheck("q-true-check", true))).data).toMatchObject({ correct: true, correctOptionIds: ["true"] });
    expect((await dataOf(await postCheck("q-true-check", false))).data?.correct).toBe(false);
    db.prepare("UPDATE quiz_questions SET correct_answer = 'yes' WHERE id = 'q-true-check'").run();
    expect((await dataOf(await postCheck("q-true-check", true))).data).toMatchObject({ correct: true, correctOptionIds: ["true"] });
    expect((await dataOf(await postCheck("q-check", "anything"))).data?.correct).toBe(true);
    expect((await dataOf(await postCheck("q-check", "different"))).data?.correct).toBeNull();
    expect((await dataOf(await postCheck("q-blank", "wrong"))).data).toMatchObject({
      correct: false, answerText: "hidden-key-73",
    });
    expect((await dataOf(await postCheck("q-essay-check", "A thoughtful response"))).data?.correct).toBeNull();
    expect((await dataOf(await postCheck("q-matching", ["a", "b"]))).data?.correct).toBeNull();
    expect(selectOne(db, "SELECT COUNT(*) AS n FROM gradebook_scores")?.n).toBe(0);
    expect(selectOne(db, "SELECT COUNT(*) AS n FROM quiz_attempts")?.n).toBe(0);
  });

  it("never reveals a final-question key through the check route", async () => {
    const response = await postCheck("q-mcq", "a");
    expect(response.status).toBe(403);
    expect(await response.text()).not.toMatch(/Mitochondria|correctOptionIds|correct_answer/);
  });

  it("creates missing progress, accumulates capped time, and advances the streak once per day", async () => {
    expect(selectOne(db, "SELECT id FROM student_progress WHERE student_id = ? AND lesson_id = ?", STUDENT.id, "lesson-1")).toBeUndefined();
    const first = await postProgress({ currentSectionId: "section-a", completedSectionIds: ["section-a"], timeSpentSeconds: 5000, score: 100, finalQuizScore: 100 });
    expect(first.status).toBe(200);
    expect((await dataOf(first)).data).toMatchObject({
      status: "in_progress", sectionsCompleted: ["section-a"], progress: 0.5, completed: false, streakDays: 1,
    });
    const second = await postProgress({ completedSectionIds: ["section-a"], timeSpentSeconds: 25 });
    expect((await dataOf(second)).data?.streakDays).toBe(1);
    expect(selectOne(db, "SELECT time_spent FROM student_progress WHERE student_id = ? AND lesson_id = ?", STUDENT.id, "lesson-1")?.time_spent).toBe(625);
    expect(selectOne(db, "SELECT score, final_quiz_score FROM student_progress WHERE student_id = ? AND lesson_id = ?", STUDENT.id, "lesson-1")).toMatchObject({ score: null, final_quiz_score: null });
  });

  it("guards completion until all sections or a final attempt are recorded", async () => {
    const early = await postProgress({ completed: true, completedSectionIds: ["section-a"] });
    expect(early.status).toBe(409);
    expect(selectOne(db, "SELECT id FROM student_progress WHERE student_id = ? AND lesson_id = ?", STUDENT.id, "lesson-1")).toBeUndefined();
    const invalid = await postProgress({ completedSectionIds: ["section-other"] });
    expect(invalid.status).toBe(400);
    const completed = await postProgress({ completed: true, completedSectionIds: ["section-a", "section-b"] });
    expect(completed.status).toBe(200);
    expect((await dataOf(completed)).data).toMatchObject({ status: "completed", progress: 1, completed: true });
    expect(selectOne(db, "SELECT completed_at FROM student_progress WHERE student_id = ? AND lesson_id = ?", STUDENT.id, "lesson-1")?.completed_at).toBeTruthy();
  });

  it("accepts a recorded final attempt as an alternate completion guard", async () => {
    insertRows(db, "quiz_attempts", [{
      id: "attempt-1", student_id: STUDENT.id, lesson_id: "lesson-1", question_id: "q-mcq", answer: "a", attempt_number: 1,
    }]);
    const response = await postProgress({ completed: true });
    expect(response.status).toBe(200);
    expect((await dataOf(response)).data).toMatchObject({ completed: true, progress: 1 });
  });

  it("uses the student's calendar day for consecutive activity and resets after a gap", async () => {
    db.prepare("UPDATE profiles SET preferences = ? WHERE id = ?")
      .run(JSON.stringify({ timezone: "Asia/Hong_Kong" }), STUDENT.id);
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-09-29T15:30:00Z"));
      expect((await dataOf(await postProgress({}))).data?.streakDays).toBe(1);
      vi.setSystemTime(new Date("2026-09-29T16:30:00Z"));
      expect((await dataOf(await postProgress({}))).data?.streakDays).toBe(2);
      expect((await dataOf(await postProgress({}))).data?.streakDays).toBe(2);
      vi.setSystemTime(new Date("2026-10-01T16:30:00Z"));
      expect((await dataOf(await postProgress({}))).data?.streakDays).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
