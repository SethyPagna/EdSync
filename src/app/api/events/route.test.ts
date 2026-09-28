// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  append: vi.fn(async () => "event-1"),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: async () => ({ id: "student-1", email: "student@example.com", user_metadata: { role: "student" } }),
}));
vi.mock("@/lib/tenancy", () => ({
  DEFAULT_TENANT_ID: "tenant_edsync_default",
  resolveTenantContext: async () => ({ tenant: { id: "tenant_edsync_default" }, membership: null }),
}));
vi.mock("@/lib/learning-events", () => ({ appendLearningEvent: mocks.append }));

import { POST } from "./route";

function submit(eventType: string) {
  return POST(new Request("http://localhost/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceType: "practice", eventType, payload: { score: 100 } }),
  }), undefined);
}

describe("POST /api/events", () => {
  it("rejects client-created grade events before appending them", async () => {
    mocks.append.mockClear();
    for (const eventType of ["grade.lesson_quiz.recorded", "Grade.lesson_quiz.recorded"]) {
      const response = await submit(eventType);
      expect(response.status).toBe(403);
    }
    expect(mocks.append).not.toHaveBeenCalled();
  });

  it("keeps ordinary learning events available", async () => {
    mocks.append.mockClear();
    const response = await submit("practice.completed");
    expect(response.status).toBe(200);
    expect(mocks.append).toHaveBeenCalledOnce();
  });
});
