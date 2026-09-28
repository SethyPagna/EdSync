// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn(), batch: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: vi.fn(async () => ({ id: "student-1", email: "student@example.com", user_metadata: { role: "student" } })),
}));
vi.mock("@/lib/db/d1", () => ({ d1Query: mocks.query, d1Batch: mocks.batch }));
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
