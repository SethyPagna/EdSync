import { d1Query } from "@/lib/db/d1";
import { decryptSecret } from "@/lib/security/secrets";
import { listEnabledProviderRows, PROVIDER_META, type AIProviderKey, type AIProviderRow } from "./providers";

export type AIChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AIChatOptions = {
  messages: AIChatMessage[];
  feature?: string;
  userId?: string | null;
  maxTokens?: number;
  temperature?: number;
  model?: string;
};

type RuntimeState = {
  requestTimestamps: number[];
  activeRequests: number;
  lastUsedAt: number;
  cooldownUntil: number;
  failureCount: number;
  lastFailure: string;
};

type RuntimeProvider = AIProviderRow & {
  apiKey: string;
  endpoint: string;
};

type ProviderResult = {
  text: string;
  raw: unknown;
};

const ONE_MINUTE_MS = 60_000;
const PROVIDER_RUNTIME = new Map<string, RuntimeState>();

function trim(value: unknown) {
  return String(value ?? "").trim();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function runtimeState(providerId: string) {
  if (!PROVIDER_RUNTIME.has(providerId)) {
    PROVIDER_RUNTIME.set(providerId, {
      requestTimestamps: [],
      activeRequests: 0,
      lastUsedAt: 0,
      cooldownUntil: 0,
      failureCount: 0,
      lastFailure: "",
    });
  }
  return PROVIDER_RUNTIME.get(providerId)!;
}

function prune(providerId: string, now = Date.now()) {
  const state = runtimeState(providerId);
  state.requestTimestamps = state.requestTimestamps.filter((timestamp) => now - timestamp < ONE_MINUTE_MS);
  return state;
}

function endpointFor(row: AIProviderRow) {
  const provider = row.provider as AIProviderKey;
  if (row.endpoint_override) return row.endpoint_override;
  return PROVIDER_META[provider]?.defaultEndpoint || "";
}

function assertHttpsEndpoint(endpoint: string) {
  const url = new URL(endpoint);
  if (url.protocol !== "https:") throw new Error("AI provider endpoint must use HTTPS.");
  return url.toString();
}

async function loadRuntimeProviders() {
  let rows: AIProviderRow[] = [];
  try {
    rows = await listEnabledProviderRows("chat");
  } catch {
    rows = [];
  }

  const runtimeRows = rows
    .map((row) => {
      const apiKey = decryptSecret(row.api_key_encrypted);
      const endpoint = endpointFor(row);
      if (!apiKey || !endpoint) return null;
      try {
        return { ...row, apiKey, endpoint: assertHttpsEndpoint(endpoint) } satisfies RuntimeProvider;
      } catch {
        return null;
      }
    })
    .filter((row): row is RuntimeProvider => Boolean(row));

  return runtimeRows;
}

function pickProvider(providers: RuntimeProvider[], now = Date.now()) {
  return providers
    .map((provider) => {
      const state = prune(provider.id, now);
      const remaining = Math.max(0, Number(provider.requests_per_minute || 1) - state.requestTimestamps.length);
      return { provider, state, remaining };
    })
    .filter((entry) => entry.state.cooldownUntil <= now && entry.remaining > 0)
    .sort(
      (left, right) =>
        Number(left.provider.priority || 50) - Number(right.provider.priority || 50) ||
        left.state.activeRequests - right.state.activeRequests ||
        left.state.failureCount - right.state.failureCount ||
        left.state.lastUsedAt - right.state.lastUsedAt,
    )[0]?.provider;
}

function markStart(provider: RuntimeProvider, now = Date.now()) {
  const state = prune(provider.id, now);
  state.activeRequests += 1;
  state.requestTimestamps.push(now);
  state.lastUsedAt = now;
}

function markSuccess(provider: RuntimeProvider) {
  const state = runtimeState(provider.id);
  state.activeRequests = Math.max(0, state.activeRequests - 1);
  state.failureCount = 0;
  state.lastFailure = "";
}

function markFailure(provider: RuntimeProvider, error: unknown, now = Date.now()) {
  const state = runtimeState(provider.id);
  state.activeRequests = Math.max(0, state.activeRequests - 1);
  state.failureCount += 1;
  state.lastFailure = error instanceof Error ? error.message.slice(0, 300) : "Provider failed";
  state.cooldownUntil = now + Number(provider.cooldown_seconds || 20) * 1000 * Math.min(3, state.failureCount);
}

function extractOpenAiText(payload: any) {
  const content = payload?.choices?.[0]?.message?.content ?? payload?.choices?.[0]?.text ?? "";
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : part?.text || part?.content || ""))
      .join("")
      .trim();
  }
  return "";
}

