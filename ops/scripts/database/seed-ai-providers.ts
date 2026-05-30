import { createCipheriv, randomBytes } from "node:crypto";
import { d1Query, loadCloudflareEnv } from "../shared/cloudflare-d1";

const ENCRYPTION_PREFIX = "enc:v1";

type ProviderName = "groq" | "google" | "mistral" | "cerebras" | "cohere";

type AiProviderSeed = {
  env: string;
  name: string;
  provider: ProviderName;
  type: "chat" | "embed";
  model: string;
  priority: number;
  rpm: number;
  timeout: number;
  cooldown: number;
};

type AuthUserIdRow = {
  id: string;
};

const PROVIDERS = [
  { env: "GROQ_RESEARCH_1_KEY", name: "Groq Research 1", provider: "groq", type: "chat", model: "groq/compound", priority: 10, rpm: 18, timeout: 18000, cooldown: 20 },
  { env: "GROQ_GPT_OSS_2_KEY", name: "Groq GPT OSS 2", provider: "groq", type: "chat", model: "groq/compound", priority: 11, rpm: 18, timeout: 18000, cooldown: 20 },
  { env: "GROQ_QWEN_3_KEY", name: "Groq Qwen 3", provider: "groq", type: "chat", model: "groq/compound", priority: 12, rpm: 18, timeout: 18000, cooldown: 20 },
  { env: "GROQ_LLAMA_SCOUT_4_KEY", name: "Groq Llama Scout 4", provider: "groq", type: "chat", model: "groq/compound", priority: 13, rpm: 18, timeout: 18000, cooldown: 20 },
  { env: "GOOGLE_AI_1_KEY", name: "Google AI 1", provider: "google", type: "chat", model: "gemini-flash-latest", priority: 20, rpm: 14, timeout: 17000, cooldown: 20 },
  { env: "GOOGLE_AI_2_KEY", name: "Google AI 2", provider: "google", type: "chat", model: "gemini-flash-latest", priority: 21, rpm: 14, timeout: 17000, cooldown: 20 },
  { env: "MISTRAL_MAIN_KEY", name: "Mistral Main", provider: "mistral", type: "chat", model: "mistral-small-latest", priority: 30, rpm: 10, timeout: 18000, cooldown: 25 },
  { env: "CEREBRAS_1_KEY", name: "Cerebras 1", provider: "cerebras", type: "chat", model: "llama3.1-8b", priority: 40, rpm: 12, timeout: 14000, cooldown: 25 },
  { env: "CEREBRAS_2_KEY", name: "Cerebras 2", provider: "cerebras", type: "chat", model: "llama3.1-8b", priority: 41, rpm: 12, timeout: 14000, cooldown: 25 },
  { env: "CEREBRAS_3_KEY", name: "Cerebras 3", provider: "cerebras", type: "chat", model: "llama3.1-8b", priority: 42, rpm: 12, timeout: 14000, cooldown: 25 },
  { env: "CEREBRAS_4_KEY", name: "Cerebras 4", provider: "cerebras", type: "chat", model: "llama3.1-8b", priority: 43, rpm: 12, timeout: 14000, cooldown: 25 },
  { env: "COHERE_EMBEDDINGS_KEY", name: "Cohere Embeddings", provider: "cohere", type: "embed", model: "embed-english-v3.0", priority: 90, rpm: 20, timeout: 12000, cooldown: 20 },
 ] satisfies AiProviderSeed[];

const ENDPOINTS = {
  groq: "https://api.groq.com/openai/v1/chat/completions",
  google: "https://generativelanguage.googleapis.com/v1beta/models",
  mistral: "https://api.mistral.ai/v1/chat/completions",
  cerebras: "https://api.cerebras.ai/v1/chat/completions",
  cohere: "https://api.cohere.com/v2/embed",
};

function cloudflareGatewayProviderBase(provider: string) {
  const rawGatewayUrl = process.env.CLOUDFLARE_AI_GATEWAY_URL;
  if (!rawGatewayUrl) return null;

  try {
    const url = new URL(rawGatewayUrl);
    const parts = url.pathname.replace(/\/$/, "").split("/").filter(Boolean);
    if (parts.length >= 4) {
      parts[3] = provider;
    } else {
      parts.push(provider);
    }
    url.pathname = `/${parts.join("/")}`;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function endpointFor(provider: ProviderName) {
  if (provider === "groq") {
    const gateway = cloudflareGatewayProviderBase("groq");
    return gateway ? `${gateway}/chat/completions` : ENDPOINTS.groq;
  }
  if (provider === "cerebras") {
    const gateway = cloudflareGatewayProviderBase("cerebras");
    return gateway ? `${gateway}/chat/completions` : ENDPOINTS.cerebras;
  }
  if (provider === "google") {
    const gateway = cloudflareGatewayProviderBase("google-ai-studio");
    return gateway ? `${gateway}/v1beta/models` : ENDPOINTS.google;
  }
  return ENDPOINTS[provider];
}

function encryptionKey() {
  const value = process.env.APP_ENCRYPTION_KEY;
  if (!value) throw new Error("APP_ENCRYPTION_KEY is required.");
  if (/^[a-f0-9]{64}$/i.test(value)) return Buffer.from(value, "hex");
  const decoded = Buffer.from(value, "base64");
  if (decoded.length === 32) return decoded;
  const raw = Buffer.from(value);
  if (raw.length === 32) return raw;
  throw new Error("APP_ENCRYPTION_KEY must decode to 32 bytes.");
}

function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTION_PREFIX}:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

async function main() {
  loadCloudflareEnv();

  const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const [admin] = adminEmail
    ? await d1Query<AuthUserIdRow>("SELECT id FROM auth_users WHERE lower(email) = lower(?) LIMIT 1", [adminEmail])
    : [];
  const createdBy = admin?.id ?? null;

  for (const provider of PROVIDERS) {
    const apiKey = process.env[provider.env];
    if (!apiKey) continue;

    const id = provider.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    await d1Query(
    `INSERT INTO ai_provider_configs (
       id, name, provider, provider_type, account_email, project_name, api_key_encrypted,
       default_model, supported_models, endpoint_override, notes, enabled, priority,
       requests_per_minute, max_input_chars, max_completion_tokens, timeout_ms,
       cooldown_seconds, last_status, created_by, created_at, updated_at
     ) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, '[]', ?, ?, 1, ?, ?, ?, ?, ?, ?, 'untested', ?, datetime('now'), datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       api_key_encrypted = excluded.api_key_encrypted,
       default_model = excluded.default_model,
       endpoint_override = excluded.endpoint_override,
       notes = excluded.notes,
       enabled = 1,
       priority = excluded.priority,
       requests_per_minute = excluded.requests_per_minute,
       max_input_chars = excluded.max_input_chars,
       max_completion_tokens = excluded.max_completion_tokens,
       timeout_ms = excluded.timeout_ms,
       cooldown_seconds = excluded.cooldown_seconds,
       updated_at = datetime('now')`,
      [
        id,
        provider.name,
        provider.provider,
        provider.type,
        encrypt(apiKey),
        provider.model,
        endpointFor(provider.provider),
        `Seeded ${provider.provider} provider for EdSync smart fallback.`,
        provider.priority,
        provider.rpm,
        provider.type === "embed" ? 2000 : 3000,
        provider.type === "embed" ? 0 : 2200,
        provider.timeout,
        provider.cooldown,
        createdBy,
      ],
    );
    console.log(`Seeded ${provider.name}.`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
