import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { generateAIChat } from "@/lib/ai/chat";

vi.mock("@/lib/auth", () => ({
  getAuthenticatedUser: vi.fn(async () => ({
    user: {
      id: "teacher-1",
      email: "teacher@example.com",
      user_metadata: { role: "teacher" },
    },
  })),
}));

vi.mock("@/lib/security/rate-limit", () => ({
  enforceRateLimit: vi.fn(async () => ({ allowed: true })),
}));

vi.mock("@/lib/ai/personalization", () => ({
  loadAiUserContext: vi.fn(async () => ({ prompt: "Teacher prefers applied examples." })),
  buildGenerationStylePrompt: vi.fn(() => "Use clear, supportive language."),
}));

vi.mock("@/lib/ai/lesson-design-context", () => ({
  buildCreateLessonDesignInstruction: vi.fn(() => ({
    instruction: "Use clean EdSync slide layouts.",
  })),
}));

vi.mock("@/lib/ai/chat", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/chat")>("@/lib/ai/chat");
  return {
    ...actual,
    generateAIChat: vi.fn(),
  };
});

const slideDeckResponse = [
  {
    slideNumber: 1,
    title: "Photosynthesis",
    type: "title",
    onScreenText: ["Photosynthesis", "How plants turn light into energy.", "Adult learners, 45 minutes."],
    speakerNotes: "Introduce the topic and connect it to food systems.",
    visualSuggestion: "Use a leaf and sun hero image.",
    navigation: { previous: null, next: "Learning Objectives" },
  },
  {
    slideNumber: 2,
    title: "Learning Objectives",
    type: "objectives",
    onScreenText: [
      "By the end, learners can define photosynthesis.",
      "By the end, learners can identify inputs and outputs.",
      "By the end, learners can explain why light matters.",
    ],
    speakerNotes: "Ask learners which objective feels most familiar.",
    visualSuggestion: "Use three compact objective cards.",
    navigation: { previous: "Photosynthesis", next: "Key Concept: Energy Conversion" },
  },
  {
    slideNumber: 3,
    title: "Key Concept: Energy Conversion",
    type: "content",
    onScreenText: ["Plants convert light energy into chemical energy.", "Chloroplasts are the work site.", "Analogy: a kitchen turns ingredients into meals."],
    speakerNotes: "Expected response: plants store energy as glucose.",
    visualSuggestion: "Diagram sun to leaf to glucose.",
    navigation: { previous: "Learning Objectives", next: "Key Concept: Inputs" },
  },
  {
    slideNumber: 4,
    title: "Key Concept: Inputs",
    type: "content",
    onScreenText: ["Plants use sunlight, carbon dioxide, and water.", "Each input supports a different part of the reaction.", "Example: less light slows sugar production."],
    speakerNotes: "Have learners predict what happens when one input is missing.",
    visualSuggestion: "Use three labeled input icons.",
    navigation: { previous: "Key Concept: Energy Conversion", next: "Walkthrough" },
  },
  {
    slideNumber: 5,
    title: "Walkthrough",
    type: "example",
    onScreenText: ["Step 1: Light hits the leaf.", "Step 2: The plant combines water and carbon dioxide.", "Step 3: Glucose and oxygen are produced."],
    speakerNotes: "Pause after each step and ask learners to name the next input or output.",
    visualSuggestion: "Use a three-step flow.",
    navigation: { previous: "Key Concept: Inputs", next: "Socratic: Sunlight" },
  },
  {
    slideNumber: 6,
    title: "Socratic: Sunlight",
    type: "socratic",
    onScreenText: ["**Why does sunlight matter?**", "What changes if sunlight is removed?", "What evidence would prove the plant is still producing glucose?"],
    speakerNotes: "Expected responses: energy source, slower production, growth or oxygen evidence.",
    visualSuggestion: "Use a question bubble beside a sun icon.",
    navigation: { previous: "Walkthrough", next: "Socratic: Evidence" },
  },
  {
    slideNumber: 7,
    title: "Socratic: Evidence",
    type: "socratic",
    onScreenText: ["**How do we know photosynthesis happened?**", "Which output can be observed?", "Which evidence might be indirect?"],
    speakerNotes: "Expected responses: oxygen release, plant growth, starch tests.",
    visualSuggestion: "Use an evidence checklist.",
    navigation: { previous: "Socratic: Sunlight", next: "Activity" },
  },
  {
    slideNumber: 8,
    title: "Activity",
    type: "activity",
    onScreenText: ["Match each input to its role.", "Predict the effect of removing one input.", "Share your reasoning."],
    speakerNotes: "Let learners work in pairs, then compare reasoning.",
    visualSuggestion: "Use a matching activity layout.",
    navigation: { previous: "Socratic: Evidence", next: "Summary" },
  },
  {
    slideNumber: 9,
    title: "Summary",
    type: "summary",
    onScreenText: ["Photosynthesis converts light into stored energy.", "Inputs are sunlight, water, and carbon dioxide.", "Outputs are glucose and oxygen."],
    speakerNotes: "Connect takeaways back to objectives.",
    visualSuggestion: "Use three summary cards.",
    navigation: { previous: "Activity", next: "Exit Ticket" },
  },
  {
    slideNumber: 10,
    title: "Exit Ticket",
    type: "assessment",
    onScreenText: ["Name two inputs.", "Name one output.", "Explain why sunlight matters."],
    speakerNotes: "Answer key: sunlight/water/carbon dioxide; glucose/oxygen; sunlight supplies energy.",
    visualSuggestion: "Use a compact exit ticket card.",
    navigation: { previous: "Summary", next: null },
  },
];

