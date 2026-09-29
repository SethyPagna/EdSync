import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { generateAIJson } from "@/lib/ai/chat";
import {
  OUTLINE_SYSTEM_PROMPT,
  buildOutlineUserPrompt,
  outlineFromText,
  outlineFromTopic,
  outlineMaxTokens,
  parseOutline,
} from "@/lib/compose";
import type { OutlineRequest } from "@/components/compose/api";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { BadRequestError, routeErrorResponse } from "@/lib/security/http-errors";
import { resolveTenantContext } from "@/lib/tenancy";

export const preferredRegion = ["hkg1", "sin1"];

function isOutlineShape(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.title === "string" && Array.isArray(record.sections) && record.sections.length > 0;
}

function readRequest(value: unknown): OutlineRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BadRequestError("Request body must be an object.");
  const body = value as Record<string, unknown>;
  const topic = typeof body.topic === "string" ? body.topic.trim().slice(0, 200) : "";
  const sourceText = typeof body.sourceText === "string" ? body.sourceText.trim().slice(0, 60_000) : "";
  if (!topic && !sourceText) throw new BadRequestError("Add a topic or source text.");
  if (body.mode !== undefined && !["auto", "ai", "local"].includes(String(body.mode))) throw new BadRequestError("Invalid generation mode.");
  return {
    topic,
    sourceText,
    mode: (body.mode as OutlineRequest["mode"]) || "auto",
    audience: typeof body.audience === "string" ? body.audience.slice(0, 120) : undefined,
    level: ["beginner", "intermediate", "advanced"].includes(String(body.level)) ? body.level as OutlineRequest["level"] : undefined,
    language: typeof body.language === "string" ? body.language.slice(0, 35) : undefined,
    sectionCount: typeof body.sectionCount === "number" ? body.sectionCount : undefined,
    questionCount: typeof body.questionCount === "number" ? body.questionCount : undefined,
    style: typeof body.style === "string" ? body.style.slice(0, 120) : undefined,
  };
}

function localOutline(input: OutlineRequest) {
  return input.sourceText
    ? outlineFromText(input.sourceText, { title: input.topic || undefined, language: input.language })
    : outlineFromTopic(input.topic, { audience: input.audience, level: input.level, language: input.language });
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const context = await resolveTenantContext(user);
    await requirePermission(user, context, user.user_metadata.role === "student" ? PERMISSIONS.learn : PERMISSIONS.coursesAuthor);
    const rate = await enforceRateLimit({ request, scope: "ai_create_lesson", limit: 20, windowSeconds: 900, userId: user.id });
    if (!rate.allowed) return NextResponse.json({ error: "Too many lesson requests. Try again shortly." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
    const input = readRequest(await request.json());
    if (input.mode === "local") return NextResponse.json({ outline: localOutline(input), source: "local", warnings: [] });

    try {
      const raw = await generateAIJson({
        messages: [
          { role: "system", content: OUTLINE_SYSTEM_PROMPT },
          { role: "user", content: buildOutlineUserPrompt(input) },
        ],
        maxTokens: outlineMaxTokens(input),
        temperature: 0.3,
        feature: "lesson-outline",
        userId: user.id,
      }, isOutlineShape);
      const { outline, issues } = parseOutline(raw);
      return NextResponse.json({ outline, source: "ai", warnings: issues.map((issue) => issue.message).slice(0, 3) });
    } catch {
      if (input.mode === "ai") return NextResponse.json({ error: "AI could not create an outline. Try again or choose local generation." }, { status: 502 });
      return NextResponse.json({ outline: localOutline(input), source: "local", warnings: ["AI was unavailable. A local outline is ready to edit."] });
    }
  } catch (error) {
    return routeErrorResponse(error);
  }
}
