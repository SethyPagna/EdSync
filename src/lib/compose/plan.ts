import { getIcon } from "@/lib/studio/library/icons";
import type { ContentItem, SlideContent } from "@/lib/studio/scene";
import type { LessonOutline, OutlineQuestion, OutlineSection, OutlineSectionKind } from "./types";
import { bulletsRepeatBody, clampText, composeStrings, countWords, foldText, hashString, parseStatLine, seededShuffle, type ComposeStrings } from "./outline";

/* ------------------------------------------------------------------ */
/* Icons: keyword stems -> canonical ids of the studio icon library     */
/* ------------------------------------------------------------------ */

/**
 * Ordered keyword map (accent-folded stems). Stems of 4+ letters match word prefixes;
 * shorter stems must match a whole word. First word in the text that matches wins.
 */
const ICON_KEYWORDS: [string, string][] = [
  ["history histor ancient antigu empire imperio civilization civiliza pharaoh egypt rome roman medieval", "landmark"],
  ["war wars guerra guerre revolution revoluc battle batalla bataille independence independencia", "flag"],
  ["plant plants leaf leaves photosynth tree trees forest ecolog ecosystem nature naturaleza planta hoja arbol bosque plante feuille arbre foret", "leaf"],
  ["cell cells celula cellule dna adn gene genes genetic genetica genetique chromosom", "dna"],
  ["microscop bacteria virus germ germs microb", "microscope"],
  ["atom atoms atomo molecul chemi quimic chimi element elements elemento", "atom"],
  ["experiment experimento lab laboratory laboratorio reaction reaccion flask", "flask-conical"],
  ["space planet planets galaxy rocket orbit moon espacio planeta cohete luna espace planete fusee lune astronom", "rocket"],
  ["sun solar sol soleil", "sun"],
  ["energy electric electricity power energia electricidad energie electricite", "zap"],
  ["water ocean oceans rain river rivers agua lluvia oceano rio eau pluie ocean riviere hydro", "droplet"],
  ["mountain mountains volcano volcan volcanes volcans earth geolog rock rocks montana montagne tierra terre", "mountain"],
  ["world global country countries geograph continent mundo pais paises monde pays", "globe"],
  ["map maps region location mapa carte", "map"],
  ["math maths mathemat algebra equation equations number numbers fraction fractions calcul matemat ecuacion numero nombre", "calculator"],
  ["sum integral formula formulas sigma", "sigma"],
  ["money economy econom price prices cost costs market finance financ dinero precio argent prix budget", "circle-dollar-sign"],
  ["business work job jobs career trabajo empleo travail metier empresa entreprise", "briefcase"],
  ["language languages grammar vocabulary idioma lengua gramatica vocabulario langue grammaire vocabulaire translat", "languages"],
  ["write writing essay escrib redac ecrire redaction", "pencil"],
  ["read reading book books story stories literat novel poem poetry libro leer cuento lectura livre lire lecture roman poesie", "book-open"],
  ["art arts paint painting color colour design draw drawing arte pintura dibujo color dessin peinture couleur", "palette"],
  ["music song songs sound musica cancion sonido musique chanson", "music"],
  ["code coding program programming software algorithm computer codigo programa programacion ordenador computadora logiciel ordinateur informatique", "code"],
  ["data hardware processor chip datos donnees", "cpu"],
  ["brain mind think thinking memory cerebro mente pensar memoria cerveau esprit memoire psycholog", "brain"],
  ["health heart body medic medicine salud corazon cuerpo medicina sante coeur corps", "heart"],
  ["people team group society community social gente equipo grupo sociedad comunidad personnes equipe groupe societe", "users"],
  ["justice court law laws legal rights justicia derecho derechos ley leyes droit droits loi lois", "landmark"],
  ["rule rules safety security regla reglas seguridad regle regles securite", "shield"],
  ["goal goals objective objectives aim target objetivo objetivos meta objectif objectifs", "target"],
  ["compare comparison versus difference differences contrast comparar diferencia diferencias comparer comparaison", "table"],
  ["step steps process procedure paso pasos proceso procedimiento etape etapes processus procedure", "list-ordered"],
  ["timeline chronolog cronolog date dates year years century siglo siecle", "hourglass"],
  ["time clock hour hours minute minutes tiempo hora temps heure", "clock"],
  ["calendar schedule week month calendario semana mes calendrier semaine mois", "calendar"],
  ["growth increase trend trends crecimiento aumento tendencia croissance hausse", "trending-up"],
  ["statistic statistics percent percentage chart graph estadistic porcentaje grafico statistique pourcentage graphique", "chart-column"],
  ["success win award achievement exito logro premio reussite victoire", "trophy"],
  ["explore discover direction explorar descubrir explorer decouvrir", "compass"],
  ["path route journey travel camino ruta viaje chemin voyage", "footprints"],
  ["layer layers level levels structure capa capas nivel estructura couche niveau structure", "layers"],
  ["search research investigat buscar investigacion recherche", "search"],
  ["question questions why pregunta preguntas pourquoi", "circle-question-mark"],
  ["idea ideas concept concepts concepto conceptos idee idees notion", "lightbulb"],
  ["example examples case ejemplo ejemplos caso exemple exemples", "puzzle"],
  ["summary recap conclusion resumen conclusion resume bilan", "circle-check"],
  ["key important highlight clave importante cle essentiel", "star"],
  ["tip tips note notes info nota consejo conseil astuce", "info"],
];