const generateAIChatMock = vi.mocked(generateAIChat);

function jsonRequest(body: unknown) {
  return new NextRequest("https://edsync.test/api/ai/create-lesson", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("create lesson AI route", () => {
  beforeEach(() => {
    generateAIChatMock.mockReset();
  });

  it("returns normalized slide deck output with lesson compatibility", async () => {
    generateAIChatMock.mockResolvedValue(JSON.stringify(slideDeckResponse));

    const response = await POST(jsonRequest({
      mode: "text",
      content: "Photosynthesis for adult learners",
      outputFormat: "slide_deck",
      slideCount: 10,
    }));

    const payload = await response.json() as {
      lesson: { title: string; sections: Array<{ title: string; content: string }> };
      slides: typeof slideDeckResponse;
    };

    expect(response.status).toBe(200);
    expect(payload.slides).toHaveLength(10);
    expect(payload.slides[0].navigation.previous).toBeNull();
    expect(payload.slides.at(-1)?.navigation.next).toBeNull();
    expect(payload.slides[5].type).toBe("socratic");
    expect(payload.lesson.title).toBe("Photosynthesis");
    expect(payload.lesson.sections[0].content).toContain("Visual:");
    expect(generateAIChatMock.mock.calls[0]?.[0].feature).toBe("lesson-slide-deck");
  });

  it("falls back to a complete linear slide deck when provider JSON is unusable", async () => {
    generateAIChatMock.mockResolvedValue(JSON.stringify([{ title: "Too short", onScreenText: ["Only one slide"] }]));

    const response = await POST(jsonRequest({
      mode: "text",
      content: "Basic budgeting for freelance course creators",
      outputFormat: "slide_deck",
      slideCount: 10,
    }));

    const payload = await response.json() as {
      lesson: { tags: string[] };
      slides: Array<{ type: string; navigation: { previous: string | null; next: string | null } }>;
      warning?: string;
    };

    expect(response.status).toBe(200);
    expect(payload.warning).toContain("Returned a local slide draft");
    expect(payload.slides).toHaveLength(10);
    expect(payload.slides[0].navigation.previous).toBeNull();
    expect(payload.slides.at(-1)?.navigation.next).toBeNull();
    expect(payload.slides.map((slide) => slide.type)).toEqual(
      expect.arrayContaining(["socratic", "activity", "summary", "assessment"]),
    );
    expect(payload.lesson.tags).toEqual(expect.arrayContaining(["ai-slide-deck", "studio-ready"]));
  });
});
