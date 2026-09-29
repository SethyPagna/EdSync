// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { generateAIChat } from "@/lib/ai/chat";
import { POST } from "./route";

vi.mock("@/lib/auth/session", () => ({ getSessionUser: vi.fn(async () => ({ id: "teacher-1" })) }));
vi.mock("@/lib/security/rate-limit", () => ({ enforceRateLimit: vi.fn(async () => ({ allowed: true })) }));
vi.mock("@/lib/ai/chat", async () => ({ ...await vi.importActual<typeof import("@/lib/ai/chat")>("@/lib/ai/chat"), generateAIChat: vi.fn(async () => '{"suggestions":[]}') }));

describe("AI analytics privacy", () => {
  it("sends only aggregate counts, not client-provided student identifiers or free text", async () => {
    const response = await POST(new Request("http://localhost/api/ai/analytics", { method: "POST", body: JSON.stringify({
      studentStats: [{ id: "student-secret-42", name: "Ada Sensitive", avgScore: 51, reflectionCount: 2, lowConfidenceReflections: 1 }],
      lessonStats: [{ knowledgeGaps: ["Ada Sensitive struggles with algebra"] }],
      reviewSignal: { pendingCount: 3, copy: "student-secret-42 needs help", topModeLabel: "Ada Sensitive" },
    }) }));
    expect(response.status).toBe(200);
    const sent = JSON.stringify(vi.mocked(generateAIChat).mock.calls[0][0].messages);
    expect(sent).toContain("atRisk");
    expect(sent).not.toMatch(/Ada Sensitive|student-secret-42/);
    expect((await response.json()).suggestions.length).toBeGreaterThan(0);
  });
});
