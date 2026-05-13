import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { loadAiUserContext } from "@/lib/ai/personalization";
import { openRouterChat } from "@/lib/openrouter";

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

    const {
      question,
      lessonTitle,
      lessonObjectives,
      currentSection,
      conversationHistory = [],
    } = await request.json();

    if (!question?.trim()) {
      return NextResponse.json({
        hint: "What would you like help thinking through?",
      });
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
        content: message.content,
      }));

    const hint = await openRouterChat({
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: question },
      ],
      maxTokens: 250,
      temperature: 0.75,
    });

    return NextResponse.json({ hint });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[socratic]", msg);
    return NextResponse.json({
      hint: "That's a great question to sit with. What part feels most confusing right now, and what do you already understand about it?",
    });
  }
}
