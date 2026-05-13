import { NextRequest, NextResponse } from "next/server";
import { generateAIChat, parseJsonResponse } from "@/lib/ai/chat";
import type { AILessonDraft } from "@/types";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  buildGenerationStylePrompt,
  loadAiUserContext,
  type GenerationStyle,
} from "@/lib/ai/personalization";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const preferredRegion = ["hkg1", "sin1"];

const MAX_SOURCE_CHARS = 5000;

const FIXED_LESSON_SYSTEM_PROMPT = `You are EdSync AI, an expert educational content designer.
Return ONLY one valid JSON object with the exact schema below. Do not use markdown, code fences, preamble, or trailing text.

Schema:
{
 "title": string,
 "description": string,
 "objectives": string[],
 "estimated_duration": number,
 "prerequisites": string[],
 "tags": string[],
 "sections": [{"title": string, "content": string, "content_type": "text"|"activity", "duration_minutes": number}],
 "quiz_questions": [{"question_text": string, "question_type": "multiple_choice", "options": [{"id": "a"|"b"|"c"|"d", "text": string, "is_correct": boolean}], "correct_answer": "a"|"b"|"c"|"d", "explanation": string, "difficulty": "beginner"|"intermediate"|"advanced", "is_diagnostic": boolean, "is_micro_check": boolean, "is_final_quiz": boolean}],
 "glossary_terms": [{"term": string, "definition": string, "example": string}]
}

Hard constraints:
- Use real topic-specific content only.
- objectives: exactly 3 items.
- sections: exactly 5 items.
- quiz_questions: exactly 6 questions, each with options a-d and exactly one correct answer.
- quiz flags by order: q1-q2 diagnostic, q3 micro-check, q4-q6 final quiz.
- glossary_terms: exactly 5 items.

Instructional style (for regular non-visual LLM output):
- Each section content must be illustrative, not only descriptive.
- In every section content, include these labeled parts in order: Core idea, Analogy, Worked example, Why it matters, Quick check.
- You may structure section content with simple HTML (p, strong, em, ul, ol, li, blockquote, code, pre, hr, table, thead, tbody, tr, th, td) when it improves clarity.
- Never include script/style tags, event handlers, or markdown code fences.

Length constraints to avoid truncation:
- description: 1-2 sentences.
- section content: 70-130 words each.
- quiz explanation: 1 sentence each that clearly states why the correct answer is correct.`;

function shouldRetryForTruncation(error: unknown) {
  const msg = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    msg.includes("empty response") ||
    msg.includes("finish_reason: length") ||
    msg.includes("context length") ||
    msg.includes("maximum context")
  );
}

function buildLessonUserPrompt({
  mode,
  safeContent,
  complexityDesc,
  pacingDesc,
  scaffoldingDesc,
  wasTruncated,
  profilePrompt,
  stylePrompt,
  versionInstruction,
}: {
  mode: string;
  safeContent: string;
  complexityDesc: string;
  pacingDesc: string;
  scaffoldingDesc: string;
  wasTruncated: boolean;
  profilePrompt: string;
  stylePrompt: string;
  versionInstruction?: string;
}) {
  const sourceType =
    mode === "url" ? "url" : mode === "text" ? "text" : "objectives";
  const truncationNote = wasTruncated
    ? "Note: source input was truncated to stay within model limits. Prioritize the most central concepts."
    : "";

  return `Generate a complete lesson from the user input below.

Settings:
- Complexity: ${complexityDesc}
- Pacing: ${pacingDesc}
- Scaffolding: ${scaffoldingDesc}
- Output style: illustrative teaching with analogies, worked examples, and quick checks using text/HTML only.

Personalization:
${profilePrompt}

Generation style:
${stylePrompt}
${versionInstruction ? `\nVersion focus:\n${versionInstruction}` : ""}

Input type: ${sourceType}
Source input:
${safeContent}

${truncationNote}`.trim();
}

type FallbackLessonDraft = Omit<AILessonDraft, "quiz_questions"> & {
  quiz_questions: (AILessonDraft["quiz_questions"][number] & {
    correct_answer: "a" | "b" | "c" | "d";
  })[];
};

function truncateSourceInput(source: string, maxChars = MAX_SOURCE_CHARS) {
  if (source.length <= maxChars) {
    return { text: source, wasTruncated: false };
  }

  return {
    text: `${source.slice(0, maxChars)}\n\n[Input truncated to stay within model limits.]`,
    wasTruncated: true,
  };
}

function deriveTopicLabel(content: string) {
  const firstLine = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) return "the requested topic";

  const normalized = firstLine.replace(/^[-*\d.)\s]+/, "").trim();
  if (!normalized) return "the requested topic";

  const words = normalized.split(/\s+/).slice(0, 10).join(" ");
  return words.length > 80 ? `${words.slice(0, 80).trim()}...` : words;
}

