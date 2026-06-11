import { NextRequest, NextResponse } from "next/server";
import { generateAIChat, parseJsonResponse } from "@/lib/ai/chat";
import type { AILessonDraft } from "@/types";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  buildGenerationStylePrompt,
  loadAiUserContext,
  type GenerationStyle,
} from "@/lib/ai/personalization";
import { buildCreateLessonDesignInstruction } from "@/lib/ai/lesson-design-context";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const preferredRegion = ["hkg1", "sin1"];

const MAX_SOURCE_CHARS = 5000;

type AiLessonSlideType =
  | "title"
  | "objectives"
  | "content"
  | "example"
  | "socratic"
  | "activity"
  | "summary"
  | "assessment";

type AiLessonSlide = {
  slideNumber: number;
  title: string;
  type: AiLessonSlideType;
  onScreenText: string[];
  speakerNotes: string;
  visualSuggestion: string;
  navigation: {
    previous: string | null;
    next: string | null;
  };
};

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

const SLIDE_DECK_SYSTEM_PROMPT = `You are the EdSync AI Lesson Creator Engine, a text-generation model that produces structured, ready-to-render lesson content for an automated slide builder.
Return ONLY a valid JSON array. Do not use markdown, code fences, preamble, comments, or trailing text.

Core defaults unless the user overrides:
- Lesson type: slide deck.
- Complexity: intermediate.
- Include Socratic questioning: yes.
- Include speaker notes: yes.
- Default audience: adult learners.

If the request is ambiguous enough that no topic can be inferred, return:
[{ "clarification": "Please specify the topic, audience, and desired number of slides." }]

Every non-clarification lesson must contain these slide types in order:
1. Title slide: topic, subtitle, audience, estimated time.
2. Learning objectives: 3-5 objectives starting with "By the end...".
3. Key concept slides: concept name, 2-4 full-sentence bullets, and one simple example or analogy.
4. Example / walkthrough: step-by-step demonstration.
5. Socratic questions: at least 2 slides, each with a bold main question, 2-3 follow-up questions, and expected student responses in speaker notes.
6. Interactive activity: a short task or thought exercise.
7. Summary: 3-5 main takeaways.
8. Assessment / exit ticket: 2-3 quick questions with answer key in speaker notes.

EdSync interaction requirements:
- Include at least two concrete learning interaction formats across the deck: discussion, practice activity, matching, poll, reflection, quiz/test, or fill-in-the-blank.
- The activity slide must name its interaction format in onScreenText or speakerNotes.
- The assessment slide must include a clear quick-check format such as multiple choice, short answer, fill-in-the-blank, or exit ticket, with answer key in speakerNotes.
- If the user asks for quiz, tests, discussion, activities, or fill-in-the-blank, make those formats explicit in the relevant slide titles, onScreenText, or speakerNotes.
- Template-ready wording: start activity/assessment lines with one of these labels when applicable: "Discussion:", "Practice activity:", "Matching:", "Poll:", "Reflection:", "Quiz:", "Test:", "Fill-in-the-blank:", or "Exit ticket:".
- visualSuggestion must name the intended layout, for example "discussion board layout", "matching pairs layout", "poll check layout", "practice workshop layout", "fill-in-the-blank ticket layout", or "quiz ticket layout".

Complexity adaptation:
- Beginner: simple language, concrete analogies, everyday examples.
- Intermediate: some technical terms, applied examples, moderate depth.
- Advanced: in-depth analysis, abstract concepts, challenging questions.

Each slide object must use this exact schema:
{
  "slideNumber": number,
  "title": string,
  "type": "title" | "objectives" | "content" | "example" | "socratic" | "activity" | "summary" | "assessment",
  "onScreenText": string[],
  "speakerNotes": string,
  "visualSuggestion": string,
  "navigation": {
    "previous": string | null,
    "next": string | null
  }
}

Critical UI-less environment rules:
- The navigation field is required on every slide.
- The first slide's previous must be null.
- The last slide's next must be null.
- onScreenText must be crisp, scannable, and slide-ready.
- speakerNotes can contain full instructor guidance, anticipated answers, and transition cues.
- visualSuggestion must be concrete and implementable.`;

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
  designInstruction,
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
  designInstruction: string;
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
${designInstruction ? `\n${designInstruction}` : ""}
${versionInstruction ? `\nVersion focus:\n${versionInstruction}` : ""}