const KIND_ICON: Record<OutlineSectionKind, string> = {
  concept: "lightbulb",
  example: "puzzle",
  steps: "list-ordered",
  timeline: "calendar-days",
  compare: "table",
  stat: "chart-column",
  quote: "quote",
  question: "message-circle",
  activity: "users",
  summary: "circle-check",
};

const PAGE_ICON = {
  title: "graduation-cap",
  agenda: "list-todo",
  objectives: "target",
  glossary: "book-open",
  definition: "book",
  quiz: "circle-question-mark",
  question: "circle-question-mark",
  recap: "list-checks",
  answerKey: "list-checks",
  closing: "message-square",
  social: "sparkles",
} as const;

const EXACT_ICON = new Map<string, string>();
const PREFIX_ICON: [string, string][] = [];
for (const [stems, icon] of ICON_KEYWORDS) {
  for (const stem of stems.split(" ")) {
    if (stem.length >= 4) PREFIX_ICON.push([stem, icon]);
    if (!EXACT_ICON.has(stem)) EXACT_ICON.set(stem, icon);
  }
}

/**
 * Every icon id the planner emits on its own. Author/AI icons are passed through only
 * when the studio library knows them (and then as the library's canonical id).
 */
export const PLAN_ICON_IDS: readonly string[] = [
  ...new Set([...ICON_KEYWORDS.map(([, icon]) => icon), ...Object.values(KIND_ICON), ...Object.values(PAGE_ICON)]),
];

/** Generic icons that only win when no topical keyword matches. */
const WEAK_ICONS = new Set(["circle-question-mark", "lightbulb", "puzzle", "circle-check", "star", "info", "target", "list-ordered", "table"]);

function matchIcon(text: string): { icon: string; weak: boolean } | undefined {
  let weak: string | undefined;
  for (const word of foldText(text).split(" ")) {
    if (!word) continue;
    const icon = EXACT_ICON.get(word) ?? (word.length >= 4 ? PREFIX_ICON.find(([stem]) => word.startsWith(stem))?.[1] : undefined);
    if (!icon) continue;
    if (!WEAK_ICONS.has(icon)) return { icon, weak: false };
    weak ??= icon;
  }
  return weak ? { icon: weak, weak: true } : undefined;
}

/** Picks a lucide icon id from keywords in `text` (en/es/fr); `fallback` when nothing matches. */
export function pickIcon(text: string, fallback = "lightbulb"): string {
  return matchIcon(text)?.icon ?? fallback;
}

/** Canonical library id for an authored icon ("check-circle" → "circle-check", "light-bulb" → "lightbulb"). */
function libraryIcon(id: string | undefined): string | undefined {
  if (!id) return undefined;
  return (getIcon(id) ?? getIcon(id.replace(/-/g, "")))?.id;
}

function sectionIcon(section: OutlineSection): string {
  const authored = libraryIcon(section.icon);
  if (authored) return authored;
  const heading = matchIcon(section.heading);
  if (heading && !heading.weak) return heading.icon;
  const body = matchIcon([...section.bullets, ...(section.steps ?? []), section.body ?? ""].join(" "));
  if (body && !body.weak) return body.icon;
  return heading?.icon ?? KIND_ICON[section.kind];
}

/* ------------------------------------------------------------------ */
/* Section -> SlideContent                                              */
/* ------------------------------------------------------------------ */

export type PlanFormat = "slides" | "doc" | "social";

export interface PlanOptions {
  /** Maximum pages (minimum honoured is 3: title + content + closing). */
  pageCount?: number;
  includeQuiz?: boolean;
  includeGlossary?: boolean;
  includeAgenda?: boolean;
  includeObjectives?: boolean;
  format?: PlanFormat;
}

const LABELLED = /^([^:]{2,40}):\s+(.+)$/u;

function labelledItems(bullets: string[]): ContentItem[] | undefined {
  if (bullets.length < 2) return undefined;
  const items = bullets.map((bullet) => {
    const match = LABELLED.exec(bullet);
    return match && countWords(match[1]) <= 5 ? { title: match[1].trim(), body: match[2].trim(), icon: pickIcon(match[1], "") || undefined } : undefined;
  });
  if (items.some((item) => !item)) return undefined;
  return (items as ContentItem[]).map((item) => (item.icon ? item : { title: item.title, body: item.body }));
}

const TIMELINE_ENTRY = /^(.{1,24}?)\s+[—–]\s+(.+)$/u;

function timelineItems(steps: string[]): ContentItem[] {
  return steps.map((step) => {
    const match = TIMELINE_ENTRY.exec(step) ?? /^(.{2,24}?):\s+(.+)$/u.exec(step);
    return match ? { title: match[1].trim(), body: match[2].trim() } : { title: step };
  });
}

function joinNotes(...parts: (string | undefined)[]): string | undefined {
  const text = parts.filter((part): part is string => Boolean(part && part.trim())).join("\n\n");
  return text || undefined;
}

