import type { SlideContent } from "@/lib/studio/scene";

/** Layout ids the compose engine implements; templates may hint one per page. */
export const LAYOUT_HINT_IDS = [
  "title-center",
  "title-left-image",
  "title-split-band",
  "title-big-type",
  "section-number",
  "section-band",
  "agenda-list",
  "agenda-cards",
  "bullets-simple",
  "bullets-image-right",
  "bullets-image-left",
  "bullets-icon-grid",
  "cards-2",
  "cards-3",
  "cards-4",
  "concept-hero-image",
  "steps-horizontal",
  "steps-vertical",
  "timeline-horizontal",
  "timeline-vertical",
  "compare-columns",
  "compare-vs",
  "stat-big",
  "stats-row",
  "quote-center",
  "quote-image",
  "definition-card",
  "glossary-grid",
  "question-choices",
  "question-true-false",
  "question-open",
  "activity-card",
  "image-full",
  "image-caption",
  "summary-checklist",
  "closing-thanks",
  "doc-article",
  "doc-worksheet",
  "doc-cornell",
  "social-quote",
  "social-tip",
  "certificate",
  "poster-hero",
  "flashcard",
  "mindmap",
  "kanban-board",
  "swot-grid",
] as const;

export type LayoutHintId = (typeof LAYOUT_HINT_IDS)[number];

export const TEMPLATE_CATEGORIES = ["Lessons", "Assessment", "Study tools", "Planning", "Social", "Print", "Classroom"] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export interface TemplateDef {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  formatId: string;
  themeId: string;
  fontPairId?: string;
  tags: readonly string[];
  pages: readonly SlideContent[];
  /** Optional preferred layout per page (same index as `pages`). */
  layoutHints?: readonly (LayoutHintId | undefined)[];
}

type Page = [LayoutHintId | undefined, SlideContent];

function template(
  meta: Omit<TemplateDef, "pages" | "layoutHints" | "tags"> & { tags: string },
  pages: Page[],
): TemplateDef {
  return {
    ...meta,
    tags: meta.tags.split(" "),
    pages: pages.map(([, content]) => content),
    layoutHints: pages.map(([hint]) => hint),
  };
}