async function callOpenAiCompatible(provider: RuntimeProvider, options: AIChatOptions): Promise<ProviderResult> {
  const response = await fetch(provider.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://edsync-two.vercel.app",
      "X-Title": "EdSync",
    },
    signal: AbortSignal.timeout ? AbortSignal.timeout(Number(provider.timeout_ms || 25000)) : undefined,
    body: JSON.stringify({
      model: options.model || provider.default_model || PROVIDER_META[provider.provider as AIProviderKey]?.defaultModel,
      messages: options.messages,
      max_tokens: clamp(Number(options.maxTokens || provider.max_completion_tokens || 1800), 128, 8192),
      temperature: typeof options.temperature === "number" ? options.temperature : 0.45,
      stream: false,
    }),
  });
  const raw = await response.json().catch(async () => ({ error: await response.text().catch(() => "") }));
  if (!response.ok) throw new Error(raw?.error?.message || raw?.message || `AI request failed (${response.status})`);
  return { text: extractOpenAiText(raw), raw };
}

async function callGoogle(provider: RuntimeProvider, options: AIChatOptions): Promise<ProviderResult> {
  const model = options.model || provider.default_model || PROVIDER_META.google.defaultModel;
  const base = provider.endpoint.replace(/\/$/, "");
  const response = await fetch(`${base}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(provider.apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout ? AbortSignal.timeout(Number(provider.timeout_ms || 18000)) : undefined,
    body: JSON.stringify({
      contents: options.messages
        .filter((message) => message.role !== "system")
        .map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }],
        })),
      systemInstruction: {
        parts: [{ text: options.messages.filter((message) => message.role === "system").map((message) => message.content).join("\n") }],
      },
      generationConfig: {
        temperature: typeof options.temperature === "number" ? options.temperature : 0.45,
        maxOutputTokens: clamp(Number(options.maxTokens || provider.max_completion_tokens || 1800), 128, 8192),
      },
    }),
  });
  const raw = await response.json().catch(async () => ({ error: await response.text().catch(() => "") }));
  if (!response.ok) throw new Error(raw?.error?.message || `Google AI request failed (${response.status})`);
  const text = raw?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => trim(part.text)).filter(Boolean).join("\n") || "";
  return { text, raw };
}

async function callProvider(provider: RuntimeProvider, options: AIChatOptions) {
  if (provider.provider === "google") return callGoogle(provider, options);
  return callOpenAiCompatible(provider, options);
}

async function auditRun(input: {
  userId?: string | null;
  feature: string;
  provider: RuntimeProvider;
  success: boolean;
  latencyMs: number;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await d1Query(
      `INSERT INTO ai_runs (
         id, user_id, feature, provider, model, success, latency_ms, error_message, metadata, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        crypto.randomUUID(),
        input.userId ?? null,
        input.feature,
        input.provider.provider,
        input.provider.default_model ?? null,
        input.success ? 1 : 0,
        input.latencyMs,
        input.errorMessage ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
  } catch {
    // Audit logging must never break the user-facing AI path.
  }
}

export async function aiGatewayChat(options: AIChatOptions) {
  const started = Date.now();
  const providers = await loadRuntimeProviders();
  if (providers.length === 0) throw new Error("No AI provider is configured.");

  const attempted = new Set<string>();
  const failovers: { provider: string; name: string; error: string }[] = [];
  let lastError: unknown = null;

  while (attempted.size < providers.length) {
    const provider = pickProvider(providers.filter((item) => !attempted.has(item.id)));
    if (!provider) break;

    attempted.add(provider.id);
    markStart(provider);
    try {
      const result = await callProvider(provider, options);
      if (!result.text) throw new Error("Provider returned an empty response.");
      markSuccess(provider);
      await auditRun({
        userId: options.userId,
        feature: options.feature || "chat",
        provider,
        success: true,
        latencyMs: Date.now() - started,
        metadata: { failovers },
      });
      return result.text;
    } catch (error) {
      lastError = error;
      markFailure(provider, error);
      failovers.push({
        provider: provider.provider,
        name: provider.name,
        error: error instanceof Error ? error.message.slice(0, 300) : "Provider failed",
      });
      await auditRun({
        userId: options.userId,
        feature: options.feature || "chat",
        provider,
        success: false,
        latencyMs: Date.now() - started,
        errorMessage: error instanceof Error ? error.message : "Provider failed",
        metadata: { failovers },
      });
    }
  }

  throw new Error(lastError instanceof Error ? lastError.message : "All AI providers are busy or unavailable.");
}

export async function testAIProvider(row: AIProviderRow) {
  const apiKey = decryptSecret(row.api_key_encrypted);
  const endpoint = endpointFor(row);
  if (!apiKey || !endpoint) throw new Error("Provider API key or endpoint is unavailable.");

  const provider: RuntimeProvider = {
    ...row,
    apiKey,
    endpoint: assertHttpsEndpoint(endpoint),
  };

  if (row.provider_type === "embed" && row.provider === "cohere") {
    const response = await fetch(provider.endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout ? AbortSignal.timeout(Number(row.timeout_ms || 12000)) : undefined,
      body: JSON.stringify({ model: row.default_model, texts: ["health check"], input_type: "search_document" }),
    });
    if (!response.ok) throw new Error(`Embedding provider failed (${response.status})`);
    return "Embedding provider responded.";
  }

  const text = await callProvider(provider, {
    messages: [{ role: "user", content: "Reply with OK only." }],
    maxTokens: 32,
    temperature: 0,
  });
  return trim(text.text || "OK");
}