function isSectionEmpty(section: OutlineSection): boolean {
  return (
    !section.bullets.length &&
    !section.body &&
    !section.steps?.length &&
    !section.compare &&
    !section.stat &&
    !section.quote
  );
}

/** Keeps undefined keys out so snapshots/serialisation stay clean. */
function compact<T extends object>(value: T): T {
  for (const key of Object.keys(value) as (keyof T)[]) {
    const item = value[key];
    if (item === undefined || (Array.isArray(item) && item.length === 0)) delete value[key];
  }
  return value;
}

interface SectionSlideOptions {
  /** Documents keep every field on the page; slides keep one list and move extras to notes. */
  keepBody: boolean;
  maxBullets?: number;
  maxSteps?: number;
}

/** Longest body that stays on a slide as a lead line; longer prose goes to speaker notes. */
const LEAD_MAX = 160;

function bulletNotes(bullets: string[]): string | undefined {
  return bullets.length ? bullets.map((bullet) => `• ${bullet}`).join("\n") : undefined;
}

/**
 * Adds a section's secondary material to a slide whose main field is already set.
 * Slides get at most one list field (the layout engine lays out one list and would
 * push any other onto a continuation page), so extra bullets and long prose become
 * speaker notes; documents keep everything on the page.
 */
function withExtras(
  slide: SlideContent,
  section: OutlineSection,
  options: SectionSlideOptions,
  extras: { body?: string; bullets?: string[]; bodyToNotes?: boolean },
): SlideContent {
  const bullets = extras.bullets ?? [];
  if (options.keepBody) {
    return compact({ ...slide, ...(extras.body ? { body: extras.body } : {}), ...(bullets.length ? { bullets } : {}), notes: section.notes });
  }
  const lead = extras.body && !extras.bodyToNotes && Array.from(extras.body).length <= LEAD_MAX ? extras.body : undefined;
  return compact({
    ...slide,
    ...(lead ? { body: lead } : {}),
    notes: joinNotes(section.notes, lead ? undefined : extras.body, bulletNotes(bullets)),
  });
}

function sectionToSlide(section: OutlineSection, strings: ComposeStrings, options: SectionSlideOptions): SlideContent {
  const maxBullets = options.maxBullets ?? 6;
  const bullets = section.bullets.slice(0, maxBullets);
  const steps = section.steps?.slice(0, options.maxSteps ?? 8) ?? [];
  const base: SlideContent = {
    kind: "bullets",
    title: section.heading,
    icon: sectionIcon(section),
    imageQuery: section.imageQuery,
  };
  switch (section.kind) {
    case "concept":
    case "example": {
      const kicker = section.kind === "example" ? strings.example : undefined;
      // Key sentences lifted from the body: slides show them, documents show the full text once.
      const repeats = bulletsRepeatBody(section);
      if (bullets.length >= 2 && !(repeats && options.keepBody)) {
        const items = labelledItems(bullets);
        return withExtras({ ...base, kind: "bullets", kicker, ...(items ? { items } : { bullets }) }, section, options, { body: section.body, bodyToNotes: repeats });
      }
      return compact({ ...base, kind: "concept", kicker, body: section.body ?? bullets[0], bullets: section.body && !repeats ? bullets : [], notes: section.notes });
    }
    case "steps":
      return withExtras({ ...base, kind: "steps", steps: steps.length ? steps : bullets }, section, options, { body: section.body, bullets: steps.length ? bullets : [] });
    case "timeline": {
      const entries = steps.length ? steps : bullets;
      const items = timelineItems(entries);
      const dated = items.filter((item) => item.body).length >= Math.ceil(items.length / 2);
      return withExtras({ ...base, kind: "timeline", ...(dated ? { items } : { steps: entries }) }, section, options, { body: section.body, bullets: steps.length ? bullets : [] });
    }
    case "compare":
      if (!section.compare) return withExtras({ ...base, kind: "bullets", bullets }, section, options, { body: section.body });
      return withExtras({ ...base, kind: "compare", compare: section.compare }, section, options, { body: section.body, bullets });
    case "stat": {
      const extra = bullets.map((bullet) => parseStatLine(bullet)).filter((stat): stat is { value: string; label: string } => Boolean(stat));
      const stats = section.stat ? [section.stat, ...extra].slice(0, 4) : extra.slice(0, 4);
      if (!stats.length) return withExtras({ ...base, kind: "bullets", bullets }, section, options, { body: section.body });
      const rest = bullets.filter((bullet) => !parseStatLine(bullet));
      return withExtras({ ...base, kind: stats.length >= 2 ? "stats" : "stat", stats }, section, options, { body: section.body, bullets: rest });
    }
    case "quote":
      if (!section.quote) return compact({ ...base, kind: "concept", body: section.body ?? bullets[0], bullets: section.body ? bullets : bullets.slice(1), notes: section.notes });
      return withExtras({ ...base, kind: "quote", quote: section.quote }, section, options, { body: section.body, bullets });
    case "question": {
      const isQuestion = (text: string) => /[?？]\s*$/.test(text);
      // Several discussion questions stay visible as a list instead of hiding in speaker notes;
      // a question heading with hint bullets stays one prompt with the hints in the notes.
      if (bullets.length >= 2 && (!isQuestion(section.heading) || bullets.filter(isQuestion).length >= 2)) {
        return withExtras({ ...base, kind: "bullets", icon: libraryIcon(section.icon) ?? PAGE_ICON.question, bullets }, section, options, { body: section.body });
      }
      const prompt = isQuestion(section.heading) ? section.heading : (bullets.find(isQuestion) ?? section.heading);
      return withExtras({ ...base, kind: "question", question: { prompt } }, section, options, { body: section.body, bullets: bullets.filter((bullet) => bullet !== prompt) });
    }
    case "activity":
    case "summary":
      return withExtras({ ...base, kind: section.kind, bullets }, section, options, { body: section.body });
    default:
      return withExtras({ ...base, bullets }, section, options, { body: section.body });
  }
}