export const TEMPLATES: readonly TemplateDef[] = [
  template(
    { id: "lesson-intro", name: "Lesson intro", category: "Lessons", description: "Eight-slide lesson from hook to check", formatId: "slides-16x9", themeId: "porcelain", tags: "lesson science deck teach intro" },
    [
      ["title-left-image", { kind: "title", kicker: "Science · Grade 5", title: "The Water Cycle", subtitle: "How water moves around our planet", imageQuery: "water cycle clouds lake" }],
      ["agenda-list", { kind: "agenda", title: "Today we will", bullets: ["Name the four stages", "Explain what drives the cycle", "Follow one raindrop's journey", "Check our understanding"] }],
      ["concept-hero-image", { kind: "concept", title: "Water never disappears", body: "The same water has circulated for billions of years. It changes state — liquid, vapor, ice — but the total amount stays the same.", imageQuery: "earth from space ocean" }],
      ["steps-horizontal", { kind: "steps", title: "Four stages", steps: ["Evaporation: the sun heats water into vapor", "Condensation: vapor cools into clouds", "Precipitation: water falls as rain or snow", "Collection: water gathers in oceans and lakes"] }],
      ["stat-big", { kind: "stat", title: "Most water is salty", stats: [{ value: "97%", label: "of Earth's water is in the oceans" }] }],
      ["definition-card", { kind: "definition", title: "Key term", terms: [{ term: "Transpiration", definition: "Water vapor released by plants through tiny pores in their leaves." }] }],
      ["question-choices", { kind: "question", title: "Quick check", question: { prompt: "What turns water vapor into clouds?", choices: ["Heating", "Cooling", "Wind", "Gravity"], answer: 1, explanation: "Rising vapor cools and condenses into droplets." } }],
      ["summary-checklist", { kind: "summary", title: "Remember", bullets: ["The sun powers the cycle", "Water changes state, not amount", "Plants add vapor too", "Rain returns water to the ground"] }],
    ],
  ),
  template(
    { id: "course-launch", name: "Course launch", category: "Lessons", description: "Announce a course with outcomes and roadmap", formatId: "slides-16x9", themeId: "midnight", tags: "course launch announce writing roadmap" },
    [
      ["title-big-type", { kind: "title", kicker: "New course", title: "Creative Writing 101", subtitle: "Six weeks to your first short story" }],
      ["cards-3", { kind: "concept", title: "What you'll learn", items: [{ title: "Voice", body: "Find a style that sounds like you", icon: "feather" }, { title: "Structure", body: "Build scenes that pull readers forward", icon: "layers" }, { title: "Revision", body: "Edit with purpose, not panic", icon: "pencil" }] }],
      ["timeline-horizontal", { kind: "timeline", title: "Roadmap", items: [{ title: "Weeks 1–2", body: "Reading like a writer" }, { title: "Weeks 3–4", body: "Characters and conflict" }, { title: "Week 5", body: "Drafting sprint" }, { title: "Week 6", body: "Workshop and share" }] }],
      ["stats-row", { kind: "stats", title: "At a glance", stats: [{ value: "6", label: "weeks" }, { value: "12", label: "live sessions" }, { value: "1", label: "finished story" }] }],
      ["quote-center", { kind: "quote", title: "Why write", quote: { text: "You can't use up creativity. The more you use, the more you have.", author: "Maya Angelou" } }],
      ["closing-thanks", { kind: "closing", title: "Join us", subtitle: "Enrollment opens Monday" }],
    ],
  ),
  template(
    { id: "flashcards", name: "Flashcards", category: "Study tools", description: "Term-and-definition cards for quick review", formatId: "slides-16x9", themeId: "blossom", tags: "flashcards vocabulary biology review memorize" },
    [
      ["title-center", { kind: "title", title: "Cell Biology", subtitle: "Flashcards · 5 terms" }],
      ["flashcard", { kind: "definition", title: "Mitochondria", terms: [{ term: "Mitochondria", definition: "Organelles that release energy from food for the cell." }] }],
      ["flashcard", { kind: "definition", title: "Nucleus", terms: [{ term: "Nucleus", definition: "The control center that holds the cell's DNA." }] }],
      ["flashcard", { kind: "definition", title: "Ribosome", terms: [{ term: "Ribosome", definition: "A tiny structure that builds proteins." }] }],
      ["flashcard", { kind: "definition", title: "Cell membrane", terms: [{ term: "Cell membrane", definition: "A thin layer that controls what enters and leaves the cell." }] }],
      ["flashcard", { kind: "definition", title: "Chloroplast", terms: [{ term: "Chloroplast", definition: "Where plant cells turn sunlight into food." }] }],
    ],
  ),
  template(
    { id: "cornell-notes", name: "Cornell notes", category: "Study tools", description: "Cue column, notes and summary", formatId: "doc-letter", themeId: "paper-ink", tags: "notes cornell study summary document" },
    [
      ["doc-cornell", { kind: "bullets", title: "Photosynthesis", subtitle: "Biology · Unit 3", items: [{ title: "What goes in?", body: "Light, water, carbon dioxide" }, { title: "What comes out?", body: "Glucose and oxygen" }, { title: "Where?", body: "Chloroplasts in leaf cells" }], body: "Plants use light energy to turn water and carbon dioxide into sugar and oxygen." }],
    ],
  ),
  template(
    { id: "vocabulary-builder", name: "Vocabulary builder", category: "Study tools", description: "Word wall plus a word of the day", formatId: "slides-16x9", themeId: "sage", tags: "vocabulary words glossary language ela" },
    [
      ["title-split-band", { kind: "title", title: "Word Wall", subtitle: "Unit 4 vocabulary" }],
      ["glossary-grid", { kind: "glossary", title: "This week's words", terms: [{ term: "Abundant", definition: "More than enough" }, { term: "Fragile", definition: "Easily broken" }, { term: "Migrate", definition: "Move from one place to another" }, { term: "Observe", definition: "Watch closely" }, { term: "Predict", definition: "Say what will happen next" }, { term: "Vast", definition: "Very large" }] }],
      ["definition-card", { kind: "definition", title: "Word of the day", terms: [{ term: "Metamorphosis", definition: "A complete change of form, like a caterpillar becoming a butterfly." }] }],
    ],
  ),
  template(
    { id: "timeline", name: "Timeline", category: "Lessons", description: "Key events in order", formatId: "slides-16x9", themeId: "parchment", tags: "timeline history events dates" },
    [
      ["title-center", { kind: "title", kicker: "History", title: "The Space Race", subtitle: "1957–1975" }],
      ["timeline-horizontal", { kind: "timeline", title: "Key moments", items: [{ title: "1957", body: "Sputnik 1 reaches orbit" }, { title: "1961", body: "Yuri Gagarin orbits Earth" }, { title: "1969", body: "Apollo 11 lands on the Moon" }, { title: "1975", body: "Apollo–Soyuz handshake in space" }] }],
      ["summary-checklist", { kind: "summary", title: "Why it mattered", bullets: ["Sparked new science and technology", "Shaped Cold War politics", "Ended in cooperation"] }],
    ],
  ),
  template(
    { id: "compare-contrast", name: "Compare & contrast", category: "Lessons", description: "Two ideas side by side", formatId: "slides-16x9", themeId: "ocean", tags: "compare contrast venn biology cells" },
    [
      ["title-center", { kind: "title", title: "Plant vs. Animal Cells" }],
      ["compare-columns", { kind: "compare", title: "Side by side", compare: { a: { label: "Plant cell", points: ["Cell wall", "Chloroplasts", "One large vacuole"] }, b: { label: "Animal cell", points: ["No cell wall", "No chloroplasts", "Small vacuoles"] } } }],
      ["question-open", { kind: "question", title: "Think", question: { prompt: "Name one structure both cells share and what it does." } }],
    ],
  ),
  template(
    { id: "mind-map", name: "Mind map", category: "Study tools", description: "One idea, many branches", formatId: "whiteboard", themeId: "nordic", tags: "mind map brainstorm ideas board" },
    [
      ["mindmap", { kind: "concept", title: "Renewable energy", items: [{ title: "Solar", body: "Panels turn light into power", icon: "sun" }, { title: "Wind", body: "Turbines spin generators", icon: "wind" }, { title: "Hydro", body: "Moving water drives turbines", icon: "droplet" }, { title: "Geothermal", body: "Heat from inside Earth", icon: "flame" }, { title: "Biomass", body: "Energy from plants and waste", icon: "leaf" }] }],
    ],
  ),
  template(
    { id: "study-plan", name: "Study plan", category: "Planning", description: "Three-week exam prep", formatId: "slides-16x9", themeId: "sage", fontPairId: "readable", tags: "study plan exam schedule revision" },
    [
      ["title-split-band", { kind: "title", title: "Exam prep plan", subtitle: "Biology final · 3 weeks" }],
      ["agenda-cards", { kind: "agenda", title: "Weekly focus", items: [{ title: "Week 1", body: "Cells and genetics", icon: "dna" }, { title: "Week 2", body: "Ecology and evolution", icon: "leaf" }, { title: "Week 3", body: "Practice tests and review", icon: "clipboard-check" }] }],
      ["summary-checklist", { kind: "summary", title: "Daily habits", bullets: ["25-minute focus blocks", "10 flashcards each morning", "One practice question at night", "Sleep 8 hours"] }],
    ],
  ),
  template(
    { id: "lab-report", name: "Lab report", category: "Study tools", description: "Question, method, results, conclusion", formatId: "doc-a4", themeId: "nordic", fontPairId: "tech", tags: "lab report science experiment document" },
    [
      ["doc-article", { kind: "concept", kicker: "Lab report", title: "Does light affect plant growth?", subtitle: "Name · Class · Date", items: [{ title: "Question", body: "How does the amount of light change how tall bean plants grow?" }, { title: "Hypothesis", body: "Plants with more light will grow taller in two weeks." }, { title: "Materials", body: "6 bean seedlings, 3 lamps, ruler, water" }, { title: "Method", body: "Place two plants under each light level. Water equally. Measure every two days." }] }],
      ["doc-article", { kind: "concept", title: "Results & conclusion", stats: [{ value: "14 cm", label: "full light" }, { value: "9 cm", label: "half light" }, { value: "3 cm", label: "no light" }], body: "Plants with more light grew taller, which supports the hypothesis. Next time, test more plants per group." }],
    ],
  ),
  template(
    { id: "book-report", name: "Book report", category: "Study tools", description: "Summary, characters, theme and rating", formatId: "doc-letter", themeId: "parchment", tags: "book report reading literature document" },
    [
      ["doc-article", { kind: "concept", kicker: "Book report", title: "Charlotte's Web", subtitle: "by E. B. White", items: [{ title: "Summary", body: "A pig named Wilbur is saved by his friend Charlotte, a spider who writes words in her web." }, { title: "Characters", body: "Wilbur, Charlotte, Fern, Templeton" }, { title: "Theme", body: "True friendship means helping without expecting anything back." }, { title: "My rating", body: "5 of 5 — funny, sad and kind." }] }],
    ],
  ),
  template(
    { id: "essay-outline", name: "Essay outline", category: "Study tools", description: "Thesis, body paragraphs, conclusion", formatId: "doc-a4", themeId: "paper-ink", tags: "essay outline writing thesis document" },
    [
      ["doc-worksheet", { kind: "steps", title: "Essay outline", subtitle: "Topic: Should homework be banned?", steps: ["Hook: a surprising fact or question", "Thesis: your claim in one sentence", "Body 1: reason + evidence", "Body 2: reason + evidence", "Counterargument and response", "Conclusion: restate and leave a final thought"] }],
    ],
  ),
  template(
    { id: "swot", name: "SWOT analysis", category: "Planning", description: "Strengths, weaknesses, opportunities, threats", formatId: "slides-16x9", themeId: "graphite", tags: "swot analysis planning strategy" },
    [
      ["swot-grid", { kind: "concept", title: "Reading club SWOT", items: [{ title: "Strengths", body: "Keen members, free library space" }, { title: "Weaknesses", body: "Few books for older readers" }, { title: "Opportunities", body: "Partner with the public library" }, { title: "Threats", body: "Clashes with sports practice" }] }],
    ],
  ),
  template(
    { id: "kanban", name: "Kanban board", category: "Planning", description: "To do, doing, done", formatId: "kanban", themeId: "porcelain", tags: "kanban board tasks project" },
    [
      ["kanban-board", { kind: "concept", title: "Science fair project", items: [{ title: "To do", body: "Design poster\nPractice talk" }, { title: "Doing", body: "Collect data\nMake charts" }, { title: "Done", body: "Pick a question\nBuild the setup" }] }],
    ],
  ),
  template(
    { id: "infographic", name: "Infographic", category: "Print", description: "Portrait facts poster", formatId: "poster", themeId: "ocean", tags: "infographic poster facts stats portrait" },
    [
      ["stats-row", { kind: "stats", kicker: "Health", title: "Sleep helps you learn", body: "During deep sleep your brain replays what you practiced during the day.", stats: [{ value: "9–12 h", label: "sleep for ages 6–12" }, { value: "8–10 h", label: "sleep for teens" }, { value: "1 h", label: "screen-free before bed" }] }],
    ],
  ),
  template(
    { id: "exit-ticket", name: "Exit ticket", category: "Assessment", description: "3-2-1 reflection slip", formatId: "doc-a5", themeId: "citrus", tags: "exit ticket reflection formative check" },
    [
      ["doc-worksheet", { kind: "activity", title: "Exit ticket", subtitle: "Name · Date", items: [{ title: "3 things I learned" }, { title: "2 questions I still have" }, { title: "1 way I'll use this" }] }],
    ],
  ),
  template(
    { id: "quiz-review", name: "Quiz review", category: "Assessment", description: "Six-slide review game", formatId: "slides-16x9", themeId: "kids-playful", tags: "quiz review game fractions math" },
    [
      ["title-center", { kind: "title", kicker: "Review game", title: "Fractions", subtitle: "4 questions" }],
      ["question-choices", { kind: "question", title: "Question 1", question: { prompt: "Which fraction equals 1/2?", choices: ["2/3", "3/6", "1/4", "4/6"], answer: 1 } }],
      ["question-true-false", { kind: "question", title: "Question 2", question: { prompt: "3/4 is greater than 2/3.", answer: true, explanation: "9/12 is greater than 8/12." } }],
      ["question-choices", { kind: "question", title: "Question 3", question: { prompt: "What is 1/3 + 1/3?", choices: ["2/6", "1/9", "2/3", "1/6"], answer: 2 } }],
      ["question-open", { kind: "question", title: "Question 4", question: { prompt: "Draw 3/5 of a pizza and explain your drawing." } }],
      ["summary-checklist", { kind: "summary", title: "Answers", bullets: ["1 — 3/6", "2 — True", "3 — 2/3", "4 — Five slices, three shaded"] }],
    ],
  ),
  template(
    { id: "worksheet", name: "Worksheet", category: "Assessment", description: "Practice problems with space to work", formatId: "doc-letter", themeId: "porcelain", tags: "worksheet practice math printable" },
    [
      ["doc-worksheet", { kind: "activity", title: "Fractions practice", subtitle: "Name · Date", items: [{ title: "Simplify 6/8" }, { title: "Add 1/4 + 2/4" }, { title: "Order from least to greatest: 1/2, 1/3, 3/4" }, { title: "Shade 2/5 of the rectangle" }] }],
      ["doc-worksheet", { kind: "activity", title: "Word problems", items: [{ title: "Maya ate 2/8 of a pizza. Leo ate 3/8. How much did they eat together?" }, { title: "A ribbon is 3/4 m long. You cut off 1/4 m. How much is left?" }] }],
    ],
  ),
  template(
    { id: "syllabus", name: "Syllabus", category: "Planning", description: "Course overview for students and families", formatId: "doc-letter", themeId: "nordic", fontPairId: "academic", tags: "syllabus course overview document" },
    [
      ["doc-article", { kind: "concept", kicker: "Fall 2026", title: "Biology Syllabus", subtitle: "Room 214 · Mon, Wed, Fri", items: [{ title: "About the course", body: "Explore how living things work, from cells to ecosystems." }, { title: "Grading", body: "Labs 30% · Quizzes 30% · Project 20% · Final 20%" }, { title: "Materials", body: "Notebook, pencil, calculator" }, { title: "Contact", body: "Office hours Tue 3–4 pm" }] }],
      ["timeline-vertical", { kind: "timeline", title: "Units", items: [{ title: "Sep", body: "Cells" }, { title: "Oct", body: "Genetics" }, { title: "Nov", body: "Evolution" }, { title: "Dec", body: "Ecology" }] }],
    ],
  ),
  template(
    { id: "weekly-planner", name: "Weekly planner", category: "Planning", description: "Five days at a glance", formatId: "doc-a4-landscape", themeId: "sage", tags: "planner week schedule calendar" },
    [
      ["agenda-cards", { kind: "agenda", title: "This week", items: [{ title: "Mon", body: "Math quiz" }, { title: "Tue", body: "Library visit" }, { title: "Wed", body: "Science lab" }, { title: "Thu", body: "Book club" }, { title: "Fri", body: "Project due" }] }],
    ],
  ),
  template(
    { id: "class-rules", name: "Class rules poster", category: "Classroom", description: "Five friendly rules with icons", formatId: "poster", themeId: "kids-playful", tags: "rules poster classroom kids expectations" },
    [
      ["bullets-icon-grid", { kind: "bullets", title: "Our class rules", items: [{ title: "Be kind", icon: "heart" }, { title: "Listen", icon: "ear" }, { title: "Try your best", icon: "star" }, { title: "Ask for help", icon: "hand" }, { title: "Be ready", icon: "backpack" }] }],
    ],
  ),
  template(
    { id: "certificate", name: "Certificate", category: "Classroom", description: "Award for effort or achievement", formatId: "certificate", themeId: "parchment", fontPairId: "classic", tags: "certificate award achievement print" },
    [
      ["certificate", { kind: "title", kicker: "Certificate of achievement", title: "Jordan Lee", subtitle: "For outstanding effort in the 2026 Science Fair", body: "Ms. Rivera · October 2026" }],
    ],
  ),
  template(
    { id: "newsletter", name: "Newsletter", category: "Classroom", description: "Monthly class news for families", formatId: "doc-letter", themeId: "sunrise", tags: "newsletter families class news document" },
    [
      ["doc-article", { kind: "concept", kicker: "October", title: "Room 12 News", items: [{ title: "What we're learning", body: "Fractions in math and the water cycle in science." }, { title: "Star of the week", body: "Amir, for helping classmates every day." }, { title: "Help at home", body: "Read together for 20 minutes each night." }] }],
      ["doc-article", { kind: "timeline", title: "Upcoming dates", items: [{ title: "Oct 10", body: "Picture day" }, { title: "Oct 17", body: "Museum trip" }, { title: "Oct 31", body: "Book character parade" }] }],
    ],
  ),
  template(
    { id: "social-quote", name: "Quote post", category: "Social", description: "Square quote card", formatId: "ig-square", themeId: "aurora", tags: "social quote instagram post" },
    [
      ["social-quote", { kind: "quote", title: "Quote", quote: { text: "Education is not the filling of a pail, but the lighting of a fire.", author: "W. B. Yeats (attributed)" } }],
    ],
  ),
  template(
    { id: "social-tips", name: "Tip carousel", category: "Social", description: "Three-slide study tips carousel", formatId: "ig-portrait", themeId: "citrus", tags: "social carousel tips instagram study" },
    [
      ["social-tip", { kind: "title", kicker: "Study tips", title: "3 ways to remember more" }],
      ["social-tip", { kind: "concept", kicker: "Tip 1", title: "Test yourself", body: "Quiz yourself before re-reading. Recall beats review.", icon: "circle-question-mark" }],
      ["social-tip", { kind: "concept", kicker: "Tip 2", title: "Space it out", body: "Short sessions over several days stick longer than one cram.", icon: "calendar" }],
    ],
  ),
  template(
    { id: "event-flyer", name: "Event flyer", category: "Print", description: "School event announcement", formatId: "flyer", themeId: "sunrise", tags: "flyer event poster announcement" },
    [
      ["poster-hero", { kind: "title", kicker: "You're invited", title: "Science Fair Night", subtitle: "Thursday, Nov 13 · 6–8 pm · Gym", bullets: ["50+ student projects", "Live experiments", "Snacks and prizes"], imageQuery: "science fair volcano" }],
    ],
  ),
  template(
    { id: "project-proposal", name: "Project proposal", category: "Planning", description: "Pitch a project in five slides", formatId: "slides-16x9", themeId: "graphite", tags: "proposal project pitch plan" },
    [
      ["title-split-band", { kind: "title", kicker: "Proposal", title: "School Garden", subtitle: "Growing food and science skills" }],
      ["bullets-image-right", { kind: "bullets", title: "The problem", bullets: ["Few outdoor learning spaces", "Students rarely see where food comes from", "Science labs are indoors only"], imageQuery: "empty schoolyard" }],
      ["steps-horizontal", { kind: "steps", title: "The plan", steps: ["Build 6 raised beds", "Plant with each grade", "Harvest for the cafeteria"] }],
      ["stats-row", { kind: "stats", title: "Budget & impact", stats: [{ value: "$1,200", label: "total cost" }, { value: "400", label: "students involved" }, { value: "8", label: "weeks to first harvest" }] }],
      ["closing-thanks", { kind: "closing", title: "Next steps", subtitle: "Approval by Nov 1 · Build day Nov 15" }],
    ],
  ),
  template(
    { id: "parent-update", name: "Parent update", category: "Classroom", description: "Weekly note home", formatId: "doc-letter", themeId: "blossom", tags: "parents families update letter document" },
    [
      ["doc-article", { kind: "concept", kicker: "Week of Oct 6", title: "Parent update", body: "Thank you for a wonderful start to the term. Here is what's coming up.", items: [{ title: "This week", body: "We begin our fractions unit." }, { title: "Please send", body: "A labelled water bottle every day." }, { title: "Reminder", body: "Conferences are Oct 20–22. Sign-up link coming soon." }] }],
    ],
  ),
  template(
    { id: "goal-tracker", name: "Goal tracker", category: "Planning", description: "Goals with progress", formatId: "slides-16x9", themeId: "forest", tags: "goals tracker progress habits" },
    [
      ["cards-3", { kind: "concept", title: "My goals this term", items: [{ title: "Read 10 books", body: "4 of 10 done", icon: "book-open" }, { title: "Quiz average 85%", body: "Now at 78%", icon: "target" }, { title: "Run a 5K", body: "Training 3× a week", icon: "footprints" }] }],
      ["summary-checklist", { kind: "summary", title: "This week", bullets: ["Finish chapter 6", "Retake unit 2 quiz", "Two runs"] }],
    ],
  ),
  template(
    { id: "reading-log", name: "Reading log", category: "Study tools", description: "Track books, pages and minutes", formatId: "doc-letter", themeId: "sage", fontPairId: "readable", tags: "reading log tracker books printable" },
    [
      ["doc-cornell", { kind: "timeline", title: "Reading log", subtitle: "Goal: 20 minutes a day", items: [{ title: "Mon", body: "Title · Pages · Minutes" }, { title: "Tue", body: "Title · Pages · Minutes" }, { title: "Wed", body: "Title · Pages · Minutes" }, { title: "Thu", body: "Title · Pages · Minutes" }, { title: "Fri", body: "Title · Pages · Minutes" }] }],
    ],
  ),
  template(
    { id: "math-mini-lesson", name: "Math mini-lesson", category: "Lessons", description: "Chalkboard lesson with worked steps", formatId: "slides-16x9", themeId: "chalkboard", tags: "math lesson chalkboard area geometry" },
    [
      ["title-center", { kind: "title", kicker: "Math · Grade 4", title: "Area of Rectangles" }],
      ["definition-card", { kind: "definition", title: "Area", terms: [{ term: "Area", definition: "The amount of space inside a flat shape, measured in square units." }] }],
      ["steps-vertical", { kind: "steps", title: "Worked example", steps: ["Measure the length: 6 cm", "Measure the width: 4 cm", "Multiply: 6 × 4 = 24", "Answer: 24 square centimeters"] }],
      ["question-choices", { kind: "question", title: "Your turn", question: { prompt: "A rug is 5 m by 3 m. What is its area?", choices: ["8 m²", "15 m²", "16 m²", "53 m²"], answer: 1 } }],
    ],
  ),
  template(
    { id: "coding-workshop", name: "Coding workshop", category: "Lessons", description: "Intro to programming concepts", formatId: "slides-16x9", themeId: "blueprint", tags: "coding programming workshop computer science" },
    [
      ["title-left-image", { kind: "title", kicker: "Workshop", title: "Think Like a Programmer", subtitle: "Loops, conditions and debugging", imageQuery: "kids coding laptop" }],
      ["bullets-icon-grid", { kind: "bullets", title: "Big ideas", items: [{ title: "Sequence", body: "Steps run in order", icon: "list-ordered" }, { title: "Loops", body: "Repeat without rewriting", icon: "repeat" }, { title: "Conditions", body: "Choose what happens", icon: "workflow" }, { title: "Debugging", body: "Find and fix mistakes", icon: "bug" }] }],
      ["activity-card", { kind: "activity", title: "Pair challenge", body: "Write instructions that guide your partner through a maze. Use at least one loop.", items: [{ title: "10 minutes" }, { title: "Pairs" }] }],
      ["closing-thanks", { kind: "closing", title: "Great work", subtitle: "Next time: build a game" }],
    ],
  ),
];

