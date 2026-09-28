/**
 * Engine test fixtures: real library themes, font pairs and formats plus one representative
 * content per layout.
 */
import { getDeckTheme, getFontPair, getFormat } from "@/lib/studio/library";
import type { SlideContent } from "../scene";

/** Light theme: solid page, gradient hero, blob decor, soft cards, 16px radius. */
export const LIGHT_THEME = getDeckTheme("porcelain");
/** Dark theme: grid-pattern page, gradient hero, line decor, outline cards, 4px radius. */
export const DARK_THEME = getDeckTheme("blueprint");
/** Square-cornered theme (radius 0, no decor, outline cards). */
export const SQUARE_THEME = getDeckTheme("monochrome");

/** Serif headings over a sans body. */
export const FONT_PAIR = getFontPair("editorial");

export const FORMATS = {
  wide: getFormat("slides-16x9"),
  a4: getFormat("doc-a4"),
  square: getFormat("ig-square"),
};

const LONG =
  "Water moves continuously between the oceans, the atmosphere and the land. Energy from the sun drives evaporation, and gravity pulls precipitation back down, so the same molecules keep cycling through lakes, clouds, glaciers and living things for billions of years.";

/** One representative content per layout id. */
export const SAMPLES: Record<string, SlideContent> = {
  "title-center": { kind: "title", kicker: "Science · Grade 5", title: "The Water Cycle", subtitle: "How water moves around our planet" },
  "title-left-image": { kind: "title", title: "The Water Cycle", subtitle: "How water moves around our planet", imageQuery: "clouds over a lake" },
  "title-split-band": { kind: "title", kicker: "Unit 3", title: "Forces and Motion", subtitle: "Pushes, pulls and Newton's laws" },
  "title-big-type": { kind: "title", kicker: "New course", title: "Creative Writing 101", subtitle: "Six weeks to your first short story" },
  "section-number": { kind: "section", kicker: "02", title: "Evaporation", subtitle: "From liquid to vapor" },
  "section-band": { kind: "section", title: "Condensation", subtitle: "Clouds form when vapor cools" },
  "agenda-list": { kind: "agenda", title: "Today we will", bullets: ["Name the four stages", "Explain what drives the cycle", "Follow one raindrop", "Check our understanding"] },
  "agenda-cards": { kind: "agenda", title: "Plan for the week", items: [{ title: "Monday", body: "Reading" }, { title: "Tuesday", body: "Lab" }, { title: "Wednesday", body: "Quiz" }, { title: "Thursday", body: "Project" }] },
  "bullets-simple": { kind: "bullets", title: "Why sleep matters", body: "Sleep supports memory, mood and growth.", bullets: ["Consolidates memories", "Regulates emotions", "Repairs muscles", "Boosts attention"] },
  "bullets-image-right": { kind: "bullets", title: "Healthy habits", bullets: ["Drink water", "Move every hour", "Sleep eight hours"], imageQuery: "healthy breakfast" },
  "bullets-image-left": { kind: "concept", title: "Photosynthesis", body: "Plants turn light into chemical energy.", bullets: ["Needs light", "Uses carbon dioxide", "Releases oxygen"], imageQuery: "green leaf" },
  "bullets-icon-grid": {
    kind: "bullets",
    title: "Study toolkit",
    items: [
      { title: "Read", body: "Skim first", icon: "book-open" },
      { title: "Write", body: "Summarize", icon: "pencil" },
      { title: "Test", body: "Quiz yourself", icon: "clipboard-check" },
      { title: "Rest", body: "Short breaks", icon: "clock" },
    ],
  },
  "cards-2": { kind: "concept", title: "Two kinds of energy", items: [{ title: "Kinetic", body: "Energy of motion" }, { title: "Potential", body: "Stored energy" }] },
  "cards-3": { kind: "concept", title: "What you'll learn", items: [{ title: "Voice", body: "Find your style", icon: "feather" }, { title: "Structure", body: "Build scenes", icon: "layers" }, { title: "Revision", body: "Edit with purpose", icon: "pencil" }] },
  "cards-4": { kind: "concept", title: "States of matter", items: [{ title: "Solid" }, { title: "Liquid" }, { title: "Gas" }, { title: "Plasma" }] },
  "concept-hero-image": { kind: "concept", title: "Water never disappears", body: "The same water has circulated for billions of years.", imageQuery: "earth from space" },
  "steps-horizontal": { kind: "steps", title: "Four stages", steps: ["Evaporation", "Condensation", "Precipitation", "Collection"] },
  "steps-vertical": { kind: "steps", title: "How to write a summary", steps: ["Read the text twice", "Underline key ideas", "Write one sentence per idea", "Check your length"] },
  "timeline-horizontal": { kind: "timeline", title: "Roadmap", items: [{ title: "Week 1", body: "Reading" }, { title: "Week 2", body: "Characters" }, { title: "Week 3", body: "Drafting" }, { title: "Week 4", body: "Sharing" }] },
  "timeline-vertical": { kind: "timeline", title: "Space race", bullets: ["1957: Sputnik launches", "1961: Gagarin orbits Earth", "1969: Apollo 11 lands on the Moon"] },
  "compare-columns": { kind: "compare", title: "Weather vs climate", compare: { a: { label: "Weather", points: ["Short term", "Local", "Changes daily"] }, b: { label: "Climate", points: ["Long term", "Regional", "Changes slowly"] } } },
  "compare-vs": { kind: "compare", title: "Cats or dogs?", compare: { a: { label: "Cats", points: ["Independent", "Quiet"] }, b: { label: "Dogs", points: ["Loyal", "Playful"] } } },
  "stat-big": { kind: "stat", title: "Most water is salty", body: "Only a tiny share is fresh water we can drink.", stats: [{ value: "97%", label: "of Earth's water is in the oceans" }] },
  "stats-row": { kind: "stats", title: "At a glance", stats: [{ value: "6", label: "weeks" }, { value: "12", label: "live sessions" }, { value: "1", label: "finished story" }] },
  "quote-center": { kind: "quote", title: "Why write", quote: { text: "You can't use up creativity. The more you use, the more you have.", author: "Maya Angelou" } },
  "quote-image": { kind: "quote", title: "Curiosity", quote: { text: "The important thing is not to stop questioning.", author: "Albert Einstein" }, imageQuery: "stars" },
  "definition-card": { kind: "definition", title: "Key term", terms: [{ term: "Transpiration", definition: "Water vapor released by plants through tiny pores in their leaves." }] },
  "glossary-grid": {
    kind: "glossary",
    title: "Vocabulary",
    terms: [
      { term: "Evaporation", definition: "Liquid becomes vapor" },
      { term: "Condensation", definition: "Vapor becomes liquid" },
      { term: "Precipitation", definition: "Water falls from clouds" },
      { term: "Runoff", definition: "Water flows over land" },
    ],
  },
  "question-choices": { kind: "question", title: "Quick check", question: { prompt: "What turns water vapor into clouds?", choices: ["Heating", "Cooling", "Wind", "Gravity"], answer: 1 } },
  "question-true-false": { kind: "quiz", title: "True or false", question: { prompt: "Clouds are made of water vapor you can see.", choices: ["True", "False"], answer: 1 } },
  "question-open": { kind: "question", title: "Think about it", question: { prompt: "Where does the water in your glass come from?" }, body: "Trace it back at least three steps." },
  "activity-card": { kind: "activity", title: "Build a rain gauge", body: "Work in pairs. You have 20 minutes.", steps: ["Cut the bottle", "Mark centimeters", "Place it outside"], icon: "flask-conical" },
  "image-full": { kind: "image", title: "A drop of water", body: "Photographed at 1/8000 s.", image: "https://example.com/drop.jpg" },
  "image-caption": { kind: "image", title: "Cloud types", body: "Cumulus, stratus and cirrus clouds form at different heights.", imageQuery: "cloud types chart" },
  "summary-checklist": { kind: "summary", title: "Remember", bullets: ["The sun powers the cycle", "Water changes state, not amount", "Plants add vapor too"] },
  "closing-thanks": { kind: "closing", title: "Thank you!", subtitle: "Questions?" },
  "doc-article": { kind: "concept", title: "The water cycle", body: `${LONG}\n\n${LONG}`, bullets: ["Evaporation", "Condensation", "Precipitation"], terms: [{ term: "Runoff", definition: "Water that flows over land into rivers." }] },
  "doc-worksheet": { kind: "activity", title: "Worksheet: the water cycle", body: "Answer each question in full sentences.", bullets: ["Name the four stages.", "What powers the cycle?", "Describe one raindrop's path."], question: { prompt: "Which stage happens in clouds?", choices: ["Evaporation", "Condensation", "Collection"] } },
  "doc-cornell": {
    kind: "concept",
    title: "Cornell notes: cells",
    body: "Cells are the basic unit of life; organelles each do one job.",
    items: [
      { title: "Nucleus", body: "Holds DNA and controls the cell." },
      { title: "Mitochondria", body: "Release energy from food." },
      { title: "Membrane", body: "Controls what enters and leaves." },
    ],
  },
  "social-quote": { kind: "quote", title: "Monday motivation", quote: { text: "Small steps every day.", author: "Anonymous" } },
  "social-tip": { kind: "bullets", kicker: "Study tip", title: "Beat procrastination", bullets: ["Start with 5 minutes", "Hide your phone", "Reward yourself"] },
  certificate: { kind: "title", kicker: "Certificate of completion", title: "Ada Lovelace", subtitle: "For completing Creative Writing 101", bullets: ["Ms. Rivera, Teacher", "June 2026"] },
  "poster-hero": { kind: "title", kicker: "Science fair", title: "Can plants hear music?", subtitle: "Friday, room 12", imageQuery: "plants" },
  flashcard: { kind: "definition", title: "Flashcard", terms: [{ term: "Photosynthesis", definition: "How plants make food from light, water and carbon dioxide." }] },
  mindmap: { kind: "concept", title: "Energy", bullets: ["Solar", "Wind", "Hydro", "Nuclear", "Fossil fuels", "Geothermal"] },
  "kanban-board": {
    kind: "activity",
    title: "Project board",
    items: [
      { title: "To do", body: "Pick a topic; Find sources" },
      { title: "Doing", body: "Draft outline" },
      { title: "Done", body: "Form groups; Choose roles" },
    ],
  },
  "swot-grid": {
    kind: "compare",
    title: "School garden SWOT",
    items: [
      { title: "Strengths", body: "Space; volunteers" },
      { title: "Weaknesses", body: "No budget" },
      { title: "Opportunities", body: "Grants" },
      { title: "Threats", body: "Summer break" },
    ],
  },
};

/** Content with every field filled, to stress any layout. */
export const KITCHEN_SINK: SlideContent = {
  kind: "concept",
  kicker: "Everything",
  title: "A page with every kind of content on it",
  subtitle: "Subtitle text that explains the page",
  body: LONG,
  bullets: ["First point to remember", "Second point with a little more text in it", "Third point"],
  items: [
    { title: "Item one", body: "Body of item one", icon: "lightbulb" },
    { title: "Item two", body: "Body of item two" },
  ],
  steps: ["Step one", "Step two"],
  compare: { a: { label: "Before", points: ["Slow", "Manual"] }, b: { label: "After", points: ["Fast", "Automatic"] } },
  stats: [
    { value: "42", label: "answers" },
    { value: "7", label: "days" },
  ],
  quote: { text: "A quote that belongs on the page.", author: "Someone" },
  question: { prompt: "Which is right?", choices: ["This", "That"] },
  terms: [{ term: "Term", definition: "Definition of the term" }],
  imageQuery: "everything",
};