Input type: ${sourceType}
Source input:
${safeContent}

${truncationNote}`.trim();
}

function buildSlideDeckUserPrompt({
  mode,
  safeContent,
  complexityDesc,
  wasTruncated,
  profilePrompt,
  stylePrompt,
  designInstruction,
  audienceLanguage,
  slideCount,
}: {
  mode: string;
  safeContent: string;
  complexityDesc: string;
  wasTruncated: boolean;
  profilePrompt: string;
  stylePrompt: string;
  designInstruction: string;
  audienceLanguage: string;
  slideCount: number;
}) {
  const sourceType =
    mode === "url" ? "url" : mode === "text" ? "text" : "objectives";
  const truncationNote = wasTruncated
    ? "Note: source input was truncated to stay within model limits. Prioritize the most central concepts."
    : "";

  return `Generate a complete EdSync slide lesson from the user input below.

Settings:
- Complexity: ${complexityDesc}
- Number of slides: ${slideCount}
- Audience language: ${audienceLanguage}
- Include Socratic questions, speaker notes, visual suggestions, and linear navigation on every slide.
- Include EdSync interaction formats where useful: discussion, practice activity, matching, poll, reflection, quiz/test, and fill-in-the-blank.
- Make every activity and assessment template-ready by using explicit labels such as "Discussion:", "Practice activity:", "Matching:", "Poll:", "Reflection:", "Quiz:", "Test:", "Fill-in-the-blank:", or "Exit ticket:".
- Use visual suggestions that name the Studio layout to render: discussion board, matching pairs, poll check, reflection card, practice workshop, fill-in-the-blank ticket, or quiz ticket.
- Output must be the JSON array only.

Personalization:
${profilePrompt}

Generation style:
${stylePrompt}
${designInstruction ? `\n${designInstruction}` : ""}

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

function parseJsonArrayResponse(raw: string): unknown[] {
  let clean = raw.trim();
  clean = clean.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = clean.indexOf("[");
  const end = clean.lastIndexOf("]");
  if (start !== -1 && end !== -1) {
    clean = clean.slice(start, end + 1);
  }
  const parsed = JSON.parse(clean) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Model returned JSON that was not an array.");
  }
  return parsed;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const lines = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines : fallback;
}

const ACTIVITY_CUE_PATTERN = /\b(discussion|discuss|practice activity|activity|matching|match|poll|vote|reflection|reflect|task)\b/i;
const ASSESSMENT_CUE_PATTERN = /\b(quiz|test|quick check|exit ticket|fill-in-the-blank|fill in the blank|multiple choice|short answer)\b/i;

type RequestedTemplateCue = {
  cue: string;
  pattern: RegExp;
  draft: (topic: string) => Omit<AiLessonSlide, "navigation">;
};

