// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAccessibleLesson } from "@/lib/lessons/access";
import { resolveTenantContext } from "@/lib/tenancy";

const mocks = vi.hoisted(() => ({ query: vi.fn(), batch: vi.fn(), user: { id: "student-1", email: "student@example.com", user_metadata: { role: "student" } } }));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: vi.fn(async () => mocks.user),
}));
vi.mock("@/lib/db/d1", () => ({ d1Query: mocks.query, d1Batch: mocks.batch }));
vi.mock("@/lib/lessons/access", () => ({ loadAccessibleLesson: vi.fn() }));
vi.mock("@/lib/tenancy", () => ({
  DEFAULT_TENANT_ID: "tenant_edsync_default",
  linkTenantObject: vi.fn(async () => undefined),
  resolveTenantContext: vi.fn(async () => ({ tenant: { id: "tenant_edsync_default" }, portal: null, membership: null })),
}));

import { POST } from "./route";

const item = { id: "item-1", prompt: "2 + 2", answer: "4", response: "4", points: 1 };

async function post(body: unknown) {
  const response = await POST(
    new Request("https://edsync.test/api/practice/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    undefined,
  );
  return { status: response.status, payload: (await response.json()) as { data: unknown; error: string | null } };
}

describe("practice attempts route", () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.query.mockResolvedValue([]);
    mocks.batch.mockReset();
    mocks.batch.mockResolvedValue(undefined);
    mocks.user = { id: "student-1", email: "student@example.com", user_metadata: { role: "student" } };
    vi.mocked(loadAccessibleLesson).mockReset();
    vi.mocked(loadAccessibleLesson).mockResolvedValue(null);
    vi.mocked(resolveTenantContext).mockReset().mockResolvedValue({ tenant: { id: "tenant_edsync_default" }, portal: null, membership: null } as never);
  });

  it("stores a valid local practice attempt with its items in one batch", async () => {
    const missed = { ...item, id: "item-2", response: "5" };
    const { status, payload } = await post({
      mode: "sprint",
      sourceId: "local-practice",
      elapsedSeconds: 30,
      targetSeconds: 60,
      items: [item, missed],
    });
    expect(status).toBe(200);
    expect(payload.error).toBeNull();
    expect(String(mocks.query.mock.calls[0]?.[0])).toContain("INSERT INTO practice_attempts");
    expect(mocks.batch).toHaveBeenCalledTimes(1);
    const statements = mocks.batch.mock.calls[0]?.[0] as Array<{ sql: string }>;
    expect(statements.map(({ sql }) => sql.match(/INSERT INTO (\w+)/)?.[1])).toEqual([
      "practice_attempt_items",
      "practice_attempt_items",
      "practice_review_cards",
      "learning_events",
    ]);
  });

  it("grades accepted spelling variants on the server", async () => {
    const { status, payload } = await post({ mode: "quiz", items: [{ ...item, answer: "São Paulo", accept: ["Sao Paulo"], response: " SAO   PAULO " }] });
    expect(status).toBe(200);
    expect((payload.data as { summary: { correctItems: number } }).summary.correctItems).toBe(1);
    const statements = mocks.batch.mock.calls[0]?.[0] as Array<{ sql: string; params: unknown[] }>;
    expect(statements.filter((statement) => statement.sql.includes("practice_review_cards"))).toHaveLength(0);
  });

  it.each(["teacher", "admin"])("saves practice for a lesson accessible to its %s", async (role) => {
    mocks.user = { id: `${role}-1`, email: `${role}@example.com`, user_metadata: { role } };
    vi.mocked(loadAccessibleLesson).mockResolvedValue({ id: "lesson-1", title: "Fractions", teacher_id: "teacher-1", class_id: "class-1", status: "published" });
    const { status } = await post({ mode: "quiz", sourceType: "lesson", sourceId: "lesson-1", items: [item] });
    expect(status).toBe(200);
    expect(loadAccessibleLesson).toHaveBeenCalledWith(expect.objectContaining({ lessonId: "lesson-1", user: expect.objectContaining({ id: `${role}-1` }) }));
  });

  it("rejects an inaccessible lesson source for a student", async () => {
    const { status } = await post({ mode: "quiz", sourceType: "lesson", sourceId: "other-lesson", items: [item] });
    expect(status).toBe(404);
    expect(loadAccessibleLesson).toHaveBeenCalledWith(expect.objectContaining({ user: expect.objectContaining({ id: "student-1" }) }));
    expect(mocks.batch).not.toHaveBeenCalled();
  });

  it("blocks a signed-in outsider from writing local practice into an organization", async () => {
    vi.mocked(resolveTenantContext).mockResolvedValueOnce({ tenant: { id: "tenant-school" }, portal: null, membership: null } as never);
    const { status, payload } = await post({ mode: "quiz", sourceId: "local-practice", items: [item] });
    expect(status).toBe(403);
    expect(payload.error).toBe("Organization membership required.");
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.batch).not.toHaveBeenCalled();
  });

  it.each([
    ["malformed JSON", "{oops", "Invalid JSON body."],
    ["unknown modes", { mode: "timed", items: [item] }, "Choose a supported practice mode."],
    ["missing items", { mode: "quiz", items: [] }, "Practice mode and items are required."],
    [
      "too many items",
      { mode: "quiz", items: Array.from({ length: 201 }, (_, index) => ({ ...item, id: `item-${index}` })) },
      "up to 200 items",
    ],
    ["object answers", { mode: "quiz", items: [{ ...item, answer: { $gt: "" } }] }, "Practice answers"],
    ["invalid variants", { mode: "quiz", items: [{ ...item, accept: [42] }] }, "Accepted answers"],
    ["missing prompts", { mode: "quiz", items: [{ ...item, prompt: "" }] }, "needs an id and a prompt"],
    [
      "non-finite points",
      '{"mode":"quiz","items":[{"id":"item-1","prompt":"2 + 2","answer":"4","points":1e999}]}',
      "points must be between",
    ],
    ["NaN-like string points", { mode: "quiz", items: [{ ...item, points: "NaN" }] }, "points must be between"],
    ["negative elapsed time", { mode: "quiz", elapsedSeconds: -5, items: [item] }, "Elapsed time"],
    ["string target time", { mode: "quiz", targetSeconds: "soon", items: [item] }, "Target time"],
  ])("rejects %s with 400 before writing", async (_label, body, message) => {
    const { status, payload } = await post(body);
    expect(status).toBe(400);
    expect(payload.error).toContain(message);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.batch).not.toHaveBeenCalled();
  });
});
