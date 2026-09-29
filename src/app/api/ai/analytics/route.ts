import { NextResponse } from "next/server";
import { generateAIChat, parseJsonResponse } from "@/lib/ai/chat";
import { getSessionUser } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const preferredRegion = ["hkg1", "sin1"];

type Aggregate = {
  learners: number;
  scored: number;
  atRisk: number;
  advanced: number;
  averageScore: number | null;
  reflections: number;
  lowConfidence: number;
  pendingReviews: number;
  repeatedReviews: number;
  lessonsWithGaps: number;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(10000, Math.round(value))) : 0;
}

function aggregateAnalytics(payload: unknown): Aggregate {
  const input = record(payload);
  const students = Array.isArray(input.studentStats) ? input.studentStats.slice(0, 10000).map(record) : [];
  const lessons = Array.isArray(input.lessonStats) ? input.lessonStats.slice(0, 10000).map(record) : [];
  const scores = students.map((student) => student.avgScore).filter((score): score is number => typeof score === "number" && Number.isFinite(score)).map((score) => Math.max(0, Math.min(100, score)));
  const review = record(input.reviewSignal);
  return {
    learners: students.length,
    scored: scores.length,
    atRisk: scores.filter((score) => score < 60).length,
    advanced: scores.filter((score) => score >= 80).length,
    averageScore: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
    reflections: students.reduce((sum, student) => sum + count(student.reflectionCount), 0),
    lowConfidence: students.reduce((sum, student) => sum + count(student.lowConfidenceReflections), 0),
    pendingReviews: count(review.pendingCount),
    repeatedReviews: count(review.againCount),
    lessonsWithGaps: lessons.filter((lesson) => Array.isArray(lesson.knowledgeGaps) && lesson.knowledgeGaps.length > 0).length,
  };
}

function ruleBasedSuggestions(data: Aggregate): string[] {
  const suggestions: string[] = [];
  if (data.atRisk) suggestions.push(`Plan a short check-in for the ${data.atRisk} learners below 60% and assign one targeted retry.`);
  if (data.lowConfidence) suggestions.push(`Review the ${data.lowConfidence} low-confidence reflections and clarify the most confusing concept.`);
  if (data.pendingReviews) suggestions.push(`Schedule a review block for ${data.pendingReviews} pending practice cards; start with repeated misses.`);
  if (data.lessonsWithGaps) suggestions.push(`Add a worked example to ${data.lessonsWithGaps} lessons with reported knowledge gaps.`);
  if (data.advanced) suggestions.push(`Offer an extension task for the ${data.advanced} learners scoring at least 80%.`);
  if (!suggestions.length) suggestions.push("Collect a quick diagnostic and one confidence reflection before changing the lesson plan.");
  return suggestions;
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const rate = await enforceRateLimit({ request, scope: "ai_analytics", limit: 30, windowSeconds: 900, userId: user.id });
    if (!rate.allowed) return NextResponse.json({ error: "Too many analytics requests. Try again shortly." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
    const aggregate = aggregateAnalytics(await request.json());
    const rules = ruleBasedSuggestions(aggregate);
    try {
      const raw = await generateAIChat({
        feature: "analytics",
        userId: user.id,
        jsonMode: true,
        maxTokens: 500,
        temperature: 0.35,
        messages: [
          { role: "system", content: "You are a learning coach. Use only the anonymous aggregate counts. Return a JSON object with a suggestions array of up to three concise actions. Do not invent student details." },
          { role: "user", content: JSON.stringify({ aggregate, existingRules: rules }) },
        ],
      });
      const response = parseJsonResponse<{ suggestions?: unknown }>(raw);
      const ai = Array.isArray(response.suggestions) ? response.suggestions.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 3) : [];
      return NextResponse.json({ suggestions: [...rules, ...ai].slice(0, 5), source: "ai" });
    } catch {
      return NextResponse.json({ suggestions: rules, source: "local" });
    }
  } catch (error) {
    console.error("[analytics]", error);
    return NextResponse.json({ error: "Analytics suggestions could not be prepared." }, { status: 500 });
  }
}