const REQUESTED_TEMPLATE_CUES: RequestedTemplateCue[] = [
  {
    cue: "Discussion:",
    pattern: /\b(discussion|discuss|debate)\b/i,
    draft: (topic) => ({
      slideNumber: 0,
      title: "Discussion: Compare Ideas",
      type: "activity",
      onScreenText: [
        `Discussion: Which idea in ${topic} matters most?`,
        "Use one evidence point.",
        "Name one risk or misconception.",
      ],
      speakerNotes: "Expected responses should cite evidence before opinions. Invite learners to compare reasoning in pairs before sharing.",
      visualSuggestion: "Use a discussion board layout with two response columns and role chips.",
    }),
  },
  {
    cue: "Practice activity:",
    pattern: /\b(practice activity|practice loop|task|workshop)\b/i,
    draft: (topic) => ({
      slideNumber: 0,
      title: "Practice Activity",
      type: "activity",
      onScreenText: [
        `Practice activity: apply ${topic} to one realistic situation.`,
        "Choose a step, make a decision, and check the result.",
        "Record one proof of progress.",
      ],
      speakerNotes: "Give learners a short timed task. Ask them to show the decision they made and the evidence they used to check it.",
      visualSuggestion: "Use a practice workshop layout with task, action, and proof areas.",
    }),
  },
  {
    cue: "Matching:",
    pattern: /\b(matching|match|sort|classification)\b/i,
    draft: (topic) => ({
      slideNumber: 0,
      title: "Matching: Concepts and Evidence",
      type: "activity",
      onScreenText: [
        `Matching: pair each ${topic} concept with the best evidence.`,
        "Explain one match.",
        "Revise one mismatch.",
      ],
      speakerNotes: "Expected responses should connect terms to observable evidence. Let learners correct one mismatch after peer feedback.",
      visualSuggestion: "Use a matching pairs layout with left-side concepts and right-side evidence cards.",
    }),
  },
  {
    cue: "Poll:",
    pattern: /\b(poll|vote|confidence check)\b/i,
    draft: (topic) => ({
      slideNumber: 0,
      title: "Poll: Confidence Check",
      type: "activity",
      onScreenText: [
        `Poll: how confident are you applying ${topic}?`,
        "A: Ready to use it.",
        "B: Need one more example.",
        "C: Still unclear.",
      ],
      speakerNotes: "Use responses to decide whether to continue, reteach with another example, or pair learners for peer explanation.",
      visualSuggestion: "Use a poll check layout with three large answer buttons.",
    }),
  },
  {
    cue: "Reflection:",
    pattern: /\b(reflection|reflect|next steps)\b/i,
    draft: (topic) => ({
      slideNumber: 0,
      title: "Reflection: Proof of Progress",
      type: "activity",
      onScreenText: [
        `Reflection: what changed in your understanding of ${topic}?`,
        "Name one proof of progress.",
        "Choose one next step.",
      ],
      speakerNotes: "Ask learners to write a short reflection. Strong responses name a before/after change and a concrete next action.",
      visualSuggestion: "Use a reflection card layout with progress and next-step sections.",
    }),
  },
  {
    cue: "Quiz:",
    pattern: /\b(quiz|quick check|multiple choice|test)\b/i,
    draft: (topic) => ({
      slideNumber: 0,
      title: "Quiz: Quick Check",
      type: "assessment",
      onScreenText: [
        `Quiz: which choice best applies ${topic}?`,
        "A: A vague explanation.",
        "B: A specific evidence-based answer.",
        "C: An unrelated detail.",
      ],
      speakerNotes: "Answer key: B. The strongest answer applies the idea with specific evidence.",
      visualSuggestion: "Use a quiz ticket layout with answer choices and a compact answer key area.",
    }),
  },
  {
    cue: "Test:",
    pattern: /\b(test|assessment|final check)\b/i,
    draft: (topic) => ({
      slideNumber: 0,
      title: "Test: Final Check",
      type: "assessment",
      onScreenText: [
        `Test: explain ${topic} in one sentence.`,
        "Apply it to one realistic case.",
        "Name the evidence that proves your answer.",
      ],
      speakerNotes: "Answer key: accept accurate definitions, realistic application, and observable evidence. Use this as the final proof check.",
      visualSuggestion: "Use a quiz ticket layout with short-answer rows.",
    }),
  },
  {
    cue: "Fill-in-the-blank:",
    pattern: /\b(fill-in-the-blank|fill in the blank|blank)\b/i,
    draft: (topic) => ({
      slideNumber: 0,
      title: "Fill-in-the-Blank: Key Idea",
      type: "assessment",
      onScreenText: [
        `Fill-in-the-blank: The most important idea in ${topic} is ___.`,
        "Short answer: give one example.",
        "Quick check: name one piece of evidence.",
      ],
      speakerNotes: "Answer key: accept the core concept from the lesson, a relevant example, and observable evidence of progress.",
      visualSuggestion: "Use a fill-in-the-blank ticket layout with blanks and answer-key notes.",
    }),
  },
  {
    cue: "Exit ticket:",
    pattern: /\b(exit ticket|exit check)\b/i,
    draft: (topic) => ({
      slideNumber: 0,
      title: "Exit Ticket",
      type: "assessment",
      onScreenText: [
        `Exit ticket: what is one thing you can now do with ${topic}?`,
        "What is one question you still have?",
        "What evidence proves progress?",
      ],
      speakerNotes: "Answer key: learners should name one skill, one honest question, and one observable proof of learning.",
      visualSuggestion: "Use an exit ticket or quiz ticket layout with three response prompts.",
    }),
  },
];