/* ------------------------------------------------------------------ */
/* Questions                                                            */
/* ------------------------------------------------------------------ */

const LETTERS = "ABCDEFGH";

/** Matching exercise as two columns: numbered terms and lettered meanings in a seeded order. */
function matchColumns(pairs: [string, string][], prompt: string): { left: string[]; right: string[] } {
  const rights = seededShuffle(
    pairs.map(([, right]) => right),
    hashString(prompt),
  );
  return {
    left: pairs.map(([left], index) => `${index + 1}. ${left}`),
    right: rights.map((right, index) => `${LETTERS[index]}) ${right}`),
  };
}

/** Speaker notes for one question: the draft marker for placeholder slots, then answer and explanation. */
function answerNotes(question: OutlineQuestion, strings: ComposeStrings): string | undefined {
  const answer = answerText(question, strings);
  return joinNotes(question.placeholder ? strings.placeholderQuestion : undefined, answer ? `${strings.answer}: ${answer}` : undefined, question.explanation);
}

/**
 * One question per page. Matching questions become a two-column compare page (terms vs
 * shuffled meanings) so the pairs are never shown together; answers go to speaker notes.
 */
function questionSlide(question: OutlineQuestion, number: number, strings: ComposeStrings): SlideContent {
  const title = strings.question(number);
  if (question.type === "match" && question.pairs?.length) {
    const { left, right } = matchColumns(question.pairs, question.prompt);
    return compact({
      kind: "compare",
      title,
      body: question.prompt,
      icon: PAGE_ICON.question,
      compare: { a: { label: strings.matchTerms, points: left }, b: { label: strings.matchMeanings, points: right } },
      notes: answerNotes(question, strings),
    });
  }
  const content: SlideContent["question"] = { prompt: question.prompt };
  if (question.type === "true_false") {
    content.choices = [strings.trueLabel, strings.falseLabel];
    if (typeof question.answer === "boolean") content.answer = question.answer;
  } else if (question.type === "mcq") {
    if (question.choices?.length) content.choices = [...question.choices];
    if (typeof question.answer === "number" && question.choices?.[question.answer] !== undefined) content.answer = question.answer;
  } else if (typeof question.answer === "string") {
    content.answer = question.answer;
  }
  if (question.explanation) content.explanation = question.explanation;
  return compact({ kind: "question", title, icon: PAGE_ICON.question, question: content, notes: answerNotes(question, strings) });
}

/** Human-readable answer ("B) Precipitation", "True", "Clouds"). */
export function answerText(question: OutlineQuestion, strings: ComposeStrings): string {
  if (question.type === "mcq" && typeof question.answer === "number" && question.choices?.[question.answer] !== undefined) {
    return `${LETTERS[question.answer] ?? question.answer + 1}) ${question.choices[question.answer]}`;
  }
  if (question.type === "true_false" && typeof question.answer === "boolean") return question.answer ? strings.trueLabel : strings.falseLabel;
  if (question.type === "match" && question.pairs?.length) return question.pairs.map(([a, b]) => `${a} → ${b}`).join("; ");
  return typeof question.answer === "string" ? question.answer : "";
}

function quizItem(question: OutlineQuestion, number: number, strings: ComposeStrings): ContentItem {
  const title = `${number}. ${question.prompt}`;
  if (question.type === "mcq" && question.choices?.length) {
    return { title, body: question.choices.map((choice, index) => `${LETTERS[index]}) ${choice}`).join("   ") };
  }
  if (question.type === "true_false") return { title, body: `${strings.trueLabel} / ${strings.falseLabel}` };
  if (question.type === "match" && question.pairs?.length) {
    const { left, right } = matchColumns(question.pairs, question.prompt);
    return { title, body: `${left.join("   ")}\n${right.join("   ")}` };
  }
  return { title };
}

function answerKeyNotes(questions: { question: OutlineQuestion; number: number }[], strings: ComposeStrings): string | undefined {
  const lines = questions
    .map(({ question, number }) => {
      const answer = question.placeholder ? "" : answerText(question, strings);
      return answer ? `${number}. ${answer}` : "";
    })
    .filter(Boolean);
  const drafts = questions.filter(({ question }) => question.placeholder).map(({ number }) => number);
  return joinNotes(
    drafts.length ? `${strings.placeholderQuestion} (${drafts.join(", ")})` : undefined,
    lines.length ? `${strings.answerKey}: ${lines.join(" · ")}` : undefined,
  );
}

