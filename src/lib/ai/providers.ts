import { d1Query } from "@/lib/db/d1";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/security/secrets";

export type AIProviderKey = "groq" | "mistral" | "cerebras" | "google" | "cohere";
export type AIProviderType = "chat" | "embed";

export type AIProviderRow = {
  id: string;
  name: string;
  provider: AIProviderKey;
  provider_type: AIProviderType;
  account_email: string | null;
  project_name: string | null;
  api_key_encrypted: string;
  default_model: string | null;
  supported_models: string | null;
  endpoint_override: string | null;
  notes: string | null;
  enabled: number;
  priority: number;
  requests_per_minute: number;
  max_input_chars: number;
  max_completion_tokens: number;
  timeout_ms: number;
  cooldown_seconds: number;
  last_status: "untested" | "ok" | "error";
  last_error: string | null;
  last_checked_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export const PROVIDER_META: Record<
  AIProviderKey,
  {
    label: string;
    providerType: AIProviderType;
    defaultEndpoint: string;
    defaultModel: string;
    defaultPriority: number;
    safeRequestsPerMinute: number;
    safeMaxInputChars: number;
    safeMaxCompletionTokens: number;
    safeTimeoutMs: number;
    safeCooldownSeconds: number;
  }
> = {
  groq: {
    label: "Groq",
    providerType: "chat",
    defaultEndpoint: "https://api.groq.com/openai/v1/chat/completions",
    defaultModel: "groq/compound",
    defaultPriority: 10,
    safeRequestsPerMinute: 18,
    safeMaxInputChars: 3000,
    safeMaxCompletionTokens: 2200,
    safeTimeoutMs: 18000,
    safeCooldownSeconds: 20,
  },
  google: {
    label: "Google AI",
    providerType: "chat",
    defaultEndpoint: "https://generativelanguage.googleapis.com/v1beta/models",
    defaultModel: "gemini-flash-latest",
    defaultPriority: 20,
    safeRequestsPerMinute: 14,
    safeMaxInputChars: 3200,
    safeMaxCompletionTokens: 2200,
    safeTimeoutMs: 17000,
    safeCooldownSeconds: 20,
  },
  mistral: {
    label: "Mistral AI",
    providerType: "chat",
    defaultEndpoint: "https://api.mistral.ai/v1/chat/completions",
    defaultModel: "mistral-small-latest",
    defaultPriority: 40,
    safeRequestsPerMinute: 10,
    safeMaxInputChars: 3000,
    safeMaxCompletionTokens: 1800,
    safeTimeoutMs: 18000,
    safeCooldownSeconds: 25,
  },
  cerebras: {
    label: "Cerebras",
    providerType: "chat",
    defaultEndpoint: "https://api.cerebras.ai/v1/chat/completions",
    defaultModel: "llama3.1-8b",
    defaultPriority: 40,
    safeRequestsPerMinute: 12,
    safeMaxInputChars: 2500,
    safeMaxCompletionTokens: 1600,
    safeTimeoutMs: 14000,
    safeCooldownSeconds: 25,
  },
  cohere: {
    label: "Cohere",
    providerType: "embed",
    defaultEndpoint: "https://api.cohere.com/v2/embed",
    defaultModel: "embed-english-v3.0",
    defaultPriority: 90,
    safeRequestsPerMinute: 20,
    safeMaxInputChars: 2000,
    safeMaxCompletionTokens: 0,
    safeTimeoutMs: 12000,
    safeCooldownSeconds: 20,
  },
};

function trim(value: unknown) {
  return String(value ?? "").trim();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function parseSupportedModels(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

export function serializeProvider(row: AIProviderRow) {
  const key = decryptSecret(row.api_key_encrypted);
  return {
    ...row,
    supported_models: parseSupportedModels(row.supported_models),
    enabled: Boolean(row.enabled),
    has_key: Boolean(key),
    key_masked: maskSecret(key),
    api_key_encrypted: undefined,
  };
}

export function normalizeProviderPayload(payload: Record<string, unknown>, existing?: AIProviderRow | null) {
  const provider = trim(payload.provider || existing?.provider).toLowerCase() as AIProviderKey;
  const meta = PROVIDER_META[provider];
  if (!meta) throw new Error("Choose a supported AI provider.");

  const supported = Array.isArray(payload.supported_models)
    ? payload.supported_models.map(trim).filter(Boolean)
    : trim(payload.supported_models)
      .split(/\r?\n|,/)
      .map(trim)
      .filter(Boolean);

  const apiKey = trim(payload.api_key);
  const encryptedKey = apiKey ? encryptSecret(apiKey) : existing?.api_key_encrypted;
  if (!encryptedKey) throw new Error("API key is required.");

  return {
    name: trim(payload.name) || existing?.name || meta.label,
    provider,
    provider_type: (trim(payload.provider_type) || existing?.provider_type || meta.providerType) as AIProviderType,
    account_email: trim(payload.account_email) || null,
    project_name: trim(payload.project_name) || null,
    api_key_encrypted: encryptedKey,
    default_model: trim(payload.default_model) || existing?.default_model || meta.defaultModel,
    supported_models: JSON.stringify(supported),
    endpoint_override: trim(payload.endpoint_override) || null,
    notes: trim(payload.notes) || null,
    enabled: payload.enabled === false ? 0 : 1,
    priority: clamp(Number(payload.priority ?? existing?.priority ?? meta.defaultPriority) || meta.defaultPriority, 1, 999),
    requests_per_minute: clamp(
      Number(payload.requests_per_minute ?? existing?.requests_per_minute ?? meta.safeRequestsPerMinute) ||
        meta.safeRequestsPerMinute,
      1,
      120,
    ),
    max_input_chars: clamp(
      Number(payload.max_input_chars ?? existing?.max_input_chars ?? meta.safeMaxInputChars) || meta.safeMaxInputChars,
      200,
      12000,
    ),
    max_completion_tokens: clamp(
      Number(payload.max_completion_tokens ?? existing?.max_completion_tokens ?? meta.safeMaxCompletionTokens) ||
        meta.safeMaxCompletionTokens,
      0,
      8192,
    ),
    timeout_ms: clamp(Number(payload.timeout_ms ?? existing?.timeout_ms ?? meta.safeTimeoutMs) || meta.safeTimeoutMs, 3000, 60000),
    cooldown_seconds: clamp(
      Number(payload.cooldown_seconds ?? existing?.cooldown_seconds ?? meta.safeCooldownSeconds) || meta.safeCooldownSeconds,
      5,
      300,
    ),
  };
}

export async function listProviderRows(type?: AIProviderType) {
  if (!type) {
    return d1Query<AIProviderRow>(
      `SELECT *
         FROM ai_provider_configs
        ORDER BY enabled DESC, provider_type ASC, priority ASC, updated_at DESC`,
    );
  }

  return d1Query<AIProviderRow>(
    `SELECT *
       FROM ai_provider_configs
      WHERE provider_type = ?
      ORDER BY enabled DESC, priority ASC, updated_at DESC`,
    [type],
  );
}

export async function listEnabledProviderRows(type: AIProviderType = "chat") {
  return d1Query<AIProviderRow>(
    `SELECT *
       FROM ai_provider_configs
      WHERE enabled = 1 AND provider_type = ?
      ORDER BY priority ASC, updated_at DESC`,
    [type],
  );
}

export async function getProviderRow(id: string) {
  const [row] = await d1Query<AIProviderRow>("SELECT * FROM ai_provider_configs WHERE id = ? LIMIT 1", [id]);
  return row ?? null;
}
