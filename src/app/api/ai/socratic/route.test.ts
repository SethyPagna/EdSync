// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({ getAuthenticatedUser: vi.fn(async () => ({ user: { id: "student-1" } })) }));
vi.mock("@/lib/security/rate-limit", () => ({ enforceRateLimit: vi.fn(async () => ({ allowed: true })) }));
vi.mock("@/lib/ai/personalization", () => ({ loadAiUserContext: vi.fn(async () => ({ prompt: "Student level." })) }));
vi.mock("@/lib/ai/chat", () => ({ generateAIChat: vi.fn(async () => "") }));

describe("Socratic AI errors", () => {
  it("returns an error instead of a fake hint when the provider has no answer", async () => {
    const response = await POST(new NextRequest("http://localhost/api/ai/socratic", { method: "POST", body: JSON.stringify({ question: "Why?" }) }));
    expect(response.status).toBe(502);
    expect(await response.json()).toHaveProperty("error");
  });
});