function quizPages(questions: OutlineQuestion[], strings: ComposeStrings, perPage: number, startNumber = 1): SlideContent[] {
  const numbered = questions.map((question, index) => ({ question, number: startNumber + index }));
  const pages: SlideContent[] = [];
  for (let index = 0; index < numbered.length; index += perPage) {
    const group = numbered.slice(index, index + perPage);
    pages.push(
      compact({
        kind: "quiz",
        title: strings.quiz,
        icon: PAGE_ICON.quiz,
        items: group.map(({ question, number }) => quizItem(question, number, strings)),
        notes: answerKeyNotes(group, strings),
        continued: index > 0 ? true : undefined,
      }),
    );
  }
  return pages;
}

/* ------------------------------------------------------------------ */
/* Glossary                                                             */
/* ------------------------------------------------------------------ */

function glossaryPages(outline: LessonOutline, strings: ComposeStrings, perPage: number): SlideContent[] {
  const terms = outline.glossary.map(({ term, definition }) => ({ term, definition }));
  if (!terms.length) return [];
  if (terms.length === 1) {
    const [only] = outline.glossary;
    return [compact({ kind: "definition", title: only.term, kicker: strings.keyTerms, terms, body: only.example, icon: PAGE_ICON.definition })];
  }
  const pages: SlideContent[] = [];
  for (let index = 0; index < terms.length; index += perPage) {
    pages.push(compact({ kind: "glossary", title: strings.keyTerms, terms: terms.slice(index, index + perPage), icon: PAGE_ICON.glossary, continued: index > 0 ? true : undefined }));
  }
  return pages;
}

/* ------------------------------------------------------------------ */
/* Slide plan                                                           */
/* ------------------------------------------------------------------ */

type Role = "title" | "agenda" | "objectives" | "content" | "summary" | "recap" | "activity" | "glossary" | "question" | "quiz" | "closing";

interface PlanEntry {
  role: Role;
  content: SlideContent;
  question?: OutlineQuestion;
  section?: OutlineSection;
}

function stripContinuation(heading: string): string {
  return heading.replace(/\s*\(\d+\)$/, "").trim();
}

function uniqueHeadings(sections: OutlineSection[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const section of sections) {
    const heading = stripContinuation(section.heading);
    const key = foldText(heading);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(heading);
  }
  return out;
}

function summaryText(section: OutlineSection): string {
  const source =
    section.body?.split(/(?<=[.!?])\s+/)[0] ??
    (section.steps?.length ? section.steps.slice(0, 3).map((step) => step.replace(/[.;]+$/, "")).join("; ") : undefined) ??
    (section.compare ? `${section.compare.a.label} / ${section.compare.b.label}` : undefined) ??
    (section.stat ? `${section.stat.value} ${section.stat.label}` : undefined) ??
    (section.quote ? section.quote.text : undefined) ??
    section.bullets.slice(0, 2).map((bullet) => bullet.replace(/[.;]+$/, "")).join("; ");
  return clampText(source || section.heading, 140);
}

function entryWeight(entry: PlanEntry): number {
  const content = entry.content;
  const text = [
    content.title,
    content.body,
    ...(content.bullets ?? []),
    ...(content.steps ?? []),
    ...(content.items ?? []).map((item) => `${item.title} ${item.body ?? ""}`),
    ...(content.compare ? [...content.compare.a.points, ...content.compare.b.points] : []),
  ].join(" ");
  return countWords(text);
}

function mergedTitle(titles: string[]): string {
  const unique = [...new Set(titles.map(stripContinuation))];
  const joined = unique.length <= 2 ? unique.join(" & ") : `${unique.slice(0, -1).join(", ")} & ${unique[unique.length - 1]}`;
  return clampText(joined, 70);
}

/** Merged overview pages show this many section cards; the rest go to speaker notes. */
const MERGED_ITEMS = 6;

/** Everything a section card leaves out, under the section heading, so merging never drops text. */
function sectionDetailNotes(section: OutlineSection): string | undefined {
  const lines = [
    ...(section.steps ?? []),
    ...section.bullets,
    ...(section.compare ? [section.compare.a, section.compare.b].flatMap((side) => side.points.map((point) => `${side.label}: ${point}`)) : []),
    ...(section.stat ? [`${section.stat.value} ${section.stat.label}`.trim()] : []),
    ...(section.quote ? [section.quote.author ? `“${section.quote.text}” — ${section.quote.author}` : `“${section.quote.text}”`] : []),
  ];
  const detail = joinNotes(section.body, bulletNotes(lines));
  return joinNotes(section.notes, detail ? `${stripContinuation(section.heading)}:\n${detail}` : undefined);
}

/** A section entry's notes are rebuilt from the section (a superset of its slide notes); merged pages keep theirs. */
function entryNotes(entry: PlanEntry): string | undefined {
  return entry.section ? sectionDetailNotes(entry.section) : entry.content.notes;
}

