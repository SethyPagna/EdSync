import type { ContentType } from "@/types";

export type SectionTemplate = {
  id: string;
  label: string;
  description: string;
  category: "teach" | "practice" | "media" | "assess";
  contentType: ContentType;
  durationMinutes: number;
  title: string;
  content: string;
};

export type SectionInsertTool = {
  label: string;
  description: string;
  content: string;
};

export const SECTION_INSERT_TOOLS: SectionInsertTool[] = [
  {
    label: "H2",
    description: "Large heading",
    content: "## Section heading",
  },
  {
    label: "H3",
    description: "Small heading",
    content: "### Subheading",
  },
  {
    label: "Slide",
    description: "Slide-style block",
    content:
      "Slide title\n- Main point\n- Evidence or example\n- Student action",
  },
  {
    label: "Table",
    description: "Two-column table",
    content: "Table\nItem | Notes\nExample | Add details",
  },
  {
    label: "Checklist",
    description: "Success criteria",
    content: "Checklist\n[ ] Step one\n[ ] Step two\n[ ] Reflection",
  },
  {
    label: "Practice",
    description: "Timed activity",
    content:
      "Practice Sprint\nSet a short timer, answer the prompt, then revise once after feedback.\n1. Try it without notes.\n2. Compare with the success criteria.\n3. Write one correction or upgrade.",
  },
  {
    label: "Callout",
    description: "Key reminder",
    content: "Callout: Remember\nAdd a key reminder, warning, or example.",
  },
  {
    label: "Spacer",
    description: "Visual pause",
    content: "---",
  },
];

export const SECTION_TEMPLATES: SectionTemplate[] = [
  {
    id: "concept-brief",
    label: "Concept Brief",
    description: "Short explanation with examples.",
    category: "teach",
    contentType: "text",
    durationMinutes: 8,
    title: "Concept Brief",
    content:
      "## Key idea\nExplain the concept in plain language.\n\n### Example\nShow one realistic example.\n\n### Check\nAsk one quick question before moving on.",
  },
  {
    id: "slide-deck",
    label: "Slide Deck",
    description: "Presentation-style section.",
    category: "teach",
    contentType: "text",
    durationMinutes: 12,
    title: "Slide Deck",
    content:
      "Slide 1: Slide title\n- Main point\n- Evidence or example\n- Student action\n\n---\n\nSlide 2: Practice slide\nAdd a prompt, scenario, or image cue.",
  },
  {
    id: "guided-notes",
    label: "Guided Notes",
    description: "Word-style notes with blanks.",
    category: "practice",
    contentType: "activity",
    durationMinutes: 10,
    title: "Guided Notes",
    content:
      "Students complete the blanks while reading or listening.\n\n1. The main idea is __________.\n2. One example is __________.\n3. This matters because __________.",
  },
  {
    id: "practice-sprint",
    label: "Practice Sprint",
    description: "Timed LEARN-style practice loop.",
    category: "practice",
    contentType: "activity",
    durationMinutes: 12,
    title: "Practice Sprint",
    content:
      "Practice Sprint\nSet a short timer, answer the prompt, then revise once after feedback.\n\n1. Try it without notes.\n2. Compare with the success criteria.\n3. Write one correction or upgrade.",
  },
  {
    id: "flashcard-round",
    label: "Flashcard Round",
    description: "Recall, flip, and retry activity.",
    category: "practice",
    contentType: "activity",
    durationMinutes: 8,
    title: "Flashcard Round",
    content:
      "Flashcard Round\n\nFront | Back\nKey term or question | Answer, example, or hint\nApplication prompt | Model response\n\nStudents mark each card as Again, Almost, or Mastered.",
  },
  {
    id: "scenario-game",
    label: "Scenario Game",
    description: "Choice-based challenge with points.",
    category: "practice",
    contentType: "activity",
    durationMinutes: 15,
    title: "Scenario Game",
    content:
      "Scenario Game\nGive students a realistic situation and three choices. Award points for evidence-backed reasoning.\n\n1. Choose a response.\n2. Explain why it works.\n3. Unlock the next scenario after a strong answer.",
  },
  {
    id: "media-analysis",
    label: "Media Analysis",
    description: "Image or video observation.",
    category: "media",
    contentType: "image",
    durationMinutes: 10,
    title: "Media Analysis",
    content: "|||Observe, describe evidence, infer meaning, and connect the media to the learning objective.",
  },
  {
    id: "discussion",
    label: "Discussion",
    description: "Peer response prompt.",
    category: "practice",
    contentType: "discussion",
    durationMinutes: 8,
    title: "Discussion Prompt",
    content:
      "Post your answer, then reply to one classmate with a question or connection.\n\nPrompt: What is the strongest evidence for your answer?",
  },
  {
    id: "exit-ticket",
    label: "Exit Ticket",
    description: "Fast final check.",
    category: "assess",
    contentType: "quiz",
    durationMinutes: 5,
    title: "Exit Ticket",
    content: "Exit Ticket",
  },
];

export function sectionTemplateById(id: string) {
  return SECTION_TEMPLATES.find((template) => template.id === id) ?? SECTION_TEMPLATES[0];
}

export function normalizeLessonAuthoringContent(content: string) {
  if (!content || !/[<>]/.test(content)) return content;

  return content
    .replace(/<hr\s*\/?>/gi, "\n\n---\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(h1|h2)>/gi, "\n")
    .replace(/<(h1|h2)[^>]*>/gi, "## ")
    .replace(/<\/(h3|h4)>/gi, "\n")
    .replace(/<(h3|h4)[^>]*>/gi, "### ")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<th[^>]*>/gi, "")
    .replace(/<\/th>/gi, " | ")
    .replace(/<td[^>]*>/gi, "")
    .replace(/<\/td>/gi, " | ")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