function slideSearchText(slide: Pick<AiLessonSlide, "title" | "onScreenText" | "speakerNotes" | "visualSuggestion">) {
  return [
    slide.title,
    ...slide.onScreenText,
    slide.speakerNotes,
    slide.visualSuggestion,
  ].join(" ");
}

function extractRequestedTemplateCues(source: string): RequestedTemplateCue[] {
  const match = source.match(/Template-ready labels to use in slide text:\s*([^\n]+)/i);
  if (!match) return [];
  const cueLine = match[1];
  return REQUESTED_TEMPLATE_CUES.filter((definition) => cueLine.toLowerCase().includes(definition.cue.toLowerCase()));
}

function ensureTemplateReadyInteractionCues(slides: AiLessonSlide[]): AiLessonSlide[] {
  return slides.map((slide) => {
    const text = slideSearchText(slide);
    if (slide.type === "activity" && !ACTIVITY_CUE_PATTERN.test(text)) {
      return {
        ...slide,
        title: slide.title.toLowerCase().includes("activity") ? slide.title : `Activity: ${slide.title}`,
        onScreenText: [
          `Practice activity: ${slide.onScreenText[0] ?? slide.title}`,
          ...slide.onScreenText.slice(1),
        ],
        visualSuggestion: slide.visualSuggestion
          ? `${slide.visualSuggestion} Use a practice workshop layout.`
          : "Use a practice workshop layout.",
      };
    }
    if (slide.type === "assessment" && !ASSESSMENT_CUE_PATTERN.test(text)) {
      return {
        ...slide,
        title: slide.title.toLowerCase().includes("ticket") ? slide.title : `Exit Ticket: ${slide.title}`,
        onScreenText: [
          `Quiz: ${slide.onScreenText[0] ?? slide.title}`,
          ...slide.onScreenText.slice(1),
        ],
        speakerNotes: slide.speakerNotes
          ? `${slide.speakerNotes} Include an answer key for every quiz, test, or fill-in-the-blank item.`
          : "Answer key: accept accurate, evidence-based responses.",
        visualSuggestion: slide.visualSuggestion
          ? `${slide.visualSuggestion} Use a quiz ticket layout.`
          : "Use a quiz ticket layout.",
      };
    }
    return slide;
  });
}

function renumberSlides(slides: Omit<AiLessonSlide, "navigation">[]): Omit<AiLessonSlide, "navigation">[] {
  return slides.map((slide, index) => ({ ...slide, slideNumber: index + 1 }));
}

function withoutNavigation(slide: AiLessonSlide): Omit<AiLessonSlide, "navigation"> {
  return {
    slideNumber: slide.slideNumber,
    title: slide.title,
    type: slide.type,
    onScreenText: slide.onScreenText,
    speakerNotes: slide.speakerNotes,
    visualSuggestion: slide.visualSuggestion,
  };
}

function ensureRequestedTemplateCueSlides(
  slides: AiLessonSlide[],
  requestedCues: RequestedTemplateCue[],
  topic: string,
): AiLessonSlide[] {
  if (requestedCues.length === 0) return slides;

  const nextSlides: Omit<AiLessonSlide, "navigation">[] = slides.map(withoutNavigation);
  requestedCues.forEach((cue) => {
    const hasCue = nextSlides.some((slide) => cue.pattern.test(slideSearchText({
      title: slide.title,
      onScreenText: slide.onScreenText,
      speakerNotes: slide.speakerNotes,
      visualSuggestion: slide.visualSuggestion,
    })));
    if (hasCue) return;

    const draftSlide = cue.draft(topic);
    const firstAssessmentIndex = nextSlides.findIndex((slide) => slide.type === "assessment");
    const firstSummaryIndex = nextSlides.findIndex((slide) => slide.type === "summary");
    const insertIndex = draftSlide.type === "assessment"
      ? firstAssessmentIndex === -1 ? nextSlides.length : firstAssessmentIndex
      : firstSummaryIndex === -1
        ? firstAssessmentIndex === -1 ? nextSlides.length : firstAssessmentIndex
        : firstSummaryIndex;
    nextSlides.splice(insertIndex, 0, draftSlide);
  });

  return ensureTemplateReadyInteractionCues(withLinearNavigation(renumberSlides(nextSlides)));
}