function mergeContentEntries(a: PlanEntry, b: PlanEntry): PlanEntry {
  const toItems = (entry: PlanEntry): ContentItem[] =>
    entry.role === "content" && entry.content.kind === "bullets" && entry.content.items && !entry.section
      ? entry.content.items
      : [{ title: stripContinuation(entry.content.title), body: entry.section ? summaryText(entry.section) : entry.content.body ?? entry.content.bullets?.join("; "), icon: entry.content.icon }];
  const items = [...toItems(a), ...toItems(b)].map((item) => compact({ ...item }));
  const shown = items.slice(0, MERGED_ITEMS);
  const hidden = bulletNotes(items.slice(MERGED_ITEMS).map((item) => (item.body ? `${item.title}: ${item.body}` : item.title)));
  return {
    role: "content",
    content: compact({
      kind: "bullets",
      title: mergedTitle(items.map((item) => item.title)),
      items: shown,
      icon: a.content.icon,
      imageQuery: a.content.imageQuery ?? b.content.imageQuery,
      notes: joinNotes(entryNotes(a), entryNotes(b), hidden),
    }),
  };
}

function reduceToLimit(entries: PlanEntry[], limit: number, strings: ComposeStrings, questionsPerPage: number): PlanEntry[] {
  let pages = [...entries];
  const over = () => pages.length > limit;
  const drop = (role: Role) => {
    if (over()) pages = pages.filter((entry) => entry.role !== role);
  };

  drop("agenda");
  drop("recap");

  if (over() && pages.some((entry) => entry.role === "question")) {
    const questions = pages.filter((entry) => entry.role === "question" && entry.question).map((entry) => entry.question as OutlineQuestion);
    const quiz = quizPages(questions, strings, questionsPerPage).map((content) => ({ role: "quiz" as const, content }));
    const withoutQuestions = pages.filter((entry) => entry.role !== "question");
    const anchor = withoutQuestions.findIndex((entry) => entry.role === "summary" || entry.role === "closing");
    const at = anchor >= 0 ? anchor : withoutQuestions.length;
    pages = [...withoutQuestions.slice(0, at), ...quiz, ...withoutQuestions.slice(at)];
  }

  if (over() && pages.filter((entry) => entry.role === "glossary").length > 1) {
    const glossary = pages.filter((entry) => entry.role === "glossary");
    const terms = glossary.flatMap((entry) => entry.content.terms ?? []).slice(0, 8);
    const first = pages.indexOf(glossary[0]);
    const merged: PlanEntry = { role: "glossary", content: { ...glossary[0].content, terms, continued: undefined } };
    pages = pages.filter((entry) => entry.role !== "glossary");
    pages.splice(first, 0, compactEntry(merged));
  }

  drop("activity");
  drop("objectives");

  if (over() && pages.filter((entry) => entry.role === "quiz").length > 1) {
    const quiz = pages.filter((entry) => entry.role === "quiz");
    pages = pages.filter((entry) => entry.role !== "quiz" || entry === quiz[0]);
  }
  drop("quiz");
  drop("glossary");

  if (over() && pages.some((entry) => entry.role === "content")) drop("summary");

  while (over()) {
    const content = pages.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.role === "content" || entry.role === "summary");
    if (content.length < 2) break;
    let best = -1;
    let bestWeight = Infinity;
    for (let index = 0; index < content.length - 1; index += 1) {
      const weight = entryWeight(content[index].entry) + entryWeight(content[index + 1].entry);
      if (weight < bestWeight) {
        bestWeight = weight;
        best = index;
      }
    }
    const [left, right] = [content[best], content[best + 1]];
    const merged = mergeContentEntries(left.entry, right.entry);
    pages = pages.filter((_, index) => index !== right.index);
    pages[left.index] = merged;
  }

  // Degenerate outlines (no content at all) still end up title + closing only.
  return pages.slice(0, Math.max(limit, 2));
}

function compactEntry(entry: PlanEntry): PlanEntry {
  return { ...entry, content: compact(entry.content) };
}

function isPlaceholderSection(outline: LessonOutline, section: OutlineSection): boolean {
  return outline.sections.length === 1 && isSectionEmpty(section) && foldText(section.heading) === foldText(outline.title);
}

/**
 * Orders an outline into semantic pages: title → agenda (≥4 sections) → objectives →
 * warm-up questions → sections (each followed by its check questions) → activities →
 * glossary → final questions → summary (or a synthesized recap) → closing.
 * `pageCount` is a maximum: optional pages are dropped and small sections merged to fit.
 */