function buildLocalFallbackLesson(topic: string): FallbackLessonDraft {
  return {
    title: `Intro to ${topic}`,
    description:
      "This starter lesson was generated locally because the AI provider returned an incomplete response. You can edit and expand each section before publishing.",
    objectives: [
      `Identify the core ideas in ${topic}.`,
      `Explain ${topic} using clear examples.`,
      `Apply ${topic} in a simple scenario.`,
    ],
    estimated_duration: 45,
    prerequisites: [
      "Basic background knowledge",
      "Willingness to explore examples",
    ],
    tags: ["starter", "ai-fallback", "editable"],
    sections: [
      {
        title: "Introduction",
        content: `Introduce ${topic} with a relatable real-world context. Clarify why it matters and what students should focus on first.`,
        content_type: "text",
        duration_minutes: 8,
      },
      {
        title: "Core Concept 1",
        content: `Define the first key idea in ${topic}. Include one clear example and one common misconception to address.`,
        content_type: "text",
        duration_minutes: 9,
      },
      {
        title: "Core Concept 2",
        content: `Build on the first concept with a second related idea. Compare and contrast when appropriate.`,
        content_type: "text",
        duration_minutes: 9,
      },
      {
        title: "Guided Practice",
        content: `Walk through a short practice activity where students apply ${topic} step by step.`,
        content_type: "activity",
        duration_minutes: 11,
      },
      {
        title: "Summary and Reflection",
        content:
          "Summarize the key points and include reflection prompts students can answer to self-check understanding.",
        content_type: "text",
        duration_minutes: 8,
      },
    ],
    quiz_questions: [
      {
        question_text: `Diagnostic: What best describes ${topic}?`,
        question_type: "multiple_choice",
        options: [
          { id: "a", text: "An unrelated idea", is_correct: false },
          { id: "b", text: `A core definition of ${topic}`, is_correct: true },
          { id: "c", text: "A common misconception", is_correct: false },
          { id: "d", text: "A partially correct statement", is_correct: false },
        ],
        correct_answer: "b",
        explanation:
          "The correct answer provides the most accurate foundational definition.",
        difficulty: "beginner",
        is_diagnostic: true,
        is_micro_check: false,
        is_final_quiz: false,
      },
      {
        question_text: `Diagnostic: Which statement about ${topic} is accurate?`,
        question_type: "multiple_choice",
        options: [
          { id: "a", text: "Accurate statement", is_correct: true },
          { id: "b", text: "Incorrect statement", is_correct: false },
          { id: "c", text: "Incorrect statement", is_correct: false },
          { id: "d", text: "Incorrect statement", is_correct: false },
        ],
        correct_answer: "a",
        explanation:
          "The correct option aligns with the concept introduced in the lesson.",
        difficulty: "beginner",
        is_diagnostic: true,
        is_micro_check: false,
        is_final_quiz: false,
      },
      {
        question_text:
          "Quick Check: Which option best applies the concept from section 2?",
        question_type: "multiple_choice",
        options: [
          { id: "a", text: "Incorrect application", is_correct: false },
          { id: "b", text: "Incorrect application", is_correct: false },
          { id: "c", text: "Correct application", is_correct: true },
          { id: "d", text: "Incorrect application", is_correct: false },
        ],
        correct_answer: "c",
        explanation: "This option correctly applies the concept in context.",
        difficulty: "intermediate",
        is_diagnostic: false,
        is_micro_check: true,
        is_final_quiz: false,
      },
      {
        question_text: "Final: Which choice demonstrates solid understanding?",
        question_type: "multiple_choice",
        options: [
          { id: "a", text: "Correct synthesis answer", is_correct: true },
          { id: "b", text: "Plausible but incomplete", is_correct: false },
          { id: "c", text: "Common error", is_correct: false },
          { id: "d", text: "Incorrect", is_correct: false },
        ],
        correct_answer: "a",
        explanation:
          "The correct response shows understanding of both key concepts.",
        difficulty: "intermediate",
        is_diagnostic: false,
        is_micro_check: false,
        is_final_quiz: true,
      },
      {
        question_text:
          "Final: Which action is the best next step in a realistic scenario?",
        question_type: "multiple_choice",
        options: [
          { id: "a", text: "Ineffective action", is_correct: false },
          { id: "b", text: "Effective action", is_correct: true },
          { id: "c", text: "Partially effective action", is_correct: false },
          { id: "d", text: "Incorrect action", is_correct: false },
        ],
        correct_answer: "b",
        explanation: "The correct action applies the lesson method correctly.",
        difficulty: "intermediate",
        is_diagnostic: false,
        is_micro_check: false,
        is_final_quiz: true,
      },
      {
        question_text: "Final: Which option reflects advanced understanding?",
        question_type: "multiple_choice",
        options: [
          { id: "a", text: "Too simplistic", is_correct: false },
          { id: "b", text: "Partly correct", is_correct: false },
          { id: "c", text: "Common misconception", is_correct: false },
          { id: "d", text: "Advanced and correct", is_correct: true },
        ],
        correct_answer: "d",
        explanation: "This option demonstrates deeper transfer and reasoning.",
        difficulty: "advanced",
        is_diagnostic: false,
        is_micro_check: false,
        is_final_quiz: true,
      },
    ],
    glossary_terms: [
      {
        term: "Core idea",
        definition: "A central concept learners must understand.",
        example: "Students explain the core idea in their own words.",
      },
      {
        term: "Application",
        definition: "Using a concept in a practical situation.",
        example: "Students apply the concept in a case study.",
      },
      {
        term: "Misconception",
        definition: "A common but incorrect understanding.",
        example: "The class discusses a misconception and corrects it.",
      },
      {
        term: "Scaffold",
        definition: "Support that helps learners complete complex tasks.",
        example: "A guided checklist acts as a scaffold.",
      },
      {
        term: "Reflection",
        definition: "Thinking about what was learned and why it matters.",
        example: "Students write a short reflection at the end.",
      },
    ],
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
      scope: "ai_create_lesson",
      limit: 20,
      windowSeconds: 900,
      userId: user.id,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many lesson generation requests. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
      );
    }

    const {
      mode,
      content,
      complexity = 50,
      pacing = 50,
      scaffolding = 50,
      depth = "standard",
      languageStyle = "student_friendly",
      versionCount = 1,
      audienceLanguage = "English",
    } = await request.json();

    const normalizedContent = typeof content === "string" ? content.trim() : "";

    if (!normalizedContent) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 },
      );
    }

    const sourceCap = mode === "url" ? 800 : MAX_SOURCE_CHARS;
    const { text: safeContent, wasTruncated } = truncateSourceInput(
      normalizedContent,
      sourceCap,
    );

    const complexityDesc =
      complexity < 33
        ? "basic and accessible for all learners"
        : complexity < 66
          ? "intermediate and grade-appropriate"
          : "advanced and challenging";

    const pacingDesc =
      pacing < 33
        ? "thorough and slow-paced with extensive explanation"
        : pacing < 66
          ? "moderate, balanced pacing"
          : "brisk pacing for engaged learners";

    const scaffoldingDesc =
      scaffolding < 33
        ? "heavily scaffolded with step-by-step guidance"
        : scaffolding < 66
          ? "moderate scaffolding with some independence"
          : "minimal scaffolding for independent learners";

    const aiContext = await loadAiUserContext(user.id);
    const generationStyle: GenerationStyle = {
      depth,
      languageStyle,
      versionCount,
      audienceLanguage,
    };
    const stylePrompt = buildGenerationStylePrompt(generationStyle);
    const requestedVersions = Math.min(3, Math.max(1, Number(versionCount || 1)));

    const makeUserPrompt = (versionInstruction?: string) =>
      buildLessonUserPrompt({
        mode,
        safeContent,
        complexityDesc,
        pacingDesc,
        scaffoldingDesc,
        wasTruncated,
        profilePrompt: aiContext.prompt,
        stylePrompt,
        versionInstruction,
      });

    const userPrompt = makeUserPrompt(
      requestedVersions > 1
        ? "Version 1: balanced classroom-ready version with the clearest progression."
        : undefined,
    );

    const buildMessages = (extraInstruction?: string) => [
      { role: "system" as const, content: FIXED_LESSON_SYSTEM_PROMPT },
      {
        role: "user" as const,
        content: extraInstruction
          ? `${userPrompt}\n\n${extraInstruction}`
          : userPrompt,
      },
    ];

    const generateRawLesson = async (prompt: string, extraInstruction?: string) =>
      generateAIChat({
        messages: [
          { role: "system" as const, content: FIXED_LESSON_SYSTEM_PROMPT },
          {
            role: "user" as const,
            content: extraInstruction ? `${prompt}\n\n${extraInstruction}` : prompt,
          },
        ],
        maxTokens: 2200,
        temperature: 0.2,
      });

    let raw: string;
    try {
      raw = await generateRawLesson(userPrompt);
    } catch (generationError) {
      if (!shouldRetryForTruncation(generationError)) throw generationError;

      try {
        raw = await generateRawLesson(
          userPrompt,
            "Retry in compact mode. Keep each section concise but preserve labeled parts (Core idea, Analogy, Worked example, Why it matters, Quick check) and keep quiz explanations short while preserving schema and counts.",
        );
      } catch (compactGenerationError) {
        if (!shouldRetryForTruncation(compactGenerationError)) {
          throw compactGenerationError;
        }

        const fallbackTopic = deriveTopicLabel(normalizedContent);
        const fallbackLesson = buildLocalFallbackLesson(fallbackTopic);

        return NextResponse.json({
          lesson: fallbackLesson,
          warning:
            "AI provider response was truncated. Returned a local starter draft so you can continue without retrying.",
        });
      }
    }

    let lesson;
    try {
      lesson = parseJsonResponse(raw);
    } catch (initialParseError) {
      try {
        const regeneratedRaw = await generateAIChat({
          messages: buildMessages(
            "Your previous output was malformed or incomplete. Regenerate the full JSON from scratch in compact mode, and return only JSON.",
          ),
          maxTokens: 1500,
          temperature: 0,
        });
        lesson = parseJsonResponse(regeneratedRaw);
      } catch (regenerationError) {
        if (shouldRetryForTruncation(regenerationError)) {
          const fallbackTopic = deriveTopicLabel(normalizedContent);
          const fallbackLesson = buildLocalFallbackLesson(fallbackTopic);

          return NextResponse.json({
            lesson: fallbackLesson,
            warning:
              "AI response was repeatedly truncated. Returned a local starter draft so you can continue without retrying.",
          });
        }
      }

      if (!lesson) {
        // Ask the model to repair malformed JSON so generation does not fail on minor syntax issues.
        let repairedRaw: string;
        try {
          repairedRaw = await generateAIChat({
            messages: [
              {
                role: "system",
                content:
                  "You repair malformed JSON. Return ONLY valid JSON with the same schema and content. Do not add markdown fences or any explanation.",
              },
              {
                role: "user",
                content: `Repair this JSON so it is strictly valid (RFC 8259):\n\n${raw}`,
              },
            ],
            maxTokens: 3000,
            temperature: 0,
          });
        } catch (repairError) {
          const repairMsg =
            repairError instanceof Error
              ? repairError.message.toLowerCase()
              : "";

          const shouldUseLocalFallback =
            repairMsg.includes("empty response") ||
            repairMsg.includes("finish_reason: length");

          if (!shouldUseLocalFallback) throw repairError;

          const fallbackTopic = deriveTopicLabel(normalizedContent);
          const fallbackLesson = buildLocalFallbackLesson(fallbackTopic);

          return NextResponse.json({
            lesson: fallbackLesson,
            warning:
              "AI JSON repair was truncated by the provider. Returned a local starter draft so you can continue without retrying.",
          });
        }

        try {
          lesson = parseJsonResponse(repairedRaw);
        } catch {
          // Final attempt: extract just the largest JSON object if extra text was included.
          const match = repairedRaw.match(/\{[\s\S]*\}/);
          if (!match) {
            throw new Error(
              "Model returned malformed JSON and automatic repair failed. Try again with shorter content.",
            );
          }
          try {
            lesson = JSON.parse(match[0]);
          } catch {
            const parseMsg =
              initialParseError instanceof Error
                ? initialParseError.message
                : "Unknown parse error";
            throw new Error(
              `Model returned malformed JSON and automatic repair failed (${parseMsg}). Try again with shorter content.`,
            );
          }
        }
      }
    }

    // Ensure required arrays exist to prevent downstream errors
    if (!lesson.sections) lesson.sections = [];
    if (!lesson.quiz_questions) lesson.quiz_questions = [];
    if (!lesson.glossary_terms) lesson.glossary_terms = [];
    if (!lesson.objectives) lesson.objectives = [];
    if (!lesson.tags) lesson.tags = [];
    if (!lesson.prerequisites) lesson.prerequisites = [];
    if (!lesson.estimated_duration) lesson.estimated_duration = 45;

    const variants: AILessonDraft[] = [lesson];
    if (requestedVersions > 1) {
      const versionPrompts = [
        "Version 2: more scaffolded, conversational, and supportive for learners who need confidence.",
        "Version 3: more advanced, professional, and extension-rich for students ready to stretch.",
      ].slice(0, requestedVersions - 1);

      const generatedVariants = await Promise.all(
        versionPrompts.map(async (instruction) => {
          try {
            const variantRaw = await generateRawLesson(makeUserPrompt(instruction));
            return parseJsonResponse(variantRaw) as AILessonDraft;
          } catch {
            return null;
          }
        }),
      );
      variants.push(
        ...generatedVariants.filter(
          (variant): variant is AILessonDraft => variant !== null,
        ),
      );
    }

    return NextResponse.json({
      lesson,
      variants: variants.map((variant, index) => ({
        ...variant,
        tags: Array.from(new Set([...(variant.tags || []), `version-${index + 1}`])),
      })),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[create-lesson]", msg);
    return NextResponse.json(
      { error: `Failed to generate lesson: ${msg}` },
      { status: 500 },
    );
  }
}
