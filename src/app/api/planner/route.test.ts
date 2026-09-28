// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: async () => ({ id: "student-1", email: "student@example.com", user_metadata: { role: "student" } }),
}));
vi.mock("@/lib/tenancy", () => ({
  DEFAULT_TENANT_ID: "tenant_edsync_default",
  resolveTenantContext: async () => ({ tenant: { id: "tenant_edsync_default" } }),
}));
vi.mock("@/lib/db/d1", () => ({ d1Query: mocks.query }));

import { GET } from "./route";

let classCount = 150;

describe("GET /api/planner", () => {
  beforeEach(() => {
    classCount = 150;
    mocks.query.mockReset();
    mocks.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
      if (sql.includes("FROM class_enrollments ce")) {
        return Array.from({ length: classCount }, (_, index) => ({ id: `class-${index}`, teacher_id: "teacher-1", name: `Class ${index}` }));
      }
      if (sql.includes("FROM announcements a")) {
        return [{ id: `announcement-${params[0]}`, publish_at: "2026-09-29T10:00:00Z", created_at: "2026-09-29T09:00:00Z" }];
      }
      if (sql.includes("FROM schedule_events e")) {
        const events = sql.includes("e.class_id IN") ? [{ id: `event-${params[0]}`, due_at: "2026-09-30T10:00:00Z" }] : [];
        if (sql.includes("e.owner_id = ?")) events.push({ id: "personal-event", due_at: "2026-09-29T10:00:00Z" });
        return events;
      }
      return [];
    });
  });

  it("chunks large class lists and includes a personal event once", async () => {
    const response = await GET(new Request("http://localhost/api/planner"));
    expect(response.status).toBe(200);
    const payload = await response.json() as { data: { events: Array<{ id: string }>; announcements: Array<{ id: string }> } };
    expect(payload.data.events.map((event) => event.id)).toEqual([
      "personal-event", "event-class-0", "event-class-99",
    ]);
    expect(payload.data.announcements).toHaveLength(2);
    const listQueries = mocks.query.mock.calls.filter(([sql]) =>
      String(sql).includes("FROM announcements a") || String(sql).includes("FROM schedule_events e"));
    expect(listQueries).toHaveLength(4);
    expect(listQueries.every(([, params]) => (params as unknown[]).length <= 100)).toBe(true);
  });

  it("includes personal events for students who have not joined a class", async () => {
    classCount = 0;
    const response = await GET(new Request("http://localhost/api/planner"));
    const payload = await response.json() as { data: { events: Array<{ id: string }>; announcements: unknown[] } };
    expect(payload.data.events.map((event) => event.id)).toEqual(["personal-event"]);
    expect(payload.data.announcements).toEqual([]);
    expect(mocks.query.mock.calls.filter(([sql]) => String(sql).includes("FROM announcements a"))).toHaveLength(0);
  });
});