export function planSlides(outline: LessonOutline, options: PlanOptions = {}): SlideContent[] {
  const format = options.format ?? "slides";
  if (format === "doc") return planDocument(outline, { includeQuiz: options.includeQuiz, includeGlossary: options.includeGlossary });
  // NaN or ±Infinity mean "no limit" rather than an empty deck.
  const pageCount = typeof options.pageCount === "number" && Number.isFinite(options.pageCount) ? options.pageCount : undefined;
  const strings = composeStrings(outline.language);
  const social = format === "social";
  const includeQuiz = options.includeQuiz ?? true;
  const includeGlossary = options.includeGlossary ?? !social;
  const sectionOptions: SectionSlideOptions = social ? { keepBody: false, maxBullets: 3, maxSteps: 5 } : { keepBody: false };

  const sections = outline.sections.filter((section) => !isPlaceholderSection(outline, section));
  const contentSections = sections.filter((section) => section.kind !== "summary");
  const summarySections = sections.filter((section) => section.kind === "summary");
  const entries: PlanEntry[] = [];

  entries.push({
    role: "title",
    content: compact({
      kind: "title",
      title: outline.title,
      subtitle: outline.subtitle,
      kicker: outline.audience,
      icon: social ? PAGE_ICON.social : PAGE_ICON.title,
      imageQuery: contentSections[0]?.imageQuery ?? clampText(outline.title, 80),
    }),
  });

  if (!social && (options.includeAgenda ?? true) && uniqueHeadings(contentSections).length >= 4) {
    entries.push({
      role: "agenda",
      content: {
        kind: "agenda",
        title: strings.agenda,
        icon: PAGE_ICON.agenda,
        items: uniqueHeadings(contentSections).map((heading) => {
          const source = contentSections.find((section) => stripContinuation(section.heading) === heading);
          return { title: heading, icon: source ? sectionIcon(source) : undefined };
        }).map((item) => compact(item)),
      },
    });
  }

  if (!social && (options.includeObjectives ?? true) && outline.objectives.length) {
    entries.push({ role: "objectives", content: { kind: "bullets", title: strings.objectives, bullets: [...outline.objectives], icon: PAGE_ICON.objectives } });
  }

  const questions = includeQuiz ? outline.questions : [];
  const sectionIndex = new Map(outline.sections.map((section, index) => [section, index]));
  const bySection = new Map<number, OutlineQuestion[]>();
  const diagnostic: OutlineQuestion[] = [];
  const closingQuestions: OutlineQuestion[] = [];
  for (const question of questions) {
    if (question.purpose === "diagnostic") diagnostic.push(question);
    else if (question.purpose === "check" && question.section !== undefined && sections.includes(outline.sections[question.section])) {
      const list = bySection.get(question.section) ?? [];
      list.push(question);
      bySection.set(question.section, list);
    } else closingQuestions.push(question);
  }
  let questionNumber = 0;
  const pushQuestion = (question: OutlineQuestion) => {
    questionNumber += 1;
    entries.push({ role: "question", question, content: questionSlide(question, questionNumber, strings) });
  };

  if (social) {
    for (const section of contentSections) entries.push({ role: "content", section, content: sectionToSlide(section, strings, sectionOptions) });
    const pick = questions.find((question) => !question.placeholder && (question.type === "mcq" || question.type === "true_false"));
    if (pick) pushQuestion(pick);
    for (const section of summarySections) entries.push({ role: "summary", section, content: sectionToSlide(section, strings, sectionOptions) });
    entries.push({ role: "closing", content: { kind: "closing", title: strings.socialClosing, subtitle: outline.title, icon: PAGE_ICON.closing } });
    const limit = Math.max(3, Math.floor(pageCount ?? 10));
    return reduceToLimit(entries, limit, strings, 4).map((entry) => entry.content);
  }

  diagnostic.forEach(pushQuestion);
  for (const section of contentSections) {
    entries.push({ role: "content", section, content: sectionToSlide(section, strings, sectionOptions) });
    const index = sectionIndex.get(section);
    if (index !== undefined) bySection.get(index)?.forEach(pushQuestion);
  }

  outline.activities.forEach((activity) => {
    entries.push({
      role: "activity",
      content: compact({ kind: "activity", title: strings.activity[activity.kind], body: activity.prompt, bullets: activity.items ? [...activity.items] : undefined, icon: KIND_ICON.activity }),
    });
  });

  if (includeGlossary) glossaryPages(outline, strings, 6).forEach((content) => entries.push({ role: "glossary", content }));

  closingQuestions.forEach(pushQuestion);

  if (summarySections.length) {
    for (const section of summarySections) {
      entries.push({ role: "summary", section, content: sectionToSlide(section, strings, sectionOptions) });
      const index = sectionIndex.get(section);
      if (index !== undefined) bySection.get(index)?.forEach(pushQuestion);
    }
  } else if (uniqueHeadings(contentSections).length >= 3) {
    entries.push({ role: "recap", content: { kind: "summary", title: strings.recap, bullets: uniqueHeadings(contentSections).slice(0, 6), icon: PAGE_ICON.recap } });
  }

  entries.push({ role: "closing", content: compact({ kind: "closing", title: strings.closing, subtitle: outline.title, icon: PAGE_ICON.closing }) });

  if (pageCount === undefined) return entries.map((entry) => entry.content);
  const limit = Math.max(3, Math.floor(pageCount));
  return reduceToLimit(entries, limit, strings, 4).map((entry) => entry.content);
}

/**
 * How many outline sections to ask for so a deck lands near `pageCount` pages once
 * title, objectives, quiz, glossary, summary and closing pages are added.
 */
export function suggestSectionCount(pageCount: number, options: { includeQuiz?: boolean; includeGlossary?: boolean; format?: PlanFormat } = {}): number {
  const pages = Number.isFinite(pageCount) ? Math.max(1, Math.floor(pageCount)) : 10;
  if (options.format === "social") return Math.min(8, Math.max(1, pages - 2));
  // Each threshold adds one page so the result never decreases as pageCount grows.
  let overhead = 2; // title, closing
  if (pages >= 5) overhead += 1; // objectives
  if (options.includeQuiz ?? true) {
    if (pages >= 6) overhead += 1; // first quiz page
    if (pages >= 12) overhead += 1; // second quiz page
  }
  if ((options.includeGlossary ?? true) && pages >= 8) overhead += 1;
  if (pages >= 10) overhead += 1; // agenda
  return Math.min(24, Math.max(1, pages - overhead));
}