function normalizeSlideType(value: unknown, index: number): AiLessonSlideType {
  const allowed = new Set<AiLessonSlideType>([
    "title",
    "objectives",
    "content",
    "example",
    "socratic",
    "activity",
    "summary",
    "assessment",
  ]);
  if (typeof value === "string" && allowed.has(value as AiLessonSlideType)) {
    return value as AiLessonSlideType;
  }
  if (index === 0) return "title";
  if (index === 1) return "objectives";
  return "content";
}

function withLinearNavigation(slides: Omit<AiLessonSlide, "navigation">[]): AiLessonSlide[] {
  return slides.map((slide, index) => ({
    ...slide,
    navigation: {
      previous: index === 0 ? null : slides[index - 1].title,
      next: index === slides.length - 1 ? null : slides[index + 1].title,
    },
  }));
}

function extractSlideDeckClarification(rawSlides: unknown[]) {
  if (rawSlides.length !== 1) return null;
  const item = asRecord(rawSlides[0]);
  const clarification = item.clarification;
  return typeof clarification === "string" && clarification.trim()
    ? clarification.trim()
    : null;
}

function normalizeSlideDeck(rawSlides: unknown[], topic: string): AiLessonSlide[] {
  const slides = rawSlides
    .map((value, index) => {
      const item = asRecord(value);
      if ("clarification" in item) {
        throw new Error(String(item.clarification || "Lesson request needs clarification."));
      }
      const title = typeof item.title === "string" && item.title.trim()
        ? item.title.trim()
        : index === 0
          ? topic
          : `Slide ${index + 1}`;
      return {
        slideNumber: index + 1,
        title,
        type: normalizeSlideType(item.type, index),
        onScreenText: asStringArray(item.onScreenText, [title]),
        speakerNotes: typeof item.speakerNotes === "string" ? item.speakerNotes.trim() : "",
        visualSuggestion: typeof item.visualSuggestion === "string" ? item.visualSuggestion.trim() : "Use a clean EdSync layout with one visual focus.",
      };
    })
    .filter((slide) => slide.title && slide.onScreenText.length > 0);

  if (slides.length < 8) {
    throw new Error("Model returned too few slides for the required lesson flow.");
  }

  return ensureTemplateReadyInteractionCues(withLinearNavigation(slides));
}

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
        example: "Learners explain the core idea in their own words.",
      },
      {
        term: "Application",
        definition: "Using a concept in a practical situation.",
        example: "Learners apply the concept in a case study.",
      },
      {
        term: "Misconception",
        definition: "A common but incorrect understanding.",
        example: "The group discusses a misconception and corrects it.",
      },
      {
        term: "Scaffold",
        definition: "Support that helps learners complete complex tasks.",
        example: "A guided checklist acts as a scaffold.",
      },
      {
        term: "Reflection",
        definition: "Thinking about what was learned and why it matters.",
        example: "Learners write a short reflection at the end.",
      },
    ],
  };
}

