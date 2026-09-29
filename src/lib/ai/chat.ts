import { aiGatewayChat } from "@/lib/ai/gateway";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIChatRequest {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  model?: string;
  feature?: string;
  userId?: string | null;
  jsonMode?: boolean;
}

export async function generateAIChat(opts: AIChatRequest): Promise<string> {
  return aiGatewayChat({
    messages: opts.messages,
    maxTokens: opts.maxTokens,
    temperature: opts.temperature,
    model: opts.model,
    feature: opts.feature || "chat",
    userId: opts.userId,
    jsonMode: opts.jsonMode,
  });
}

export function parseJsonResponse<T>(raw: string): T {
  let clean = raw.trim();
  clean = clean.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const objectStart = clean.indexOf("{");
  const arrayStart = clean.indexOf("[");
  const start = objectStart < 0 ? arrayStart : arrayStart < 0 ? objectStart : Math.min(objectStart, arrayStart);
  if (start >= 0) clean = clean.slice(start, clean.lastIndexOf(clean[start] === "[" ? "]" : "}") + 1);
  return JSON.parse(clean) as T;
}

export async function generateAIJson<T>(request: AIChatRequest, guard: (value: unknown) => value is T): Promise<T> {
  const raw = await generateAIChat({ ...request, jsonMode: true });
  try {
    const parsed: unknown = parseJsonResponse(raw);
    if (guard(parsed)) return parsed;
  } catch {
    // A single repair request below handles malformed JSON and schema mismatch.
  }
  const repaired = await generateAIChat({
    ...request,
    maxTokens: Math.min(8192, Math.max(request.maxTokens ?? 1800, 2400)),
    temperature: 0,
    jsonMode: true,
    messages: [
      { role: "system", content: "Repair the following response into one valid JSON object matching the original requested schema. Return only JSON." },
      { role: "user", content: `Original request:\n${request.messages.map((message) => message.content).join("\n").slice(0, 4500)}\n\nResponse to repair:\n${raw.slice(0, 10000)}` },
    ],
  });
  const parsed: unknown = parseJsonResponse(repaired);
  if (!guard(parsed)) throw new Error("AI returned JSON that does not match the requested format.");
  return parsed;
}
