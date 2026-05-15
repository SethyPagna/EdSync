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
      "<h2>Key idea</h2><p>Explain the concept in plain language.</p><h3>Example</h3><p>Show one realistic example.</p><h3>Check</h3><p>Ask one quick question before moving on.</p>",
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
      '<div class="lesson-slide"><h2>Slide title</h2><ul><li>Main point</li><li>Evidence or example</li><li>Student action</li></ul></div><hr><div class="lesson-slide"><h2>Practice slide</h2><p>Add a prompt, scenario, or image cue.</p></div>',
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
      '<section class="lesson-practice-card"><h3>Practice Sprint</h3><p>Set a short timer, answer the prompt, then revise once after feedback.</p><ol><li>Try it without notes.</li><li>Compare with the success criteria.</li><li>Write one correction or upgrade.</li></ol></section>',
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
      '<section class="lesson-practice-card"><h3>Flashcard Round</h3><table><tbody><tr><th>Front</th><th>Back</th></tr><tr><td>Key term or question</td><td>Answer, example, or hint</td></tr><tr><td>Application prompt</td><td>Model response</td></tr></tbody></table><p>Students mark each card as Again, Almost, or Mastered.</p></section>',
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
      '<section class="lesson-practice-card"><h3>Scenario Game</h3><p>Give students a realistic situation and three choices. Award points for evidence-backed reasoning.</p><ol><li>Choose a response.</li><li>Explain why it works.</li><li>Unlock the next scenario after a strong answer.</li></ol></section>',
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
