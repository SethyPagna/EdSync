// @vitest-environment node
import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/auth/session";
import type { D1Result } from "@/lib/db/d1";
import {
  ADMIN,
  BUYER,
  OTHER_STUDENT,
  STUDENT,
  TEACHER,
  createSeededDatabase,
  rowOf,
  sqliteAdapter,
} from "@/lib/db/test-database";
import { createClient } from "@/lib/edsync/client";
import { logSecurityEvent } from "@/lib/security/rate-limit";
import { POST } from "./route";

const state = vi.hoisted(() => ({
  adapter: null as unknown,
  user: null as SessionUser | null,
  rate: { allowed: true, retryAfter: 0 },
}));

vi.mock("@/lib/db/d1-adapter", () => ({ getD1QueryAdapter: () => state.adapter }));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: async () => state.user }));
vi.mock("@/lib/security/rate-limit", () => ({
  enforceRateLimit: vi.fn(async () => state.rate),
  logSecurityEvent: vi.fn(async () => undefined),
}));

let db: DatabaseSync;

beforeEach(() => {
  db = createSeededDatabase();
  state.adapter = sqliteAdapter(db);
  state.user = STUDENT;
  state.rate = { allowed: true, retryAfter: 0 };
  vi.mocked(logSecurityEvent).mockClear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) !== "/api/data") throw new TypeError("fetch failed");
      return POST(new Request("http://localhost/api/data", init));
    }),
  );
});

function post(body: string) {
  return POST(new Request("http://localhost/api/data", { method: "POST", body, headers: { "Content-Type": "application/json" } }));
}

describe("POST /api/data", () => {
  it("returns 401 with a string error when signed out", async () => {
    state.user = null;
    const response = await post(JSON.stringify({ table: "profiles", action: "select" }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ data: null, error: "Authentication required." });
  });

  it("returns 400 for malformed JSON and unknown tables", async () => {
    const malformed = await post("{");
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ data: null, error: "Request body must be valid JSON." });

    const unknown = await post(JSON.stringify({ table: "sqlite_master", action: "select" }));
    expect(unknown.status).toBe(400);
    expect(await unknown.json()).toEqual({ data: null, error: "Unknown table." });
  });

  it("returns 403 with a string error and logs the denial", async () => {
    const response = await post(
      JSON.stringify({ table: "profiles", action: "update", values: { role: "teacher" }, filters: [{ op: "eq", column: "id", value: STUDENT.id }] }),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ data: null, error: "role cannot be changed." });
    expect(logSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "data_access_denied", userId: STUDENT.id }));
    expect(rowOf(db, "profiles", STUDENT.id)?.role).toBe("student");
  });

  it("returns 429 with Retry-After when rate limited", async () => {
    state.rate = { allowed: false, retryAfter: 42 };
    const response = await post(JSON.stringify({ table: "profiles", action: "select" }));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    expect(await response.json()).toEqual({ data: null, error: "Too many data requests. Try again shortly." });
  });
});

describe("client round trip", () => {
  const edsync = createClient();

  it("surfaces server errors as { message, status }", async () => {
    state.user = TEACHER;
    const { data, error } = await edsync.from("lessons").delete();
    expect(data).toBeNull();
    expect(error).toEqual({ message: "Refusing to delete rows without a filter.", status: 400 });

    state.user = BUYER;
    const upsert = await edsync
      .from("student_progress")
      .upsert({ id: "progress-2", lesson_id: "lesson-4", status: "completed", score: 100 });
    expect(upsert.error).toEqual({ message: "That record belongs to someone else.", status: 403 });
    expect(rowOf(db, "student_progress", "progress-2")?.student_id).toBe(OTHER_STUDENT.id);
  });

  it("joins a class through the looked-up join code", async () => {
    state.user = STUDENT;
    const { data: classItem } = await edsync.from("classes").select("id, name").eq("join_code", "JOIN2222").maybeSingle();
    expect(classItem).toEqual({ id: "class-2", name: "Art 7" });

    const joined = await edsync
      .from("class_enrollments")
      .upsert({ class_id: classItem.id, student_id: STUDENT.id, is_active: true }, { onConflict: "class_id,student_id" });
    expect(joined.error).toBeNull();

    const { data: classes } = await edsync.from("class_enrollments").select("class_id").eq("student_id", STUDENT.id).eq("is_active", true);
    expect((classes as { class_id: string }[]).map((row) => row.class_id).sort()).toEqual(["class-1", "class-2"]);
  });

  it("rejects a raw enrollment without a join-code lookup", async () => {
    state.user = OTHER_STUDENT;
    const raw = await edsync
      .from("class_enrollments")
      .upsert({ class_id: "class-1", student_id: OTHER_STUDENT.id, is_active: true }, { onConflict: "class_id,student_id" });
    expect(raw.error).toEqual({ message: "Join a class with its join code.", status: 403 });
  });
});

