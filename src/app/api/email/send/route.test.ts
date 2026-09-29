// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/auth/session", () => ({ getSessionUser: async () => ({ id: "teacher-1", email: "teacher@example.com", user_metadata: { role: "teacher" } }) }));
vi.mock("@/lib/tenancy", () => ({ resolveTenantContext: async () => ({ tenant: { id: "tenant-1" }, portal: null }) }));
vi.mock("@/lib/permissions", () => ({ PERMISSIONS: { coursesAuthor: "courses.author" }, requirePermission: async () => undefined }));
vi.mock("@/lib/feature-flags", () => ({ isFeatureEnabled: async () => false }));

describe("course messages feature control", () => {
  it("blocks the sender endpoint when disabled", async () => {
    const response = await POST(new Request("http://localhost/api/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: "student@example.com", subject: "Hello", text: "Welcome" }),
    }), undefined);
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe("Course messages are unavailable.");
  });
});