/* ------------------------------------------------------------------ */
/* Document plan (portrait: article, worksheet, Cornell notes)          */
/* ------------------------------------------------------------------ */

export type DocVariant = "article" | "worksheet" | "cornell" | "answer-key";

export type PlannedDocPage = SlideContent & { variant: DocVariant };

const DOC_LAYOUT: Record<DocVariant, string> = {
  article: "doc-article",
  worksheet: "doc-worksheet",
  cornell: "doc-cornell",
  "answer-key": "doc-article",
};

/** Layout id per planned doc page, for `composeDeck({ layoutHints })`. */
export function docLayoutHints(pages: readonly Pick<PlannedDocPage, "variant">[]): string[] {
  return pages.map((page) => DOC_LAYOUT[page.variant]);
}

export interface DocumentPlanOptions {
  /** Cornell notes: sections become cue → note pairs with a blank summary area. */
  cornell?: boolean;
  includeQuiz?: boolean;
  includeGlossary?: boolean;
  /** Adds an answer-key page after the worksheet (default true). */
  answerKey?: boolean;
}

function cornellCue(text: string): string {
  const labelled = LABELLED.exec(text);
  if (labelled && countWords(labelled[1]) <= 5) return labelled[1].trim();
  const dated = TIMELINE_ENTRY.exec(text);
  if (dated) return dated[1].trim();
  const subject = /^(?:the |a |an |el |la |los |las |le |les |un |una |une )?(.{2,40}?)\s(?:is|are|es|son|est|sont|means|refers to)\s/iu.exec(text);
  if (subject && countWords(subject[1]) <= 4 && !/^(?:it|this|that|these|they|there)$/i.test(subject[1])) return subject[1].charAt(0).toLocaleUpperCase() + subject[1].slice(1);
  const words = text.replace(/[.!?]+$/, "").split(/\s+/);
  return clampText(words.slice(0, 4).join(" "), 40);
}

/** Cornell cue/note page, or undefined when the section has fewer than two notes to cue. */
function cornellPage(section: OutlineSection): PlannedDocPage | undefined {
  if (section.kind === "summary" || section.kind === "question") return undefined;
  const notes = [
    ...(section.steps ?? []),
    ...section.bullets,
    ...(section.compare ? [...section.compare.a.points.map((point) => `${section.compare?.a.label}: ${point}`), ...section.compare.b.points.map((point) => `${section.compare?.b.label}: ${point}`)] : []),
    ...(section.stat ? [`${section.stat.value} ${section.stat.label}`] : []),
    ...(section.quote ? [section.quote.author ? `“${section.quote.text}” — ${section.quote.author}` : `“${section.quote.text}”`] : []),
  ];
  const source = notes.length ? notes : section.body ? section.body.split(/(?<=[.!?])\s+/).slice(0, 6) : [];
  if (source.length < 2) return undefined;
  return compact<PlannedDocPage>({
    variant: "cornell",
    kind: "concept",
    title: section.heading,
    icon: sectionIcon(section),
    items: source.map((note) => ({ title: cornellCue(note), body: note })),
    notes: joinNotes(section.notes, section.body),
  });
}

/**
 * Portrait document plan: a title block with objectives, one article (or Cornell) block
 * per section, key terms, a worksheet of questions (6 per page, answers in notes) and an
 * optional answer key. No closing page.
 */
export function planDocument(outline: LessonOutline, options: DocumentPlanOptions = {}): PlannedDocPage[] {
  const strings = composeStrings(outline.language);
  const pages: PlannedDocPage[] = [];
  const sections = outline.sections.filter((section) => !isPlaceholderSection(outline, section));
  const ordered = [...sections.filter((section) => section.kind !== "summary"), ...sections.filter((section) => section.kind === "summary")];

  pages.push(
    compact({
      variant: "article",
      kind: "title",
      title: outline.title,
      subtitle: outline.subtitle,
      kicker: outline.audience,
      bullets: [...outline.objectives],
      icon: PAGE_ICON.title,
    }),
  );

  for (const section of ordered) {
    pages.push((options.cornell ? cornellPage(section) : undefined) ?? { variant: "article", ...sectionToSlide(section, strings, { keepBody: true }) });
  }

  if (options.includeGlossary ?? true) {
    for (const content of glossaryPages(outline, strings, 12)) pages.push({ variant: "article", ...content });
  }

  const questions = (options.includeQuiz ?? true) ? outline.questions : [];
  if (questions.length) {
    for (const content of quizPages(questions, strings, 6)) pages.push({ variant: "worksheet", ...content });
    if (options.answerKey ?? true) {
      const lines = questions.map((question, index) => {
        const answer = question.placeholder ? "" : answerText(question, strings);
        return answer ? `${index + 1}. ${answer}` : "";
      });
      if (lines.some(Boolean)) {
        pages.push({ variant: "answer-key", kind: "bullets", title: strings.answerKey, bullets: lines.filter(Boolean), icon: PAGE_ICON.answerKey });
      }
    }
  }
  return pages;
}
