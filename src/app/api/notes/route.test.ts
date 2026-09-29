// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const state = vi.hoisted(() => ({ role: "student" }));

vi.mock("@/lib/auth/session", () => ({ getSessionUser: async () => ({ id: "member-1", user_metadata: { role: state.role } }) }));
vi.mock("@/lib/tenancy", () => ({ resolveTenantContext: async () => ({ tenant: { id: "tenant-1" }, portal: null }) }));
vi.mock("@/lib/feature-flags", () => ({ isFeatureEnabled: async () => false }));

describe("learner note feature control", () => {
  it("blocks learner reads when disabled", async () => {
    state.role = "student";
    const response = await GET(new Request("http://localhost/api/notes"));
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe("Learner notes are unavailable.");
  });

  it("blocks creator writes when disabled", async () => {
    state.role = "teacher";
    const response = await POST(new Request("http://localhost/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: "member-2", title: "Check-in", body: "Hello" }),
    }));
    expect(response.status).toBe(403);
  });
});