function buildLocalFallbackSlideDeck(topic: string, requestedSlides: number): AiLessonSlide[] {
  const slideCount = Math.max(10, requestedSlides);
  const baseSlides: Omit<AiLessonSlide, "navigation">[] = [
    {
      slideNumber: 1,
      title: topic,
      type: "title",
      onScreenText: [
        topic,
        "A practical EdSync lesson for adult learners.",
        "Estimated time: 45 minutes.",
      ],
      speakerNotes: "Welcome learners, connect the topic to their goals, and preview the lesson flow.",
      visualSuggestion: "Use a clear title layout with one course-relevant image or icon.",
    },
    {
      slideNumber: 2,
      title: "Learning Objectives",
      type: "objectives",
      onScreenText: [
        `By the end, learners can explain the core idea of ${topic}.`,
        `By the end, learners can apply ${topic} to a realistic scenario.`,
        `By the end, learners can evaluate their progress with a quick check.`,
      ],
      speakerNotes: "Read the objectives and ask learners which objective feels most useful to them.",
      visualSuggestion: "Use three compact objective cards with check icons.",
    },
    {
      slideNumber: 3,
      title: "Key Concept: Foundation",
      type: "content",
      onScreenText: [
        `${topic} starts with one clear foundation.`,
        "A strong definition makes later practice easier.",
        "Example: treat the first idea as the anchor for every task that follows.",
      ],
      speakerNotes: "Explain the foundation in plain language. Ask learners to restate it in their own words.",
      visualSuggestion: "Use an anchor or foundation diagram.",
    },
    {
      slideNumber: 4,
      title: "Key Concept: Application",
      type: "content",
      onScreenText: [
        "Application means using the idea in context.",
        "Good practice includes a decision, action, and feedback.",
        "Analogy: like learning a route by walking it, not only reading the map.",
      ],
      speakerNotes: "Move from definition to action. Ask learners where they might use this idea this week.",
      visualSuggestion: "Use a simple map or workflow visual.",
    },
    {
      slideNumber: 5,
      title: "Walkthrough",
      type: "example",
      onScreenText: [
        "Step 1: Identify the situation.",
        "Step 2: Choose the relevant concept.",
        "Step 3: Apply it and check the result.",
      ],
      speakerNotes: "Model one worked example aloud, then pause after each step for learner predictions.",
      visualSuggestion: "Use a three-step horizontal process.",
    },
    {
      slideNumber: 6,
      title: "Socratic: What Changes First?",
      type: "socratic",
      onScreenText: [
        "**What changes first when we apply this idea?**",
        "What evidence would show progress?",
        "What would make the first attempt fail?",
      ],
      speakerNotes: "Expected responses: learners name a concrete action, a visible result, and one risk or misconception.",
      visualSuggestion: "Use a question bubble and evidence icon.",
    },
    {
      slideNumber: 7,
      title: "Socratic: Why This Approach?",
      type: "socratic",
      onScreenText: [
        "**Why is this approach better than guessing?**",
        "What assumption are we making?",
        "How could we test that assumption?",
      ],
      speakerNotes: "Expected responses: learners compare structured reasoning with guessing and propose a small test.",
      visualSuggestion: "Use a split comparison: guessing versus structured check.",
    },
    {
      slideNumber: 8,
      title: "Interactive Activity",
      type: "activity",
      onScreenText: [
        "Practice activity: choose one real scenario.",
        "Apply the three-step walkthrough.",
        "Discuss one decision and one piece of evidence with a partner.",
      ],
      speakerNotes: "Give learners 5-7 minutes. Invite pairs to compare decisions before sharing. Optional variation: turn this into a poll or matching task.",
      visualSuggestion: "Use a worksheet-style practice and discussion panel.",
    },
    {
      slideNumber: 9,
      title: "Summary",
      type: "summary",
      onScreenText: [
        "Start with a clear foundation.",
        "Apply the idea in context.",
        "Use evidence to check progress.",
      ],
      speakerNotes: "Summarize the lesson and connect each takeaway back to the objectives.",
      visualSuggestion: "Use three takeaway cards.",
    },
    {
      slideNumber: 10,
      title: "Exit Ticket",
      type: "assessment",
      onScreenText: [
        `Fill-in-the-blank: The core idea of ${topic} is ___.`,
        "Short answer: How would you apply it in one real situation?",
        "Quick check: What evidence would prove progress?",
      ],
      speakerNotes: "Answer key: accurate definition, realistic application, and observable evidence of progress. Accept equivalent wording for the fill-in-the-blank item.",
      visualSuggestion: "Use a compact fill-in-the-blank quiz or exit ticket layout.",
    },
  ];

  while (baseSlides.length < slideCount) {
    const nextNumber = baseSlides.length + 1;
    baseSlides.splice(baseSlides.length - 3, 0, {
      slideNumber: nextNumber,
      title: `Key Concept ${nextNumber - 2}`,
      type: "content",
      onScreenText: [
        `Extend ${topic} with one additional practical idea.`,
        "Connect the idea to a concrete learner task.",
        "Use a quick example before moving on.",
      ],
      speakerNotes: "Use this extension only if the class is ready for more depth.",
      visualSuggestion: "Use a small concept card with a practice prompt.",
    });
  }

  return withLinearNavigation(
    baseSlides.map((slide, index) => ({ ...slide, slideNumber: index + 1 })),
  );
}

