import { NextRequest, NextResponse } from "next/server";
import { openRouterChat } from "@/lib/openrouter";
import { getAuthenticatedUser } from "@/lib/auth";
import { loadAiUserContext } from "@/lib/ai/personalization";
import { enforceRateLimit } from "@/lib/security/rate-limit";

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
  const toList = (input: unknown, fallback: string[]) => {
    if (!Array.isArray(input)) return fallback;
    const list = input
      .filter((item) => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 3);
    return list.length > 0 ? list : fallback;
  };

  const guidingQuestion =
    typeof obj.guidingQuestion === "string" && obj.guidingQuestion.trim()
      ? obj.guidingQuestion.trim()
      : "Which concept from this lecture still feels hardest to explain in your own words?";

  const encouragement =
    typeof obj.encouragement === "string" && obj.encouragement.trim()
      ? obj.encouragement.trim()
      : "You are doing the right thing by reflecting on your understanding.";

  return {
    strengths: toList(obj.strengths, [
      "You identified key ideas from the lecture.",
    ]),
    likelyGaps: toList(obj.likelyGaps, [
      "One or two core links between concepts may still be unclear.",
    ]),
    nextSteps: toList(obj.nextSteps, [
      "Spend 10 minutes rewriting one concept using your own example.",
    ]),
    guidingQuestion,
    encouragement,
  };
}

function fallbackAdvice(confidence: number): ReflectionAdvice {
  return {
    strengths: [
      "You paused to summarize what you learned, which improves memory and understanding.",
    ],
    likelyGaps:
      confidence <= 2
        ? [
            "Your notes suggest low confidence, so focus on one concept at a time.",
          ]
        : [
            "Try checking whether you can connect each section back to the lesson objectives.",
          ],
    nextSteps: [
      "Pick one section and explain it in 3 sentences without looking at your notes.",
      "Write one real-world example that applies this concept.",
      "Ask Socratic for a hint on the part that still feels confusing.",
    ],
    guidingQuestion:
      "If you had to teach this topic to a classmate in one minute, what would you say first?",
    encouragement:
      "Reflection like this is exactly how strong learners build long-term understanding.",
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

Given a student's reflection and lecture context, provide concise coaching advice.

Student profile:
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
- Match the student's grade, interests, confidence, and preferred detail level.
- Do not provide direct answers to quiz questions.
- Keep guidingQuestion as exactly one question.
- Keep encouragement to one sentence.
- No markdown or extra text.`;

    const raw = await openRouterChat({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Lesson: ${lessonTitle ?? "Unknown"}
Current section: ${currentSection ?? "Unknown"}
Objectives: ${objectives}
Student confidence (1-5): ${confidenceScore}

Student reflection:
${reflectionText}

Lecture context:
${safeContext}`,
        },
      ],
      maxTokens: 700,
      temperature: 0.4,
    });

    let advice: ReflectionAdvice | null = null;
    try {
      advice = toAdvice(JSON.parse(cleanJson(raw)));
    } catch {
      advice = null;
    }

    return NextResponse.json({
      advice: advice ?? fallbackAdvice(confidenceScore),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[reflection-coach]", message);
    return NextResponse.json({ advice: fallbackAdvice(3) });
  }
}
