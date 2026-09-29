// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import type { AIProviderRow } from "./providers";
import { listEnabledProviderRows } from "./providers";
import { aiGatewayChat } from "./gateway";

const provider: AIProviderRow = {
  id: "gateway-test-provider", name: "Test provider", provider: "groq", provider_type: "chat", account_email: null,
  project_name: null, api_key_encrypted: "sealed", default_model: "llama-test", supported_models: null,
  endpoint_override: "https://example.test/chat", notes: null, enabled: 1, priority: 1, requests_per_minute: 10,
  max_input_chars: 3000, max_completion_tokens: 1000, timeout_ms: 5000, cooldown_seconds: 1,
  last_status: "ok", last_error: null, last_checked_at: null, created_by: null, created_at: "", updated_at: "",
};

vi.mock("./providers", () => ({ listEnabledProviderRows: vi.fn(async () => [provider]), PROVIDER_META: { groq: { defaultEndpoint: "https://example.test/chat", defaultModel: "llama-test" } } }));
vi.mock("@/lib/security/secrets", () => ({ decryptSecret: vi.fn(() => "secret"), isSecretEncryptionConfigured: vi.fn(() => true) }));
vi.mock("@/lib/db/d1", () => ({ d1Query: vi.fn(async () => []) }));

describe("AI gateway", () => {
  it("retries a truncated completion once with a larger budget and JSON mode", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ finish_reason: "length", message: { content: '{"title":"Half' } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: '{"title":"Complete"}' } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(aiGatewayChat({ messages: [{ role: "user", content: "JSON please" }], maxTokens: 1000, jsonMode: true, userId: "teacher-1" })).resolves.toBe('{"title":"Complete"}');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = JSON.parse(fetchMock.mock.calls[0][1].body);
    const second = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(first.response_format).toEqual({ type: "json_object" });
    expect(second.max_tokens).toBeGreaterThan(first.max_tokens);
  });

  it("replaces a stored Groq model that has been shut down", async () => {
    vi.mocked(listEnabledProviderRows).mockResolvedValueOnce([{ ...provider, id: "gateway-retired-model", default_model: "groq/compound" }]);
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "OK" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(aiGatewayChat({ messages: [{ role: "user", content: "Hi" }] })).resolves.toBe("OK");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).model).toBe("qwen/qwen3.8-27b");
  });
});
