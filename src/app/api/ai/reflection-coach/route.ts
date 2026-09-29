import { NextRequest, NextResponse } from "next/server";
import { generateAIChat } from "@/lib/ai/chat";
import { getAuthenticatedUser } from "@/lib/auth";
import { loadAiUserContext } from "@/lib/ai/personalization";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const preferredRegion = ["hkg1", "sin1"];

type ReflectionAdvice = {
  strengths: string[];
  likelyGaps: string[];
  nextSteps: string[];
  guidingQuestion: string;
  encouragement: string;
};

function clampConfidence(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 3;
  return Math.min(5, Math.max(1, Math.round(numeric)));
}

function cleanJson(raw: string) {
  const clean = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "");
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start !== -1 && end !== -1) return clean.slice(start, end + 1);
  return clean;
}

function toAdvice(value: unknown): ReflectionAdvice | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const obj = value as Record<string, unknown>;
  const toList = (input: unknown) => {
    if (!Array.isArray(input)) return [];
    const list = input
      .filter((item) => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 3);
    return list;
  };
  const strengths = toList(obj.strengths);
  const likelyGaps = toList(obj.likelyGaps);
  const nextSteps = toList(obj.nextSteps);
  const guidingQuestion = typeof obj.guidingQuestion === "string" ? obj.guidingQuestion.trim() : "";
  const encouragement = typeof obj.encouragement === "string" ? obj.encouragement.trim() : "";
  if (!strengths.length || !likelyGaps.length || !nextSteps.length || !guidingQuestion || !encouragement) return null;

  return {
    strengths,
    likelyGaps,
    nextSteps,
    guidingQuestion,
    encouragement,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rate = await enforceRateLimit({
      request,
      scope: "ai_reflection",
      limit: 50,
      windowSeconds: 900,
      userId: user.id,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many reflection coaching requests. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
      );
    }

    const {
      reflection,
      confidence,
      lessonTitle,
      lessonObjectives,
      currentSection,
      lectureContext,
    } = await request.json();

    const reflectionText =
      typeof reflection === "string" ? reflection.trim() : "";
    if (!reflectionText) {
      return NextResponse.json(
        { error: "Reflection notes are required." },
        { status: 400 },
      );
    }

    const confidenceScore = clampConfidence(confidence);
    const objectives = Array.isArray(lessonObjectives)
      ? lessonObjectives.filter((o) => typeof o === "string").join(", ")
      : "Not specified";
    const safeContext =
      typeof lectureContext === "string"
        ? lectureContext.slice(0, 6000)
        : "No lecture context provided.";
    const aiContext = await loadAiUserContext(user.id);

    const systemPrompt = `You are an expert learning coach for EdSync.

Given a learner's reflection and course context, provide concise coaching advice.

Learner profile:
${aiContext.prompt}

Return ONLY one valid JSON object with this exact shape:
{
  "strengths": ["string", "string"],
  "likelyGaps": ["string", "string"],
  "nextSteps": ["string", "string", "string"],
  "guidingQuestion": "string",
  "encouragement": "string"
}

Rules:
- Keep each item practical and specific.
- Match the learner's level, interests, confidence, and preferred detail.
- Do not provide direct answers to quiz questions.
- Keep guidingQuestion as exactly one question.
- Keep encouragement to one sentence.
- No markdown or extra text.`;

    const raw = await generateAIChat({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Lesson: ${lessonTitle ?? "Unknown"}
Current section: ${currentSection ?? "Unknown"}
Objectives: ${objectives}
Learner confidence (1-5): ${confidenceScore}

Learner reflection:
${reflectionText}

Lecture context:
${safeContext}`,
        },
      ],
      maxTokens: 700,
      temperature: 0.4,
      userId: user.id,
      feature: "reflection-coach",
      jsonMode: true,
    });

    let advice: ReflectionAdvice | null = null;
    try {
      advice = toAdvice(JSON.parse(cleanJson(raw)));
    } catch {
      advice = null;
    }

    if (!advice) return NextResponse.json({ error: "AI returned an invalid coaching response. Please try again." }, { status: 502 });
    return NextResponse.json({ advice });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[reflection-coach]", message);
    return NextResponse.json({ error: "Reflection coaching is unavailable right now. Please try again." }, { status: 502 });
  }
}
