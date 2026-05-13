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
}

export async function generateAIChat(opts: AIChatRequest): Promise<string> {
  return aiGatewayChat({
    messages: opts.messages,
    maxTokens: opts.maxTokens,
    temperature: opts.temperature,
    model: opts.model,
    feature: opts.feature || "chat",
  });
}

export function parseJsonResponse<T>(raw: string): T {
  let clean = raw.trim();
  clean = clean.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start !== -1 && end !== -1) {
    clean = clean.slice(start, end + 1);
  }
  return JSON.parse(clean) as T;
}
