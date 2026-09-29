import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { loadAiUserContext } from "@/lib/ai/personalization";
import { generateAIChat } from "@/lib/ai/chat";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const preferredRegion = ["hkg1", "sin1"];

type HistoryMsg = {
  role: string;
  content: string;
};

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rate = await enforceRateLimit({
      request,
      scope: "ai_socratic",
      limit: 80,
      windowSeconds: 900,
      userId: user.id,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        {
          hint: "I need a short pause before answering more questions. Try again in a moment.",
        },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
      );
    }

    const {
      question,
      lessonTitle,
      lessonObjectives,
      currentSection,
      conversationHistory = [],
    } = await request.json();

    if (typeof question !== "string" || !question.trim()) {
      return NextResponse.json({ error: "A question is required." }, { status: 400 });
    }

    const objectivesList = Array.isArray(lessonObjectives)
      ? lessonObjectives.join(", ")
      : (lessonObjectives ?? "Not specified");
    const aiContext = await loadAiUserContext(user.id);

    const systemPrompt = `You are Socrates, an AI tutor in the EdSync adaptive learning platform.

Your main rule: never directly give away answers. Guide students toward discovery through strategic questions and hints.

LESSON CONTEXT:
- Lesson: "${lessonTitle ?? "Unknown"}"
- Current section: "${currentSection ?? "Unknown"}"
- Objectives: ${objectivesList}

STUDENT CONTEXT:
${aiContext.prompt}

TECHNIQUES:
1. Ask what they already know.
2. Break the problem into a smaller first step.
3. Use an analogy from everyday life or the student's interests.
4. Guide by contrast or contradiction.
5. Connect to prior knowledge.
6. Ask them to visualize a real-world situation.

HARD RULES:
- Keep your response to 3-5 sentences.
- End with exactly one question.
- Do not say "The answer is..." or directly solve quiz questions.
- Do not write formulas, full solutions, or definitions unless the student is asking about meaning and still needs a hint.
- Match the student's grade, interests, and preferred detail level when possible.
- Be warm, patient, and concise.`;

    const history = (conversationHistory as HistoryMsg[])
      .slice(-8)
      .map((message) => ({
        role: (message.role === "assistant" ? "assistant" : "user") as
          | "user"
          | "assistant",
        content: typeof message.content === "string" ? message.content.slice(0, 1200) : "",
      }));

    const hint = await generateAIChat({
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: question },
      ],
      maxTokens: 250,
      temperature: 0.75,
      userId: user.id,
      feature: "socratic",
    });

    if (!hint.trim()) return NextResponse.json({ error: "Socratic help is unavailable right now. Please try again." }, { status: 502 });

    return NextResponse.json({ hint });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[socratic]", msg);
    return NextResponse.json({ error: "Socratic help is unavailable right now. Please try again." }, { status: 502 });
  }
}
