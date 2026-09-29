// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { outlineFromTopic } from "@/lib/compose";
import { generateAIJson } from "@/lib/ai/chat";
import { POST } from "./route";

vi.mock("@/lib/auth/session", () => ({ getSessionUser: vi.fn(async () => ({ id: "teacher-1", user_metadata: { role: "teacher" } })) }));
vi.mock("@/lib/tenancy", () => ({ resolveTenantContext: vi.fn(async () => ({ tenant: { id: "tenant-1" } })) }));
vi.mock("@/lib/permissions", () => ({ PERMISSIONS: { coursesAuthor: "courses.author", learn: "learn" }, requirePermission: vi.fn(async () => undefined) }));
vi.mock("@/lib/security/rate-limit", () => ({ enforceRateLimit: vi.fn(async () => ({ allowed: true })) }));
vi.mock("@/lib/ai/chat", () => ({ generateAIJson: vi.fn() }));

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/ai/create-lesson", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

describe("create lesson outline", () => {
  beforeEach(() => vi.mocked(generateAIJson).mockReset());

  it("builds a local outline without contacting AI", async () => {
    const response = await POST(request({ topic: "Fractions", mode: "local" }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ source: "local", warnings: [], outline: { v: 1, title: "Fractions" } });
    expect(generateAIJson).not.toHaveBeenCalled();
  });

  it("returns the shared outline contract and records the user for AI usage", async () => {
    vi.mocked(generateAIJson).mockResolvedValueOnce(outlineFromTopic("Photosynthesis"));
    const response = await POST(request({ topic: "Photosynthesis", mode: "ai" }));
    expect(await response.json()).toMatchObject({ source: "ai", outline: { v: 1, title: "Photosynthesis" } });
    expect(vi.mocked(generateAIJson).mock.calls[0][0]).toMatchObject({ userId: "teacher-1", feature: "lesson-outline" });
  });

  it("requires a topic or source text", async () => {
    const response = await POST(request({ mode: "auto" }));
    expect(response.status).toBe(400);
    expect(generateAIJson).not.toHaveBeenCalled();
  });
});