describe("admin learner workspace", () => {
  const enroll = (values: Record<string, unknown>) =>
    post(JSON.stringify({ table: "class_enrollments", action: "upsert", onConflict: "class_id,student_id", values }));

  it("lets an admin join a class through the looked-up join code and then record progress", async () => {
    state.user = ADMIN;
    const edsync = createClient();
    const { data: classItem } = await edsync.from("classes").select("id, name").eq("join_code", "JOIN1111").maybeSingle();
    expect(classItem).toEqual({ id: "class-1", name: "Math 7" });

    const joined = await edsync
      .from("class_enrollments")
      .upsert({ class_id: classItem.id, student_id: ADMIN.id, is_active: true }, { onConflict: "class_id,student_id" });
    expect(joined.error).toBeNull();
    expect(db.prepare("SELECT student_id, is_active FROM class_enrollments WHERE class_id = 'class-1' AND student_id = ?").all(ADMIN.id)).toEqual([
      { student_id: ADMIN.id, is_active: 1 },
    ]);

    const progress = await edsync
      .from("student_progress")
      .insert({ student_id: ADMIN.id, lesson_id: "lesson-1", status: "in_progress", sections_completed: [], started_at: new Date().toISOString() })
      .select()
      .single();
    expect(progress.error).toBeNull();
    expect(progress.data).toMatchObject({ student_id: ADMIN.id, lesson_id: "lesson-1" });
  });

  it("still requires a matching join code for admins", async () => {
    state.user = ADMIN;
    const missing = await enroll({ class_id: "class-1", student_id: ADMIN.id, is_active: true });
    expect(missing.status).toBe(403);
    expect(await missing.json()).toEqual({ data: null, error: "Join a class with its join code." });

    const mismatched = await enroll({ class_id: "class-2", student_id: ADMIN.id, is_active: true, join_code: "JOIN1111" });
    expect(mismatched.status).toBe(403);
    expect(await mismatched.json()).toEqual({ data: null, error: "That join code does not match an active class." });

    const someoneElse = await enroll({ class_id: "class-1", student_id: OTHER_STUDENT.id, join_code: "JOIN1111" });
    expect(someoneElse.status).toBe(403);
    expect(db.prepare("SELECT id FROM class_enrollments WHERE student_id = ?").all(ADMIN.id)).toEqual([]);
  });

  it("keeps teachers out of class enrollment writes", async () => {
    state.user = TEACHER;
    const response = await enroll({ class_id: "class-2", student_id: TEACHER.id, is_active: true, join_code: "JOIN2222" });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ data: null, error: "You cannot upsert class_enrollments." });
    expect(db.prepare("SELECT id FROM class_enrollments WHERE student_id = ?").all(TEACHER.id)).toEqual([]);
  });
});

type Client = ReturnType<typeof createClient>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Flow = [name: string, user: SessionUser, run: (edsync: Client) => PromiseLike<D1Result<any>>, check?: (result: D1Result<any>) => void];

const rows = (count: number) => (result: D1Result<unknown>) => expect(result.data).toHaveLength(count);
const one = (fields: Record<string, unknown>) => (result: D1Result<unknown>) => expect(result.data).toMatchObject(fields);
const now = () => new Date().toISOString();