const TEMPLATE_BY_ID = new Map(TEMPLATES.map((entry) => [entry.id, entry]));

export function getTemplate(id: string | null | undefined): TemplateDef | undefined {
  return id ? TEMPLATE_BY_ID.get(id) : undefined;
}

export function templatesInCategory(category: TemplateCategory): TemplateDef[] {
  return TEMPLATES.filter((entry) => entry.category === category);
}

/** Ranked search over name, tags, category and description. */
export function searchTemplates(query: string, category?: TemplateCategory): TemplateDef[] {
  const pool = category ? templatesInCategory(category) : [...TEMPLATES];
  const q = query.trim().toLowerCase();
  if (!q) return pool;
  const words = q.split(/\s+/);
  const scored = pool
    .map((entry) => {
      const name = entry.name.toLowerCase();
      let score = name === q ? 100 : name.startsWith(q) ? 50 : name.includes(q) ? 30 : 0;
      for (const word of words) {
        if (entry.tags.some((tag) => tag.startsWith(word))) score += 20;
        else if (entry.category.toLowerCase().startsWith(word) || entry.description.toLowerCase().includes(word)) score += 10;
      }
      return { entry, score };
    })
    .filter(({ score }) => score > 0);
  return scored.sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name)).map(({ entry }) => entry);
}
