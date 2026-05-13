import { NextRequest, NextResponse } from "next/server";
import { generateAIChat } from "@/lib/ai/chat";
import { getAuthenticatedUser } from "@/lib/auth";
import { loadAiUserContext } from "@/lib/ai/personalization";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const preferredRegion = ["hkg1", "sin1"];

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

    const { studentStats, lessonStats } = await request.json();
    const aiContext = await loadAiUserContext(user.id);

    const atRisk = (studentStats || []).filter(
      (s: any) => (s.avgScore ?? 0) < 60,
    );
    const advanced = (studentStats || []).filter(
      (s: any) => (s.avgScore ?? 0) >= 80,
    );
    const reflectionsLogged = (studentStats || []).reduce(
      (sum: number, s: any) => sum + (s.reflectionCount || 0),
      0,
    );
    const lowConfidenceReflections = (studentStats || []).reduce(
      (sum: number, s: any) => sum + (s.lowConfidenceReflections || 0),
      0,
    );
    const gaps = (lessonStats || []).flatMap((l: any) => l.knowledgeGaps || []);
    const uniqueGaps = Array.from(new Set(gaps as string[]));

    const context = `
Class data:
- Teacher profile:
${aiContext.prompt}

- Total students: ${(studentStats || []).length}
- At risk (below 60%): ${atRisk.length} - names: ${atRisk.map((s: any) => s.name).join(", ") || "none"}
- Advanced (80%+): ${advanced.length}
- Reflection entries logged: ${reflectionsLogged}
- Low-confidence reflections (1-2/5): ${lowConfidenceReflections}
- Common knowledge gaps: ${uniqueGaps.slice(0, 6).join(", ") || "none identified yet"}
- Avg class score: ${
      (studentStats || []).filter((s: any) => s.avgScore !== null).length > 0
        ? Math.round(
            (studentStats || [])
              .filter((s: any) => s.avgScore !== null)
              .reduce((a: number, s: any) => a + s.avgScore, 0) /
              (studentStats || []).filter((s: any) => s.avgScore !== null)
                .length,
          )
        : "N/A"
    }%
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
