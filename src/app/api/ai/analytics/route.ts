import { NextRequest, NextResponse } from "next/server";
import { generateAIChat } from "@/lib/ai/chat";
import { getAuthenticatedUser } from "@/lib/auth";
import { loadAiUserContext } from "@/lib/ai/personalization";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const preferredRegion = ["hkg1", "sin1"];

type AnalyticsStudentStat = {
  name: string;
  avgScore: number | null;
  reflectionCount: number;
  lowConfidenceReflections: number;
};

type AnalyticsLessonStat = {
  knowledgeGaps: string[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeStudentStat(value: unknown): AnalyticsStudentStat {
  const row = asRecord(value);
  const score = row.avgScore;
  return {
    name: typeof row.name === "string" && row.name.trim() ? row.name.trim() : "Unknown",
    avgScore: typeof score === "number" && Number.isFinite(score) ? score : null,
    reflectionCount:
      typeof row.reflectionCount === "number" && Number.isFinite(row.reflectionCount)
        ? Math.max(0, row.reflectionCount)
        : 0,
    lowConfidenceReflections:
      typeof row.lowConfidenceReflections === "number" &&
      Number.isFinite(row.lowConfidenceReflections)
        ? Math.max(0, row.lowConfidenceReflections)
        : 0,
  };
}

function normalizeLessonStat(value: unknown): AnalyticsLessonStat {
  const row = asRecord(value);
  return {
    knowledgeGaps: Array.isArray(row.knowledgeGaps)
      ? row.knowledgeGaps.filter(
          (gap): gap is string => typeof gap === "string" && gap.trim().length > 0,
        )
      : [],
  };
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ suggestions: ["Unauthorized"] }, { status: 401 });
    }

    const rate = await enforceRateLimit({
      request,
      scope: "ai_analytics",
      limit: 30,
      windowSeconds: 900,
      userId: user.id,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { suggestions: ["Too many analytics requests. Try again shortly."] },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
      );
    }

    const payload = asRecord(await request.json());
    const studentStats = Array.isArray(payload.studentStats)
      ? payload.studentStats.map(normalizeStudentStat)
      : [];
    const lessonStats = Array.isArray(payload.lessonStats)
      ? payload.lessonStats.map(normalizeLessonStat)
      : [];
    const aiContext = await loadAiUserContext(user.id);

    const atRisk = studentStats.filter((student) => (student.avgScore ?? 0) < 60);
    const advanced = studentStats.filter((student) => (student.avgScore ?? 0) >= 80);
    const reflectionsLogged = studentStats.reduce(
      (sum, student) => sum + student.reflectionCount,
      0,
    );
    const lowConfidenceReflections = studentStats.reduce(
      (sum, student) => sum + student.lowConfidenceReflections,
      0,
    );
    const uniqueGaps = Array.from(
      new Set(lessonStats.flatMap((lesson) => lesson.knowledgeGaps)),
    );
    const scoredStudents = studentStats.filter((student) => student.avgScore !== null);
    const classAverage =
      scoredStudents.length > 0
        ? Math.round(
            scoredStudents.reduce((sum, student) => sum + (student.avgScore || 0), 0) /
              scoredStudents.length,
          )
        : "N/A";

    const context = `
Class data:
- Teacher profile:
${aiContext.prompt}

- Total students: ${studentStats.length}
- At risk (below 60%): ${atRisk.length} - names: ${atRisk.map((student) => student.name).join(", ") || "none"}
- Advanced (80%+): ${advanced.length}
- Reflection entries logged: ${reflectionsLogged}
- Low-confidence reflections (1-2/5): ${lowConfidenceReflections}
- Common knowledge gaps: ${uniqueGaps.slice(0, 6).join(", ") || "none identified yet"}
- Avg class score: ${classAverage}%
`;

    const raw = await generateAIChat({
      messages: [
        {
          role: "system",
          content:
            "You are an expert EdSync instructional coach. Give specific, actionable intervention suggestions for a teacher. Personalize recommendations to the teacher profile, grade level, subjects, and class evidence. Reply ONLY with a JSON array of 5 suggestion strings. No markdown, no preamble.",
        },
        {
          role: "user",
          content: `Based on this class data, provide 5 specific intervention suggestions:\n${context}\nReply ONLY with: ["suggestion 1", "suggestion 2", "suggestion 3", "suggestion 4", "suggestion 5"]`,
        },
      ],
      maxTokens: 500,
      temperature: 0.6,
    });

    let suggestions: string[];
    try {
      const clean = raw
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/i, "");
      const start = clean.indexOf("[");
      const end = clean.lastIndexOf("]");
      suggestions =
        start !== -1 && end !== -1
          ? JSON.parse(clean.slice(start, end + 1))
          : [clean];
    } catch {
      suggestions = [raw.trim()];
    }

    return NextResponse.json({ suggestions });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      suggestions: [`Could not generate suggestions: ${msg}`],
    });
  }
}
