// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { AIProviderRow } from "./providers";
import { listEnabledProviderRows } from "./providers";
import { d1Query } from "@/lib/db/d1";
import { decryptSecret } from "@/lib/security/secrets";
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
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: vi.fn() }));

describe("AI gateway", () => {
  beforeEach(() => {
    vi.mocked(listEnabledProviderRows).mockReset().mockResolvedValue([provider]);
    vi.mocked(decryptSecret).mockReset().mockReturnValue("secret");
    vi.mocked(d1Query).mockReset().mockResolvedValue([]);
    vi.mocked(getCloudflareContext).mockReset().mockImplementation(() => {
      throw new Error("Cloudflare context unavailable");
    });
  });

  afterEach(() => vi.unstubAllGlobals());

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
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).model).toBe("openai/gpt-oss-120b");
  });

  it("stops after one provider when platform failover is disabled", async () => {
    vi.mocked(listEnabledProviderRows).mockResolvedValueOnce([
      { ...provider, id: "fallback-off-primary", priority: 1 },
      { ...provider, id: "fallback-off-secondary", priority: 2 },
    ]);
    vi.mocked(d1Query).mockImplementationOnce(async () => [{ enabled: 0 }]);
    const fetchMock = vi.fn().mockResolvedValue(new Response("Unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(aiGatewayChat({ messages: [{ role: "user", content: "Hi" }] })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("tries a second provider while platform failover is enabled", async () => {
    vi.mocked(listEnabledProviderRows).mockResolvedValueOnce([
      { ...provider, id: "fallback-on-primary", priority: 1 },
      { ...provider, id: "fallback-on-secondary", priority: 2 },
    ]);
    vi.mocked(d1Query).mockImplementationOnce(async () => [{ enabled: 1 }]);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("Unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "Recovered" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(aiGatewayChat({ messages: [{ role: "user", content: "Hi" }] })).resolves.toBe("Recovered");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses the Workers AI binding when stored provider keys cannot be decrypted", async () => {
    vi.mocked(decryptSecret).mockReturnValueOnce("");
    const run = vi.fn().mockResolvedValue({ response: '{"title":"Cloudflare"}' });
    vi.mocked(getCloudflareContext).mockReturnValueOnce({ env: { AI: { run } } } as never);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(aiGatewayChat({
      messages: [{ role: "user", content: "JSON please" }],
      maxTokens: 9000,
      jsonMode: true,
      feature: "lesson-outline",
      userId: "teacher-1",
    })).resolves.toBe('{"title":"Cloudflare"}');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledWith("@cf/meta/llama-3.1-8b-instruct-fp8", {
      messages: [{ role: "user", content: "JSON please" }],
      max_tokens: 4096,
      temperature: 0.45,
      stream: false,
      response_format: { type: "json_object" },
    });
    expect(vi.mocked(d1Query).mock.calls.some(([sql, params]) =>
      sql.includes("INSERT INTO ai_runs") && Array.isArray(params) && params[3] === "cloudflare" && params[5] === 1,
    )).toBe(true);
  });

  it("uses Workers AI after configured providers fail", async () => {
    vi.mocked(listEnabledProviderRows).mockResolvedValueOnce([{ ...provider, id: "cf-failover-provider" }]);
    const run = vi.fn().mockResolvedValue({ response: "Cloudflare recovered" });
    vi.mocked(getCloudflareContext).mockReturnValueOnce({ env: { AI: { run } } } as never);
    const fetchMock = vi.fn().mockResolvedValue(new Response("Unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(aiGatewayChat({ messages: [{ role: "user", content: "Hi" }] })).resolves.toBe("Cloudflare recovered");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("does not use Workers AI when a configured provider succeeds", async () => {
    const run = vi.fn();
    vi.mocked(getCloudflareContext).mockReturnValueOnce({ env: { AI: { run } } } as never);
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "Provider OK" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(aiGatewayChat({ messages: [{ role: "user", content: "Hi" }] })).resolves.toBe("Provider OK");
    expect(run).not.toHaveBeenCalled();
    expect(getCloudflareContext).not.toHaveBeenCalled();
  });

  it("does not use Workers AI when provider failover is disabled", async () => {
    vi.mocked(listEnabledProviderRows).mockResolvedValueOnce([]);
    vi.mocked(d1Query).mockResolvedValueOnce([{ enabled: 0 }]);
    const run = vi.fn();
    vi.mocked(getCloudflareContext).mockReturnValueOnce({ env: { AI: { run } } } as never);

    await expect(aiGatewayChat({ messages: [{ role: "user", content: "Hi" }] })).rejects.toThrow("No AI provider is configured.");
    expect(run).not.toHaveBeenCalled();
    expect(getCloudflareContext).not.toHaveBeenCalled();
  });

  it("preserves the provider error when no Cloudflare binding is available", async () => {
    vi.mocked(listEnabledProviderRows).mockResolvedValueOnce([]);
    await expect(aiGatewayChat({ messages: [{ role: "user", content: "Hi" }] })).rejects.toThrow("No AI provider is configured.");
  });

  it("reports Workers AI failures without retrying paid inference", async () => {
    vi.mocked(listEnabledProviderRows).mockResolvedValueOnce([]);
    const run = vi.fn().mockRejectedValue(new Error("Workers AI unavailable"));
    vi.mocked(getCloudflareContext).mockReturnValueOnce({ env: { AI: { run } } } as never);

    await expect(aiGatewayChat({ messages: [{ role: "user", content: "Hi" }] })).rejects.toThrow("Workers AI unavailable");
    expect(run).toHaveBeenCalledTimes(1);
    expect(vi.mocked(d1Query).mock.calls.some(([sql, params]) =>
      sql.includes("INSERT INTO ai_runs") && Array.isArray(params) && params[3] === "cloudflare" && params[5] === 0,
    )).toBe(true);
  });

  it("rejects oversized fallback inputs before calling Workers AI", async () => {
    vi.mocked(listEnabledProviderRows).mockResolvedValueOnce([]);
    const run = vi.fn();
    vi.mocked(getCloudflareContext).mockReturnValueOnce({ env: { AI: { run } } } as never);

    await expect(aiGatewayChat({ messages: [{ role: "user", content: "x".repeat(72_001) }] })).rejects.toThrow("too long");
    expect(run).not.toHaveBeenCalled();
  });
});