/** Every client `.from()` call shape the pages use, run as the role that uses it. */
const CENSUS: Flow[] = [
  ["profiles: read own row", STUDENT, (e) => e.from("profiles").select("*").eq("id", STUDENT.id).single(), one({ id: STUDENT.id })],
  ["profiles: read streak", STUDENT, (e) => e.from("profiles").select("streak_days").eq("id", STUDENT.id).single(), one({ streak_days: 0 })],
  ["profiles: student reads class teachers", STUDENT, (e) => e.from("profiles").select("id, full_name, email").in("id", [TEACHER.id]), rows(1)],
  ["profiles: teacher reads roster", TEACHER, (e) => e.from("profiles").select("*").in("id", [STUDENT.id]), rows(1)],
  [
    "profiles: teacher reads a 150-student roster",
    TEACHER,
    (e) => e.from("profiles").select("id").in("id", [...Array.from({ length: 149 }, (_, i) => `student-x${i}`), STUDENT.id]),
    (result) => expect(result.data).toEqual([{ id: STUDENT.id }]),
  ],
  ["profiles: save theme", TEACHER, (e) => e.from("profiles").update({ preferences: { theme: "dark" } }).eq("id", TEACHER.id), rows(1)],
  [
    "profiles: student profile form",
    STUDENT,
    (e) =>
      e
        .from("profiles")
        .update({ full_name: "Sam S", grade_level: "7", interests: ["art"], preferences: { theme: "light" } })
        .eq("id", STUDENT.id),
    rows(1),
  ],
  ["profiles: avatar", STUDENT, (e) => e.from("profiles").update({ avatar_url: "https://cdn.example.com/a.png" }).eq("id", STUDENT.id), rows(1)],
  [
    "profiles: teacher profile form",
    TEACHER,
    (e) =>
      e
        .from("profiles")
        .update({ full_name: "Tara T", school: "North", grade_level: "7", subjects: ["Math"], preferences: { theme: "light" } })
        .eq("id", TEACHER.id),
    rows(1),
  ],
  ["profiles: streak", STUDENT, (e) => e.from("profiles").update({ streak_days: 3, last_active_at: now() }).eq("id", STUDENT.id), rows(1)],
  [
    "profiles: signup upsert",
    STUDENT,
    (e) =>
      e.from("profiles").upsert(
        { id: STUDENT.id, email: STUDENT.email, full_name: "Sam Student", role: "student", preferences: { theme: "light" }, subjects: [], interests: [] },
        { onConflict: "id" },
      ),
    rows(1),
  ],
  ["classes: teacher list", TEACHER, (e) => e.from("classes").select("*").eq("teacher_id", TEACHER.id).eq("is_active", true), rows(1)],
  [
    "classes: student list",
    STUDENT,
    (e) => e.from("classes").select("*").in("id", ["class-1"]).eq("is_active", true).order("updated_at", { ascending: false }),
    rows(1),
  ],
  [
    "classes: create",
    TEACHER,
    (e) => e.from("classes").insert({ teacher_id: TEACHER.id, name: "Period 2", subject: "Math", is_active: true }).select().single(),
    one({ teacher_id: TEACHER.id, name: "Period 2", is_active: true }),
  ],
  ["classes: archive", TEACHER, (e) => e.from("classes").update({ is_active: false }).eq("id", "class-1"), rows(1)],
  ["enrollments: student classes", STUDENT, (e) => e.from("class_enrollments").select("class_id").eq("student_id", STUDENT.id).eq("is_active", true), rows(1)],
  [
    "enrollments: teacher count",
    TEACHER,
    (e) => e.from("class_enrollments").select("student_id", { count: "exact" }).in("class_id", ["class-1"]).eq("is_active", true),
    (result) => expect(result.count).toBe(1),
  ],
  ["enrollments: roster", TEACHER, (e) => e.from("class_enrollments").select("student_id, class_id").in("class_id", ["class-1"]), rows(1)],
  ["enrollments: class roster", TEACHER, (e) => e.from("class_enrollments").select("student_id").eq("class_id", "class-1"), rows(1)],
  ["lessons: teacher list", TEACHER, (e) => e.from("lessons").select("*").eq("teacher_id", TEACHER.id), rows(2)],
  ["lessons: teacher summary", TEACHER, (e) => e.from("lessons").select("id, title, status").eq("teacher_id", TEACHER.id), rows(2)],
  ["lessons: player", STUDENT, (e) => e.from("lessons").select("*").eq("id", "lesson-1").single(), one({ id: "lesson-1" })],
  ["lessons: student assigned", STUDENT, (e) => e.from("lessons").select("*").in("id", ["lesson-1", "lesson-2"]).eq("status", "published"), rows(1)],
  [
    "lessons: overview",
    TEACHER,
    (e) =>
      e
        .from("lessons")
        .update({
          title: "Fractions 2",
          description: "d",
          subject: "Math",
          estimated_duration: 30,
          difficulty: "beginner",
          objectives: ["add"],
          complexity_slider: 40,
          pacing_slider: 40,
          scaffolding_slider: 40,
        })
        .eq("id", "lesson-1"),
    rows(1),
  ],
  ["lessons: publish", TEACHER, (e) => e.from("lessons").update({ status: "published" }).eq("id", "lesson-2"), rows(1)],
  ["lessons: delete", TEACHER, (e) => e.from("lessons").delete().eq("id", "lesson-2"), (result) => expect(result.error).toBeNull()],
  [
    "lessons: duplicate",
    TEACHER,
    async (e) => {
      const { data: lesson } = await e.from("lessons").select("*").eq("id", "lesson-1").single();
      return e
        .from("lessons")
        .insert({ ...lesson, id: undefined, title: `${lesson.title} (Copy)`, status: "draft", teacher_id: TEACHER.id, created_at: undefined, updated_at: undefined })
        .select()
        .single();
    },
    one({ title: "Fractions (Copy)", status: "draft", teacher_id: TEACHER.id }),
  ],
  ["sections: read", STUDENT, (e) => e.from("lesson_sections").select("*").eq("lesson_id", "lesson-1").order("order_index"), rows(1)],
  ["sections: lesson ids", TEACHER, (e) => e.from("lesson_sections").select("lesson_id").in("lesson_id", ["lesson-1", "lesson-2"]), rows(1)],
  [
    "sections: add",
    TEACHER,
    (e) =>
      e
        .from("lesson_sections")
        .insert({ lesson_id: "lesson-1", title: "New", content: "", content_type: "text", order_index: 1, duration_minutes: 5, metadata: {} })
        .select()
        .single(),
    one({ lesson_id: "lesson-1", title: "New" }),
  ],
  [
    "sections: save",
    TEACHER,
    (e) =>
      e
        .from("lesson_sections")
        .update({ title: "Warm", content: "x", content_type: "text", duration_minutes: 4, metadata: { a: 1 }, order_index: 0 })
        .eq("id", "section-1"),
    rows(1),
  ],
  ["sections: delete", TEACHER, (e) => e.from("lesson_sections").delete().eq("id", "section-1"), (result) => expect(result.error).toBeNull()],
  ["questions: read block", STUDENT, (e) => e.from("quiz_questions").select("*").eq("lesson_id", "lesson-1").eq("section_id", "section-1"), rows(1)],
  ["questions: clear block", TEACHER, (e) => e.from("quiz_questions").delete().eq("lesson_id", "lesson-1").eq("section_id", "section-1"), (r) => expect(r.error).toBeNull()],
  ["questions: clear lesson quiz", TEACHER, (e) => e.from("quiz_questions").delete().eq("lesson_id", "lesson-1").is("section_id", null), (r) => expect(r.error).toBeNull()],
  [
    "questions: save",
    TEACHER,
    (e) =>
      e.from("quiz_questions").insert([
        {
          lesson_id: "lesson-1",
          section_id: "section-1",
          question_text: "2+2?",
          question_type: "multiple_choice",
          options: ["3", "4"],
          correct_answer: "4",
          explanation: "",
          difficulty: "beginner",
          is_diagnostic: false,
          is_micro_check: true,
          is_final_quiz: false,
          order_index: 0,
        },
        { lesson_id: "lesson-1", section_id: null, question_text: "Final?", is_final_quiz: true, order_index: 1 },
      ]),
    rows(2),
  ],
  ["glossary: read", STUDENT, (e) => e.from("glossary_terms").select("*").eq("lesson_id", "lesson-1").order("term"), rows(1)],
  [
    "glossary: add",
    TEACHER,
    (e) => e.from("glossary_terms").insert({ lesson_id: "lesson-1", term: "Denominator", definition: "Bottom", example: "" }).select().single(),
    one({ term: "Denominator" }),
  ],
  ["glossary: save", TEACHER, (e) => e.from("glossary_terms").update({ term: "Top", definition: "Top number", example: "1" }).eq("id", "term-1"), rows(1)],
  ["glossary: delete", TEACHER, (e) => e.from("glossary_terms").delete().eq("id", "term-1"), (r) => expect(r.error).toBeNull()],
  ["assignments: student", STUDENT, (e) => e.from("lesson_assignments").select("lesson_id").in("class_id", ["class-1"]).eq("is_active", true), rows(2)],
  [
    "assignments: lesson classes",
    TEACHER,
    (e) => e.from("lesson_assignments").select("class_id, created_at, classes(name)").eq("lesson_id", "lesson-1"),
    (result) => expect(result.data).toEqual([expect.objectContaining({ class_id: "class-1", classes: { id: "class-1", name: "Math 7" } })]),
  ],
  [
    "assignments: class lessons",
    TEACHER,
    (e) => e.from("lesson_assignments").select("id, lesson_id, created_at, due_date, lessons(title)").eq("class_id", "class-1"),
    (result) =>
      expect((result.data as { lessons: { title: string } | null }[]).map((row) => row.lessons?.title).sort()).toEqual(["Draft decimals", "Fractions"]),
  ],
  [
    "assignments: share",
    TEACHER,
    (e) => e.from("lesson_assignments").insert({ lesson_id: "lesson-2", class_id: "class-1", assigned_by: TEACHER.id, due_date: null, is_active: true }),
    rows(1),
  ],
  ["assignments: unshare", TEACHER, (e) => e.from("lesson_assignments").update({ is_active: false }).eq("id", "assign-1"), rows(1)],
  [
    "assignments: unshare pair",
    TEACHER,
    (e) => e.from("lesson_assignments").update({ is_active: false }).eq("lesson_id", "lesson-2").eq("class_id", "class-1"),
    rows(1),
  ],
  ["progress: own list", STUDENT, (e) => e.from("student_progress").select("*").eq("student_id", STUDENT.id).in("lesson_id", ["lesson-1"]), rows(1)],
  [
    "progress: own lesson",
    STUDENT,
    (e) => e.from("student_progress").select("*").eq("student_id", STUDENT.id).eq("lesson_id", "lesson-1").maybeSingle(),
    one({ id: "progress-1" }),
  ],
  ["progress: teacher scores", TEACHER, (e) => e.from("student_progress").select("score").in("lesson_id", ["lesson-1"]).not("score", "is", null), rows(1)],
  ["progress: teacher report", TEACHER, (e) => e.from("student_progress").select("*").eq("lesson_id", "lesson-1"), rows(1)],
  [
    "progress: start",
    BUYER,
    (e) =>
      e
        .from("student_progress")
        .insert({ student_id: BUYER.id, lesson_id: "lesson-4", status: "in_progress", sections_completed: [], started_at: now() })
        .select()
        .single(),
    one({ student_id: BUYER.id, lesson_id: "lesson-4" }),
  ],
  ["progress: time", STUDENT, (e) => e.from("student_progress").update({ time_spent: 60, last_active: now() }).eq("id", "progress-1"), rows(1)],
  [
    "progress: diagnostic",
    STUDENT,
    (e) => e.from("student_progress").update({ diagnostic_completed: true, diagnostic_score: 50 }).eq("id", "progress-1"),
    rows(1),
  ],
  ["progress: sections", STUDENT, (e) => e.from("student_progress").update({ sections_completed: ["section-1"] }).eq("id", "progress-1"), rows(1)],
  [
    "progress: complete",
    STUDENT,
    (e) => e.from("student_progress").update({ status: "completed", final_quiz_score: 90, score: 90, completed_at: now() }).eq("id", "progress-1"),
    rows(1),
  ],
  ["progress: metadata", STUDENT, (e) => e.from("student_progress").update({ metadata: { mode: "focus" }, last_active: now() }).eq("id", "progress-1"), rows(1)],
  [
    "hints: own count",
    STUDENT,
    (e) => e.from("socratic_interactions").select("id", { count: "exact", head: true }).eq("student_id", STUDENT.id),
    (result) => expect(result.count).toBe(1),
  ],
  [
    "hints: teacher count",
    TEACHER,
    (e) => e.from("socratic_interactions").select("id", { count: "exact", head: true }).in("lesson_id", ["lesson-1"]),
    (result) => expect(result.count).toBe(1),
  ],
  [
    "hints: teacher feed",
    TEACHER,
    (e) =>
      e
        .from("socratic_interactions")
        .select("student_question, hint_response, created_at")
        .in("lesson_id", ["lesson-1"])
        .order("created_at", { ascending: false })
        .limit(30),
    rows(1),
  ],
  [
    "hints: ask",
    STUDENT,
    (e) =>
      e
        .from("socratic_interactions")
        .insert({ student_id: STUDENT.id, lesson_id: "lesson-1", student_question: "How?", hint_response: "Try.", conversation_history: [] }),
    rows(1),
  ],
  ["goals: list", STUDENT, (e) => e.from("learning_goals").select("*").eq("student_id", STUDENT.id), rows(1)],
  [
    "goals: add",
    STUDENT,
    (e) =>
      e
        .from("learning_goals")
        .insert({ student_id: STUDENT.id, title: "Two lessons", target_type: "lessons", target_value: 2, current_value: 0, due_date: null })
        .select()
        .single(),
    one({ student_id: STUDENT.id, title: "Two lessons" }),
  ],
  ["reflections: list", STUDENT, (e) => e.from("learning_reflections").select("*").eq("student_id", STUDENT.id), rows(1)],
  ["reflections: teacher low confidence", TEACHER, (e) => e.from("learning_reflections").select("confidence").in("lesson_id", ["lesson-1"]).lte("confidence", 2), rows(1)],
  [
    "reflections: add",
    STUDENT,
    (e) =>
      e.from("learning_reflections").insert({
        student_id: STUDENT.id,
        lesson_id: "lesson-1",
        confidence: 3,
        reflection: "Better",
        ai_feedback: "Nice",
        next_step: "Practice",
      }),
    rows(1),
  ],
  ["alerts: list", TEACHER, (e) => e.from("teacher_alerts").select("*").eq("teacher_id", TEACHER.id).eq("is_dismissed", false), rows(1)],
  ["alerts: dismiss", TEACHER, (e) => e.from("teacher_alerts").update({ is_dismissed: true }).eq("id", "alert-1"), rows(1)],
];

describe("usage census", () => {
  it.each(CENSUS)("%s", async (_name, user, run, check) => {
    state.user = user;
    const result = await run(createClient());
    expect(result.error).toBeNull();
    check?.(result);
  });

  it("does not let the census calls reach another teacher's data", async () => {
    state.user = TEACHER;
    const edsync = createClient();
    await edsync.from("lessons").update({ status: "archived" }).eq("id", "lesson-3");
    await edsync.from("teacher_alerts").update({ is_dismissed: true }).eq("id", "alert-2");
    await edsync.from("glossary_terms").delete().eq("lesson_id", "lesson-3");
    expect(rowOf(db, "lessons", "lesson-3")?.status).toBe("published");
    expect(rowOf(db, "teacher_alerts", "alert-2")?.is_dismissed).toBe(0);
    expect((await edsync.from("student_progress").select("*").eq("lesson_id", "lesson-3")).data).toEqual([]);
  });
});