function slideDeckToLessonDraft(slides: AiLessonSlide[], topic: string): FallbackLessonDraft {
  const fallback = buildLocalFallbackLesson(topic);
  const titleSlide = slides[0];
  const objectiveSlide = slides.find((slide) => slide.type === "objectives");
  const objectives = objectiveSlide?.onScreenText.filter((line) => line.toLowerCase().startsWith("by the end"));

  return {
    ...fallback,
    title: titleSlide?.title || fallback.title,
    description: titleSlide?.onScreenText.slice(1).join(" ") || fallback.description,
    objectives: objectives?.length ? objectives : fallback.objectives,
    estimated_duration: Math.max(30, slides.length * 5),
    tags: Array.from(new Set([...fallback.tags, "ai-slide-deck", "studio-ready"])),
    sections: slides
      .filter((slide) => slide.type !== "title" && slide.type !== "objectives")
      .slice(0, 6)
      .map((slide, index) => ({
        title: slide.title,
        content: [
          ...slide.onScreenText,
          slide.visualSuggestion ? `Visual: ${slide.visualSuggestion}` : "",
          slide.speakerNotes ? `Teacher notes: ${slide.speakerNotes}` : "",
        ].filter(Boolean).join("\n"),
        content_type: slide.type === "activity" ? "activity" : "text",
        duration_minutes: index === 0 ? 8 : 7,
      })),
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
      designTemplateId = "corporate",
      outputLength,
      outputFormat = "lesson",
      slideCount = 10,
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
    const { instruction: designInstruction } = buildCreateLessonDesignInstruction({
      designTemplateId,
      outputLength,
      depth,
    });
    const requestedVersions = Math.min(3, Math.max(1, Number(versionCount || 1)));
    const requestedSlideCount = Math.min(24, Math.max(10, Number(slideCount || 10)));

    if (outputFormat === "slide_deck") {
      const topic = deriveTopicLabel(normalizedContent);
      const requestedTemplateCues = extractRequestedTemplateCues(normalizedContent);
      const slidePrompt = buildSlideDeckUserPrompt({
        mode,
        safeContent,
        complexityDesc,
        wasTruncated,
        profilePrompt: aiContext.prompt,
        stylePrompt,
        designInstruction,
        audienceLanguage,
        slideCount: requestedSlideCount,
      });

      let slides: AiLessonSlide[];
      let warning: string | undefined;

      try {
        const rawSlides = await generateAIChat({
          messages: [
            { role: "system" as const, content: SLIDE_DECK_SYSTEM_PROMPT },
            { role: "user" as const, content: slidePrompt },
          ],
          maxTokens: 4200,
          temperature: 0.25,
          feature: "lesson-slide-deck",
        });
        const parsedSlides = parseJsonArrayResponse(rawSlides);
        const clarification = extractSlideDeckClarification(parsedSlides);
        if (clarification) {
          return NextResponse.json({ clarification, slides: [] });
        }
        slides = ensureRequestedTemplateCueSlides(
          normalizeSlideDeck(parsedSlides, topic),
          requestedTemplateCues,
          topic,
        );
      } catch (slideError) {
        warning =
          slideError instanceof Error
            ? `AI slide output was not usable (${slideError.message}). Returned a local slide draft.`
            : "AI slide output was not usable. Returned a local slide draft.";
        slides = ensureRequestedTemplateCueSlides(
          buildLocalFallbackSlideDeck(topic, requestedSlideCount),
          requestedTemplateCues,
          topic,
        );
      }

      const lesson = slideDeckToLessonDraft(slides, topic);

      return NextResponse.json({
        lesson,
        slides,
        variants: [
          {
            ...lesson,
            tags: Array.from(new Set([...(lesson.tags || []), "version-1"])),
          },
        ],
        warning,
      });
    }

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
        designInstruction,
      });

    const userPrompt = makeUserPrompt(
      requestedVersions > 1
        ? "Version 1: balanced publish-ready version with the clearest progression."
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
