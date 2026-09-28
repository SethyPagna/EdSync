import { normalizeLessonAuthoringContent } from "@/lib/content/section-library";
import type { LessonOutline, OutlineQuestion, OutlineSection, OutlineSectionKind } from "./types";
import {
  BLANK,
  OUTLINE_LIMITS,
  blankOut,
  capitalize,
  clampText,
  composeLocale,
  composeStrings,
  countWords,
  decodeEntities,
  foldText,
  hashString,
  looksLikeHtml,
  normalizeLanguage,
  normalizeOutline,
  parseBooleanAnswer,
  parseBooleanWord,
  parseStatLine,
  seededShuffle,
  stripEmphasis,
  titleAsSubject,
} from "./outline";

/* ------------------------------------------------------------------ */
/* Language & keywords                                                  */
/* ------------------------------------------------------------------ */

const STOPWORD_LISTS = [
  "a about above after again against all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its itself just let may me might more most must my no nor not now of off on once one only or other our ours out over own same she should so some such than that the their theirs them then there these they this those through to too two under until up upon use used uses using very was we were what when where which while who whom whose why will with within would yet you your yours",
  "al algo algunas algunos ante antes aquel cada como con contra cual cuando de del desde donde durante e el ella ellas ellos en entre era eran es esa esas ese eso esos esta estaba estado estan están estar este esto estos fue fueron ha han hasta hay la las le les lo los mas más me mi mientras muy mucho muchos ni no nos o otra otras otro otros para pero poco por porque puede pueden que qué quien se según ser si sí sin sobre son su sus también tan tanto te tiene tienen todo todos tu tus un una uno unos y ya yo",
  "à au aux avec ce ces cet cette comme dans de des du elle elles en est et été être eu il ils je la le les leur leurs lui mais me même mes moi mon ne nos notre nous on ont ou où par pas peu peut peuvent plus pour qu que quel quelle qui sa sans se ses si son sont sur ta te tes toi ton tous tout toute toutes tu un une vos votre vous y aussi chaque entre",
];

export const STOPWORDS = new Set(STOPWORD_LISTS.flatMap((list) => list.split(/\s+/)));

const LANGUAGE_MARKERS: Record<"en" | "es" | "fr", Set<string>> = {
  en: new Set("the and is are of to with that this for it from by which was were be have has".split(" ")),
  es: new Set("el los las del que es y para con una por como más pero sus son también se lo al".split(" ")),
  fr: new Set("le les des est et du une pour avec dans qui sur pas au sont ce cette aux ou être".split(" ")),
};

/** Cheap en/es/fr detector over function words; undefined when unsure. */
export function detectLanguage(text: string): "en" | "es" | "fr" | undefined {
  const words = text.toLowerCase().match(/[\p{L}]+/gu) ?? [];
  const scores = { en: 0, es: 0, fr: 0 };
  for (const word of words) {
    for (const code of ["en", "es", "fr"] as const) if (LANGUAGE_MARKERS[code].has(word)) scores[code] += 1;
  }
  scores.es += (text.match(/[¿¡ñ]/g)?.length ?? 0) * 2;
  scores.fr += (text.match(/[çœèêëîïûù]/g)?.length ?? 0);
  const ranked = (Object.entries(scores) as ["en" | "es" | "fr", number][]).sort((a, b) => b[1] - a[1]);
  return ranked[0][1] >= 2 && ranked[0][1] > ranked[1][1] ? ranked[0][0] : undefined;
}

/** Lowercase content words (≥3 letters, no stopwords, elisions removed). */
export function keywordTokens(text: string): string[] {
  return (stripEmphasis(text).toLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) ?? [])
    .map((word) => word.replace(/^(?:l|d|j|m|n|s|t|c|qu)['’]/u, ""))
    .filter((word) => Array.from(word).length >= 3 && !STOPWORDS.has(word) && !/^\d+$/.test(word));
}

/** Frequency-ranked keywords, ties broken by first appearance. */
export function extractKeywords(text: string, limit = 8): string[] {
  const counts = new Map<string, number>();
  for (const word of keywordTokens(text)) counts.set(word, (counts.get(word) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

/* ------------------------------------------------------------------ */
/* Sentences                                                            */
/* ------------------------------------------------------------------ */

const ABBREVIATIONS = new Set(
  "e.g i.e etc vs dr mr mrs ms prof st sr sra srta dra jr no nº fig approx ca cf ej p.ej pág pp vol ed art cap núm av mme mlle env ex al inc ltd co dept est min max".split(" "),
);

/** Splits prose into sentences, guarding abbreviations, initials and decimals. */
export function splitSentences(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const sentences: string[] = [];
  const boundary = /[.!?…]+["'”’»)]*\s+(?=["'“‘«(¿¡]?[\p{Lu}\p{N}])/gu;
  let start = 0;
  let match: RegExpExecArray | null;
  while ((match = boundary.exec(clean))) {
    const before = clean.slice(start, match.index + 1);
    const lastWord = /([\p{L}.]+)[.]$/u.exec(before)?.[1]?.toLowerCase() ?? "";
    const isAbbreviation =
      match[0].startsWith(".") &&
      (ABBREVIATIONS.has(lastWord) || /^\p{L}$/u.test(lastWord) || /^(?:\p{L}\.)+\p{L}$/u.test(lastWord));
    if (isAbbreviation) continue;
    const end = match.index + match[0].trimEnd().length;
    sentences.push(clean.slice(start, end).trim());
    start = match.index + match[0].length;
  }
  const tail = clean.slice(start).trim();
  if (tail) sentences.push(tail);
  return sentences;
}

/* ------------------------------------------------------------------ */
/* Line model                                                           */
/* ------------------------------------------------------------------ */

type LineKind = "blank" | "rule" | "heading" | "item" | "choice" | "question" | "answer" | "quote" | "table" | "text";

interface Line {
  kind: LineKind;
  text: string;
  indent: number;
  level?: number;
  ordered?: boolean;
  correct?: boolean;
  cells?: string[];
  explicit?: boolean;
  /** Item introduced by an em/en dash (quote attribution "— Author"). */
  dash?: boolean;
  /** Choice lines keep the original line so a stray "E. coli …" can be read again as text. */
  raw?: string;
  /** Quote lines written as `"…" — Author` on one line. */
  author?: string;
}

const CORRECT_MARK = /\s*(?:\(correct\)|\(correcta\)|\(correcte\)|\*|✓|✔|\[x\])\s*$/i;
const TF_START = /^(?:true or false|true\/false|t\/f|verdadero o falso|v\/f|vrai ou faux)\s*[:?.\-–—]\s*/i;
const QUOTED_LINE = /^((?:"[^"]+"|“[^”]+”|«[^»]+»|„[^”]+”))(?:\s+[—–-]\s*(.{2,60}))?$/u;

function classify(rawLine: string, allowChoice = true): Line {
  const raw = rawLine.replace(/\s+$/, "");
  const text = raw.trim();
  const indent = raw.length - raw.trimStart().length;
  if (!text) return { kind: "blank", text: "", indent };
  if (/^([-*_=])(?:\s*\1){2,}$/.test(text)) return { kind: "rule", text: "", indent };
  if ((text.match(/[\p{L}\p{N}]/gu)?.length ?? 0) < 2) return { kind: "blank", text: "", indent };
  let match: RegExpExecArray | null;
  if ((match = /^(#{1,6})\s+(.+?)\s*#*$/.exec(text))) return { kind: "heading", text: match[2], level: match[1].length, indent, explicit: true };
  if ((match = /^(?:slide|diapositiva|diapo)\s*\d+\s*(?:[:.\-–—]\s*(.*))?$/i.exec(text))) {
    // A bare "Slide 2" only marks a boundary; it is never a title or heading.
    const heading = match[1]?.trim();
    return heading ? { kind: "heading", text: heading, level: 2, indent, explicit: true } : { kind: "rule", text: "", indent };
  }
  if ((match = /^(?:\*\*|__)([^*_]{2,80})(?:\*\*|__):?$/.exec(text))) return { kind: "heading", text: match[1], level: 3, indent, explicit: true };
  if ((match = /^(?:q\d*|question\s*\d*|pregunta\s*\d*)\s*[:.)]\s*(.+)$/i.exec(text))) return { kind: "question", text: match[1], indent };
  if ((match = /^(?:a\d*\s*:|a\d+[.)]|(?:answer|ans|correct answer|respuesta correcta|respuesta|bonne réponse|réponse)\s*\d*\s*[:.)\-–—])\s*(.+)$/i.exec(text))) {
    return { kind: "answer", text: match[1], indent };
  }
  if (allowChoice && (match = /^(\*\s*)?\(?([a-fA-F])[.)]\s+(.+)$/.exec(text))) {
    const correct = Boolean(match[1]) || CORRECT_MARK.test(match[3]);
    return { kind: "choice", text: match[3].replace(CORRECT_MARK, "").trim(), level: match[2].toLowerCase().charCodeAt(0) - 97, correct, indent, raw: rawLine };
  }
  if ((match = /^>\s?(.*)$/.exec(text))) return { kind: "quote", text: match[1], indent };
  if ((match = QUOTED_LINE.exec(text)) && (match[2] || countWords(match[1]) >= 2)) {
    return { kind: "quote", text: match[1], ...(match[2] ? { author: match[2].trim() } : {}), indent };
  }
  if (text.includes("|")) {
    if (/^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(text)) return { kind: "blank", text: "", indent };
    const cells = text.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
    if (cells.filter(Boolean).length >= 2) return { kind: "table", text, cells, indent };
  }
  if ((match = /^(?:step|paso|étape|etapa)\s*\d{1,3}\s*[:.)\-–—]\s*(.+)$/i.exec(text))) return { kind: "item", text: match[1], ordered: true, indent };
  if ((match = /^(?:\d{1,3}[.)]|\(\d{1,3}\))\s+(.+)$/.exec(text))) return { kind: "item", text: match[1], ordered: true, indent };
  if ((match = /^([-*+•◦▪‣·●○■□➢➤►▸✓✔–—]|\[[ xX✓]?\])\s+(.+)$/u.exec(text))) {
    return { kind: "item", text: match[2], ordered: false, indent, dash: match[1] === "—" || match[1] === "–" };
  }
  return { kind: "text", text, indent };
}

function isQuestionCandidate(line: Line): boolean {
  if (line.kind === "question") return true;
  return (line.kind === "text" || line.kind === "item") && (/[?？]\s*$/.test(line.text) || TF_START.test(line.text) || /_{3,}/.test(line.text));
}

/** True when the choice at `index` sits in a run of 2+ adjacent choice lines lettered a, b, c… in order. */
function inLetteredRun(lines: Line[], index: number): boolean {
  let start = index;
  while (start > 0 && lines[start - 1].kind === "choice") start -= 1;
  let end = index;
  while (end + 1 < lines.length && lines[end + 1].kind === "choice") end += 1;
  if (end === start) return false;
  for (let at = start; at <= end; at += 1) if (lines[at].level !== at - start) return false;
  return true;
}

/**
 * "X. …" lines stay choices only after a question (blank lines allowed), right after another
 * choice, or in a run lettered a, b, c…; anything else ("E. coli lives in the gut.",
 * "A. Lincoln …") is read again as an ordinary line.
 */
function demoteStrayChoices(lines: Line[]): Line[] {
  const out: Line[] = [];
  lines.forEach((line, index) => {
    if (line.kind !== "choice") {
      out.push(line);
      return;
    }
    let before = index - 1;
    while (before >= 0 && out[before].kind === "blank") before -= 1;
    const afterQuestion = before >= 0 && isQuestionCandidate(out[before]);
    const afterChoice = out[index - 1]?.kind === "choice";
    out.push(afterQuestion || afterChoice || inLetteredRun(lines, index) ? line : classify(line.raw ?? line.text, false));
  });
  return out;
}

function isAllCaps(text: string): boolean {
  const letters = text.match(/\p{L}/gu) ?? [];
  return letters.length >= 3 && !/\p{Ll}/u.test(text) && /\p{Lu}/u.test(text);
}

function promoteImplicitHeadings(lines: Line[]): void {
  lines.forEach((line, index) => {
    if (line.kind !== "text") return;
    const previous = lines[index - 1];
    const next = lines[index + 1];
    const words = countWords(line.text);
    const afterBreak = !previous || previous.kind === "blank" || previous.kind === "rule";
    const nextIsContent = Boolean(next) && !["blank", "heading", "rule"].includes(next.kind);
    const nextStartsUpper = Boolean(next) && (next.kind !== "text" || /^[\p{Lu}\p{N}¿¡"“«(]/u.test(next.text));
    // "Ecosystem: a community …" followed by more term lines is a vocabulary list, not a heading.
    const startsTermRun = next?.kind === "text" && Boolean(termFromLine(line.text)) && Boolean(termFromLine(next.text));
    if (/^[^:]{2,60}:$/.test(line.text) && words <= 8 && nextIsContent && !/[?]/.test(line.text)) {
      Object.assign(line, { kind: "heading", text: line.text.slice(0, -1).trim(), level: 3 });
    } else if (isAllCaps(line.text) && words <= 10 && line.text.length <= 70 && afterBreak) {
      Object.assign(line, { kind: "heading", level: 2 });
    } else if (
      words <= 8 &&
      line.text.length <= 60 &&
      !/[.!?;,:…]$/.test(line.text) &&
      /^[\p{Lu}\p{N}¿¡"“«]/u.test(line.text) &&
      afterBreak &&
      nextIsContent &&
      nextStartsUpper &&
      !startsTermRun
    ) {
      Object.assign(line, { kind: "heading", level: 3 });
    }
  });
}

/* ------------------------------------------------------------------ */
/* Keyword lists (matched on accent-folded text)                        */
/* ------------------------------------------------------------------ */

const HEADING_WORDS = {
  summary: ["summary", "recap", "conclusion", "conclusions", "key takeaways", "takeaways", "in summary", "wrap up", "review", "key points", "resumen", "conclusiones", "repaso", "ideas clave", "puntos clave", "resume", "recapitulatif", "en resume", "bilan", "a retenir", "points cles"],
  activity: ["activity", "activities", "practice", "exercise", "exercises", "task", "try it", "your turn", "discussion", "discuss", "reflect", "reflection", "debate", "think pair share", "group work", "actividad", "actividades", "practica", "ejercicio", "ejercicios", "tarea", "discusion", "reflexion", "activite", "activites", "exercice", "exercices", "pratique", "tache", "debat"],
  glossary: ["glossary", "vocabulary", "key terms", "key vocabulary", "definitions", "terms", "glosario", "vocabulario", "terminos clave", "definiciones", "glossaire", "vocabulaire", "mots cles", "definitions", "lexique"],
  objectives: ["objectives", "learning objectives", "goals", "learning goals", "aims", "outcomes", "learning outcomes", "you will learn", "objetivos", "objetivos de aprendizaje", "metas", "objectifs", "objectifs d apprentissage", "buts"],
  steps: ["steps", "step by step", "procedure", "process", "how to", "method", "instructions", "directions", "pasos", "paso a paso", "procedimiento", "proceso", "como", "instrucciones", "metodo", "etapes", "procedure", "processus", "comment", "methode", "mode operatoire"],
  final: ["quiz", "test", "exam", "final", "exit ticket", "exit", "assessment", "evaluacion", "examen", "prueba", "evaluation", "controle"],
  diagnostic: ["warm up", "warmup", "pre test", "pretest", "diagnostic", "do now", "starter", "activacion", "diagnostico", "echauffement", "diagnostique"],
  examples: ["eg", "example", "examples", "for example", "for instance", "worked example", "case study", "ejemplo", "ejemplos", "por ejemplo", "caso practico", "exemple", "exemples", "par exemple", "etude de cas"],
  compareLead: ["differences between", "difference between", "comparing", "comparison of", "compare", "contrast", "diferencias entre", "comparacion de", "comparar", "differences entre", "comparaison de", "comparer"],
};

const COMPARE_CUES = ["vs", "versus", "compared to", "compared with", "comparison", "contrast", "difference between", "differences between", "frente a", "comparado con", "comparacion", "diferencias entre", "par rapport a", "comparaison", "differences entre"];

function startsWithAny(text: string, words: string[]): boolean {
  const folded = foldText(text);
  return words.some((word) => folded === word || folded.startsWith(`${word} `));
}

function containsAny(text: string, words: string[]): boolean {
  const folded = ` ${foldText(text)} `;
  return words.some((word) => folded.includes(` ${word} `));
}

const LABEL_WORDS = new Set(
  [
    "example", "examples", "note", "notes", "answer", "question", "q", "a", "tip", "hint", "remember", "warning", "important", "source", "sources", "date", "author", "title", "topic", "objective", "objectives", "goal", "goals", "summary", "definition", "key idea", "main idea", "step", "slide", "activity", "task", "homework", "materials", "time", "duration", "prompt", "discuss", "reflection", "eg", "ie", "true or false", "result", "results", "reason", "problem", "purpose", "aim", "difference", "point",
    "ejemplo", "nota", "respuesta", "pregunta", "consejo", "importante", "fuente", "fecha", "autor", "titulo", "tema", "objetivo", "resumen", "definicion", "paso", "actividad", "tarea", "materiales", "resultado", "razon", "problema", "proposito", "diferencia",
    "exemple", "remarque", "reponse", "conseil", "attention", "auteur", "titre", "sujet", "objectif", "resume", "etape", "activite", "devoir", "materiel", "resultat", "raison", "probleme", "difference",
  ],
);

const PRONOUNS = new Set(["it", "this", "that", "these", "those", "they", "there", "he", "she", "we", "you", "which", "what", "ello", "esto", "eso", "esta", "este", "ce", "cela", "il", "elle", "ils", "elles", "on"]);

/* ------------------------------------------------------------------ */
/* Glossary detection                                                   */
/* ------------------------------------------------------------------ */

interface TermCandidate {
  term: string;
  definition: string;
  sentence?: string;
  example?: string;
  section?: number;
}

function acceptableTerm(term: string): boolean {
  const folded = foldText(term);
  const words = countWords(term);
  return (
    Boolean(folded) &&
    words >= 1 &&
    words <= 4 &&
    Array.from(term).length <= 40 &&
    /^[\p{L}]/u.test(term) &&
    !/[.!?]/.test(term) &&
    !LABEL_WORDS.has(folded) &&
    !STOPWORDS.has(folded) &&
    !PRONOUNS.has(folded.split(" ")[0])
  );
}

function cleanDefinition(text: string): string {
  return capitalize(stripEmphasis(text).trim().replace(/[.;]+$/, ""));
}

function termFromLine(text: string): TermCandidate | undefined {
  const match = /^(.{1,50}?)\s*(?::|：|\s[–—-]\s|\s=\s)\s*(.+)$/u.exec(text);
  if (!match) return undefined;
  const term = stripEmphasis(match[1]).trim();
  const definition = match[2].trim();
  if (!acceptableTerm(term) || countWords(definition) < 3 || /[?]$/.test(definition)) return undefined;
  return { term, definition: cleanDefinition(definition) };
}

const DEFINITION_PATTERNS = [
  /^(?:the |a |an )?(.{2,40}?) (?:is|are) defined as (.+)$/iu,
  /^(?:the |a |an )?(.{2,40}?) refers? to (.+)$/iu,
  /^(?:the |a |an )?(.{2,40}?) means (.+)$/iu,
  /^(?:el |la |los |las |un |una )?(.{2,40}?) se define como (.+)$/iu,
  /^(?:el |la |los |las |un |una )?(.{2,40}?) se refiere a (.+)$/iu,
  /^(?:el |la |los |las |un |una )?(.{2,40}?) significa (.+)$/iu,
  /^(?:le |la |les |l['’]|un |une )?(.{2,40}?) (?:est|sont) défini(?:e|es|s)? comme (.+)$/iu,
  /^(?:le |la |les |l['’]|un |une )?(.{2,40}?) désigne (.+)$/iu,
  /^(?:le |la |les |l['’]|un |une )?(.{2,40}?) signifie (.+)$/iu,
];

const COPULA_PATTERN =
  /^(?:the |an? |el |la |los |las |le |les |l['’]|un |una |une )?(.{2,40}?) (?:is|are|es|son|est|sont) ((?:a|an|the|un|una|el|la|los|las|une|le|les|des|l['’])\s?.+)$/iu;

const BOLD_DEFINITION =
  /\*\*([^*]{2,40})\*\*\s*(?:[:–—-]\s*|,\s+(?=(?:a|an|the|un|una|el|la|une|le)\s)|\s(?:is|are|refers to|means|es|son|significa|est|sont|désigne|signifie)\s+)(.+)$/iu;

const INDEFINITE_START = /^(?:a|an|un|una|une)\s/iu;

/** "<article> <noun> [<adjective>] of/that/de/que …": genus + differentia ("el paso del agua a vapor"). */
const GENUS_DEFINITION =
  /^(?:the|an?|el|la|los|las|un|una|le|les|une|des)\s+(?:[\p{L}'’-]+\s+){1,2}(?:of|for|by|that|which|where|used|de|del|que|por|para|du|des|qui|dont|par|pour)\s/iu;

/**
 * Definition sentences: bold term + definition, "X is defined as / refers to / means"
 * (and es/fr forms), or "X is a/an …" when X is short and is the heading, a known term
 * (bold or repeated proper phrase) or the section's first sentence.
 */
function sentenceDefinition(sentence: string, heading: string, known: Set<string>, first = false): TermCandidate | undefined {
  const plain = stripEmphasis(sentence);
  const bold = BOLD_DEFINITION.exec(sentence);
  if (bold && acceptableTerm(bold[1].trim())) return { term: bold[1].trim(), definition: cleanDefinition(bold[2]), sentence: plain };
  for (const pattern of DEFINITION_PATTERNS) {
    const match = pattern.exec(plain);
    if (match && acceptableTerm(match[1])) return { term: match[1].trim(), definition: cleanDefinition(match[2]), sentence: plain };
  }
  const copula = COPULA_PATTERN.exec(plain);
  if (copula && acceptableTerm(copula[1])) {
    const folded = foldText(copula[1]);
    const headingFolded = foldText(heading);
    const short = countWords(copula[1]) <= 3;
    const headingMatch = Boolean(headingFolded) && (headingFolded === folded || ` ${headingFolded} `.includes(` ${folded} `));
    const indefinite = short && INDEFINITE_START.test(copula[2]) && countWords(plain) <= 30;
    const genus = short && GENUS_DEFINITION.test(copula[2]) && countWords(plain) <= 30;
    if (known.has(folded) || headingMatch || (first && short) || indefinite || genus) {
      return { term: capitalize(copula[1].trim()), definition: cleanDefinition(copula[2]), sentence: plain };
    }
  }
  return undefined;
}

function knownTermsFromText(text: string): Set<string> {
  const known = new Set<string>();
  for (const match of text.matchAll(/\*\*([^*]{2,40})\*\*/g)) known.add(foldText(match[1]));
  const counts = new Map<string, number>();
  for (const match of text.matchAll(/(?<=[\p{Ll},;:][ \t])(\p{Lu}\p{Ll}+(?:[ \t]\p{Lu}\p{Ll}+){0,3})/gu)) {
    const key = foldText(match[1]);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const [key, count] of counts) if (count >= 2) known.add(key);
  return known;
}

/* ------------------------------------------------------------------ */
/* Question extraction                                                  */
/* ------------------------------------------------------------------ */

function nextNonBlank(lines: Line[], from: number): number {
  let index = from;
  while (index < lines.length && lines[index].kind === "blank") index += 1;
  return index;
}

/** Choice text first ("C. difficile", "4"), then a letter ("B", "b)"), then text after a letter prefix. */
function resolveLetterAnswer(answer: string, choices: string[]): number | undefined {
  const text = answer.trim();
  const key = foldText(text);
  const exact = key ? choices.findIndex((choice) => foldText(choice) === key) : -1;
  if (exact >= 0) return exact;
  const letter = /^\(?([a-f])\)?(?:[.):]|\s|$)/i.exec(text);
  if (letter && (text.length <= 3 || /^\(?[a-f][.)]/i.test(text))) {
    const index = letter[1].toLowerCase().charCodeAt(0) - 97;
    if (index < choices.length) return index;
  }
  const folded = foldText(text.replace(/^\(?[a-f][.)]\s+/i, ""));
  const byText = choices.findIndex((choice) => foldText(choice) === folded);
  return byText >= 0 ? byText : undefined;
}

function buildQuestion(prompt: string, choiceLines: Line[], answer: string | undefined, purpose: OutlineQuestion["purpose"]): OutlineQuestion {
  const cleanPrompt = stripEmphasis(prompt).trim();
  const choices = choiceLines.map((line) => stripEmphasis(line.text));
  if (choices.length >= 2) {
    const flagged = choiceLines.findIndex((line) => line.correct);
    const index = flagged >= 0 ? flagged : answer ? resolveLetterAnswer(answer, choices) : undefined;
    const booleans = choices.map((choice) => parseBooleanWord(choice));
    if (choices.length === 2 && booleans[0] !== undefined && booleans[1] !== undefined && booleans[0] !== booleans[1]) {
      const value = index !== undefined ? booleans[index] : answer ? parseBooleanAnswer(answer) : undefined;
      const question: OutlineQuestion = { type: "true_false", prompt: cleanPrompt.replace(TF_START, ""), purpose };
      if (value !== undefined) question.answer = value;
      else question.placeholder = true;
      return question;
    }
    const question: OutlineQuestion = { type: "mcq", prompt: cleanPrompt, choices, purpose };
    if (index !== undefined) question.answer = index;
    else question.placeholder = true;
    return question;
  }
  const booleanAnswer = answer ? parseBooleanAnswer(answer) : undefined;
  if (TF_START.test(cleanPrompt) || (booleanAnswer !== undefined && /^(true|false|verdadero|falso|vrai|faux)\.?$/i.test(answer?.trim() ?? ""))) {
    const question: OutlineQuestion = { type: "true_false", prompt: cleanPrompt.replace(TF_START, ""), purpose };
    if (booleanAnswer !== undefined) question.answer = booleanAnswer;
    else question.placeholder = true;
    return question;
  }
  if (/_{3,}/.test(cleanPrompt) && answer) {
    return { type: "fill_blank", prompt: cleanPrompt.replace(/_{3,}/g, BLANK), answer: stripEmphasis(answer).trim(), purpose };
  }
  const question: OutlineQuestion = { type: "short", prompt: cleanPrompt, purpose };
  if (answer) question.answer = stripEmphasis(answer).trim();
  return question;
}

function extractQuestions(lines: Line[], purpose: OutlineQuestion["purpose"]): { remaining: Line[]; questions: OutlineQuestion[] } {
  const remaining: Line[] = [];
  const questions: OutlineQuestion[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!isQuestionCandidate(line)) {
      remaining.push(line);
      index += 1;
      continue;
    }
    let cursor = nextNonBlank(lines, index + 1);
    const choiceLines: Line[] = [];
    while (cursor < lines.length && lines[cursor].kind === "choice") {
      choiceLines.push(lines[cursor]);
      cursor += 1;
    }
    const answerAt = nextNonBlank(lines, cursor);
    const answerLine = answerAt < lines.length && lines[answerAt].kind === "answer" ? lines[answerAt] : undefined;
    const isBlock = line.kind === "question" || choiceLines.length >= 2 || Boolean(answerLine) || TF_START.test(line.text);
    if (!isBlock) {
      remaining.push(line);
      index += 1;
      continue;
    }
    let answer = answerLine?.text;
    let prompt = line.text;
    const inlineTf = /\s*[(\[—–-]\s*(true|false|verdadero|falso|vrai|faux)\s*[)\]]?\s*$/i.exec(prompt);
    if (!answer && TF_START.test(prompt) && inlineTf) {
      answer = inlineTf[1];
      prompt = prompt.slice(0, inlineTf.index);
    }
    questions.push(buildQuestion(prompt, choiceLines.length >= 2 ? choiceLines : [], answer, purpose));
    if (choiceLines.length === 1) remaining.push(choiceLines[0]);
    index = answerLine ? answerAt + 1 : cursor;
  }
  return { remaining, questions };
}

/* ------------------------------------------------------------------ */
/* Sections                                                             */
/* ------------------------------------------------------------------ */

interface RawSection {
  heading: string;
  lines: Line[];
}

/** Moves a "> quote" block (plus its "— Author" line) out of a section that has other content. */
function splitQuoteBlocks(section: RawSection): RawSection[] {
  const quoteLines: Line[] = [];
  const other: Line[] = [];
  section.lines.forEach((line, index) => {
    const previous = section.lines[index - 1];
    const attribution = previous?.kind === "quote" && (line.dash || (line.kind === "text" && /^[—–]/.test(line.text)));
    if (line.kind === "quote" || attribution) quoteLines.push(attribution && line.kind === "text" ? { ...line, kind: "item", dash: true, text: line.text.replace(/^[—–]\s*/, "") } : line);
    else other.push(line);
  });
  if (!quoteLines.length || !other.some((line) => line.kind !== "blank")) return [section];
  return [{ heading: section.heading, lines: other }, { heading: "", lines: quoteLines }];
}

function splitByHeadings(lines: Line[]): RawSection[] {
  const sections: RawSection[] = [];
  let current: RawSection = { heading: "", lines: [] };
  const flush = () => {
    if (current.heading || current.lines.some((line) => line.kind !== "blank")) sections.push(current);
  };
  for (const line of lines) {
    if (line.kind === "heading") {
      flush();
      current = { heading: line.text, lines: [] };
    } else if (line.kind === "rule") {
      flush();
      current = { heading: "", lines: [] };
    } else current.lines.push(line);
  }
  flush();
  return sections;
}

function blockKind(lines: Line[]): "prose" | "list" | "mixed" {
  const kinds = new Set(lines.filter((line) => line.kind !== "blank").map((line) => line.kind));
  if ([...kinds].every((kind) => kind === "text")) return "prose";
  if ([...kinds].every((kind) => kind === "item")) return "list";
  return "mixed";
}

function blockWords(lines: Line[]): number {
  return lines.reduce((sum, line) => sum + countWords(line.text), 0);
}

/** No explicit boundaries: split on blank-line blocks, then merge short prose and lead-in + list pairs. */
function splitByBlocks(lines: Line[]): RawSection[] {
  const blocks: Line[][] = [];
  let current: Line[] = [];
  for (const line of lines) {
    if (line.kind === "blank") {
      if (current.length) blocks.push(current);
      current = [];
    } else current.push(line);
  }
  if (current.length) blocks.push(current);
  const merged: Line[][] = [];
  for (const block of blocks) {
    const previous = merged[merged.length - 1];
    if (previous) {
      const previousKind = blockKind(previous);
      const kind = blockKind(block);
      const leadIn = previousKind === "prose" && kind === "list";
      const shortProse = previousKind === "prose" && kind === "prose" && blockWords(previous) + blockWords(block) <= 70;
      if (leadIn || shortProse) {
        previous.push({ kind: "blank", text: "", indent: 0 }, ...block);
        continue;
      }
    }
    merged.push([...block]);
  }
  return merged.map((block) => ({ heading: "", lines: block }));
}

function compareLabels(heading: string): [string, string] | undefined {
  let text = stripEmphasis(heading).replace(/[?:.]+$/, "").trim();
  for (const lead of HEADING_WORDS.compareLead) {
    const pattern = new RegExp(`^${lead.replace(/ /g, "\\s+")}\\s+`, "i");
    if (pattern.test(foldText(text))) {
      const words = text.split(/\s+/);
      text = words.slice(lead.split(" ").length).join(" ");
      break;
    }
  }
  const parts = text.split(/\s+(?:vs\.?|versus|v\.|frente a|contra|contre|and|y|et|or|o|ou)\s+/i).map((part) => part.trim()).filter(Boolean);
  if (parts.length !== 2 || parts.some((part) => countWords(part) > 5)) return undefined;
  return [capitalize(parts[0]), capitalize(parts[1])];
}

function labelMatches(text: string, label: string): boolean {
  const folded = ` ${foldText(text)} `;
  const target = foldText(label);
  if (!target) return false;
  const stem = target.length > 5 ? target.slice(0, target.length - 1) : target;
  return folded.includes(` ${target} `) || folded.includes(` ${stem}`);
}

/** Merges "A vs B" + following "A" and "B" subsections into one compare section. */
function mergeCompareSubsections(sections: RawSection[]): RawSection[] {
  const out: RawSection[] = [];
  for (let index = 0; index < sections.length; index += 1) {
    const section = sections[index];
    const labels = containsAny(section.heading, COMPARE_CUES) ? compareLabels(section.heading) : undefined;
    const [first, second] = [sections[index + 1], sections[index + 2]];
    if (
      labels &&
      first &&
      second &&
      section.lines.filter((line) => line.kind !== "blank").length <= 2 &&
      labelMatches(first.heading, labels[0]) &&
      labelMatches(second.heading, labels[1])
    ) {
      const prefixed = (raw: RawSection, label: string): Line[] =>
        raw.lines
          .filter((line) => line.kind === "item" || line.kind === "text")
          .map((line) => ({ kind: "item", text: `${label}: ${line.text}`, indent: 0, ordered: false }));
      out.push({ heading: section.heading, lines: [...section.lines, ...prefixed(first, labels[0]), ...prefixed(second, labels[1])] });
      index += 2;
      continue;
    }
    out.push(section);
  }
  return out;
}

const DATE_PATTERN =
  /(?:^|[^\p{L}\p{N}])((?:1[0-9]{3}|20[0-9]{2})(?:s)?|\d{1,4}\s?(?:BC|BCE|AD|CE|a\.\s?C\.|d\.\s?C\.|av\.\s?J\.-C\.)|\d{1,2}(?:st|nd|rd|th)\s+century|siglo\s+[IVXLC]+|[IVXLC]+e\s+siècle)(?=$|[^\p{L}\p{N}])/iu;

function leadingDate(text: string): { date: string; rest: string } | undefined {
  const split = /^(.{2,24}?)\s*(?:[:–—]|\s-\s|,)\s*(.+)$/u.exec(text);
  if (split && DATE_PATTERN.test(split[1])) return { date: split[1].trim(), rest: split[2].trim() };
  return undefined;
}

function sentenceScore(sentence: string, frequencies: Map<string, number>, headingTokens: Set<string>): number {
  const tokens = keywordTokens(sentence);
  if (!tokens.length) return 0;
  const unique = new Set(tokens);
  let score = 0;
  for (const token of unique) score += (frequencies.get(token) ?? 0) + (headingTokens.has(token) ? 2 : 0);
  return score / Math.sqrt(tokens.length);
}

function topSentences(sentences: string[], count: number, heading: string): string[] {
  const frequencies = new Map<string, number>();
  for (const token of keywordTokens(sentences.join(" "))) frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  const headingTokens = new Set(keywordTokens(heading));
  return sentences
    .map((sentence, index) => ({ sentence, index, score: sentenceScore(sentence, frequencies, headingTokens) + (index === 0 ? 0.5 : 0) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, count)
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.sentence);
}

function chunkSentences(sentences: string[], target = 70): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  let words = 0;
  for (const sentence of sentences) {
    current.push(sentence);
    words += countWords(sentence);
    if (words >= target - 10) {
      chunks.push(current);
      current = [];
      words = 0;
    }
  }
  if (current.length) {
    if (chunks.length && words < 30) chunks[chunks.length - 1].push(...current);
    else chunks.push(current);
  }
  return chunks;
}

/** Heading for an untitled block; `fragment` marks the first-words fallback (not a topic phrase). */
function deriveHeading(text: string): { heading: string; fragment: boolean } {
  const sentence = splitSentences(text)[0] ?? text;
  const subject = /^(?:the |a |an |el |la |los |las |le |les |l['’]|un |una |une )?(.{3,50}?)\s+(?:is|are|was|were|es|son|fue|fueron|est|sont|était|refers|means|significa|désigne)\s/iu.exec(
    stripEmphasis(sentence),
  );
  if (subject && countWords(subject[1]) <= 5 && !PRONOUNS.has(foldText(subject[1]).split(" ")[0])) return { heading: capitalize(subject[1]), fragment: false };
  const proper = /^((?:(?:The|El|La|Los|Las|Le|Les|L['’])\s)?\p{Lu}[\p{L}'’-]*(?:\s(?:(?:of|de|del|des|du|la|the|and|y|et)\s)?\p{Lu}[\p{L}'’-]*){1,4})\s+\p{Ll}/u.exec(
    stripEmphasis(sentence),
  );
  if (proper) return { heading: proper[1], fragment: false };
  const words = stripEmphasis(sentence).split(/\s+/).slice(0, 6);
  while (words.length > 2 && STOPWORDS.has(words[words.length - 1].toLowerCase().replace(/[^\p{L}]/gu, ""))) words.pop();
  return { heading: capitalize(words.join(" ").replace(/[,:;.!?¿¡]+$/u, "").replace(/^[¿¡]/u, "")), fragment: true };
}

/** Heading content words plus the lesson topic words the heading lacks ("key parts photosynthesis"). */
function imageQueryFor(heading: string, text: string, titleTokens: string[]): string {
  const clean = heading.replace(/\s*\(\d+\)$/, "");
  const headingTokens = GENERIC_HEADINGS.has(foldText(clean)) ? [] : keywordTokens(clean);
  const tokens = [...new Set([...headingTokens, ...titleTokens])];
  if (tokens.length < 2) {
    const extra = extractKeywords(text, 6).find((word) => !tokens.includes(word));
    if (extra) tokens.push(extra);
  }
  return clampText(tokens.slice(0, 5).join(" "), OUTLINE_LIMITS.imageQuery);
}

interface Entry {
  text: string;
  ordered: boolean;
  dash?: boolean;
}

interface BuildContext {
  language?: string;
  known: Set<string>;
  terms: Map<string, TermCandidate>;
  sections: OutlineSection[];
  /** Sections whose heading is just the first words of their text. */
  fragmentHeadings: Set<OutlineSection>;
  questions: OutlineQuestion[];
  objectives: string[];
  overviewHeading: string;
  titleTokens: string[];
  title: string;
  strings: ReturnType<typeof composeStrings>;
}

function addTerm(context: BuildContext, candidate: TermCandidate | undefined, section: number) {
  if (!candidate) return;
  const key = foldText(candidate.term);
  if (!key || context.terms.has(key)) return;
  context.terms.set(key, { ...candidate, section });
}

function questionPurpose(heading: string): OutlineQuestion["purpose"] {
  if (startsWithAny(heading, HEADING_WORDS.diagnostic) || containsAny(heading, ["warm up", "pre test", "pretest", "diagnostic"])) return "diagnostic";
  if (startsWithAny(heading, HEADING_WORDS.final) || containsAny(heading, ["quiz", "test", "exam", "exit ticket", "examen", "cuestionario", "evaluacion", "evaluation"])) return "final";
  return "check";
}

function detectKind(heading: string, entries: Entry[], quotes: string[], table: string[][]): OutlineSectionKind {
  if (heading && startsWithAny(heading, HEADING_WORDS.summary)) return "summary";
  if (heading && startsWithAny(heading, HEADING_WORDS.activity)) return "activity";
  const dated = entries.filter((entry) => DATE_PATTERN.test(entry.text));
  if (dated.length >= 3 && dated.length >= entries.length * 0.6) return "timeline";
  const ordered = entries.filter((entry) => entry.ordered).length;
  if (entries.length >= 2 && (ordered >= Math.ceil(entries.length * 0.6) || (startsWithAny(heading, HEADING_WORDS.steps) && entries.some((entry) => entry.ordered)))) return "steps";
  if (table.length >= 2 || (containsAny(heading, COMPARE_CUES) && compareLabels(heading))) return "compare";
  if (entries.length && entries.length <= 3 && statFrom(entries[0].text)) return "stat";
  const contentWords = entries.reduce((sum, entry) => sum + countWords(entry.text), 0);
  if ((heading.trim().endsWith("?") && contentWords < 12) || (entries.length > 0 && entries.every((entry) => /[?？]$/.test(entry.text)))) return "question";
  if (quotes.length || (entries.length <= 2 && entries[0] && /^["“«„]/.test(entries[0].text) && /["”»]/.test(entries[0].text.slice(1)))) return "quote";
  if (startsWithAny(heading, HEADING_WORDS.examples) || (entries[0] && startsWithAny(entries[0].text, HEADING_WORDS.examples))) return "example";
  return "concept";
}

function statFrom(text: string): { value: string; label: string } | undefined {
  const stat = parseStatLine(text);
  if (!stat) return undefined;
  const meaningful = /[%‰°$€£¥₹×x]|\d{2,}|million|billion|millones|milliard|\d[.,]\d|\bin\b|\bde\b|\bsur\b/i.test(stat.value);
  return meaningful ? stat : undefined;
}

function buildCompare(heading: string, entries: Entry[], table: string[][]): { compare?: OutlineSection["compare"]; rest: string[] } {
  if (table.length >= 2) {
    const [header, ...rows] = table;
    const three = header.length >= 3;
    const labelA = three ? header[1] : header[0];
    const labelB = three ? header[2] : header[1];
    const pointsA = rows.map((row) => (three ? (row[0] ? `${row[0]}: ${row[1] ?? ""}` : row[1]) : row[0])).filter((point) => point && !/:\s*$/.test(point));
    const pointsB = rows.map((row) => (three ? (row[0] ? `${row[0]}: ${row[2] ?? ""}` : row[2]) : row[1])).filter((point) => point && !/:\s*$/.test(point));
    if (labelA && labelB && pointsA.length && pointsB.length) {
      return { compare: { a: { label: labelA, points: pointsA }, b: { label: labelB, points: pointsB } }, rest: entries.map((entry) => entry.text) };
    }
  }
  const labels = compareLabels(heading) ?? twoPrefixLabels(entries);
  if (!labels) return { rest: entries.map((entry) => entry.text) };
  const a: string[] = [];
  const b: string[] = [];
  const rest: string[] = [];
  for (const entry of entries) {
    const inA = labelMatches(entry.text, labels[0]);
    const inB = labelMatches(entry.text, labels[1]);
    const strip = (text: string, label: string) => text.replace(new RegExp(`^${escapeRegExp(label)}\\s*[:–—-]\\s*`, "iu"), "");
    if (inA && !inB) a.push(capitalize(strip(entry.text, labels[0])));
    else if (inB && !inA) b.push(capitalize(strip(entry.text, labels[1])));
    else rest.push(entry.text);
  }
  if (!a.length || !b.length) return { rest: entries.map((entry) => entry.text) };
  return { compare: { a: { label: labels[0], points: a }, b: { label: labels[1], points: b } }, rest };
}

function twoPrefixLabels(entries: Entry[]): [string, string] | undefined {
  const counts = new Map<string, { label: string; count: number }>();
  for (const entry of entries) {
    const match = /^([^:]{2,30}):\s/.exec(entry.text);
    if (!match) return undefined;
    const key = foldText(match[1]);
    const current = counts.get(key);
    counts.set(key, { label: match[1].trim(), count: (current?.count ?? 0) + 1 });
  }
  const labels = [...counts.values()];
  return labels.length === 2 && labels.every((label) => label.count >= 2) ? [labels[0].label, labels[1].label] : undefined;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));
  return out;
}

function numbered(heading: string, index: number): string {
  return index === 0 ? heading : `${heading} (${index + 1})`;
}

const TERMINAL_PUNCTUATION = /[.!?…:;]["'”’»)]*$/u;

/**
 * Runs of 2+ adjacent plain lines become list items instead of one run-on paragraph when at
 * least half are "Term: definition" lines, or when none ends a sentence (short lines pasted
 * from slides). Indented lines under a list item stay continuations of that item.
 */
function listLikeRuns(lines: Line[]): Line[] {
  const out = [...lines];
  let start = 0;
  while (start < out.length) {
    if (out[start].kind !== "text") {
      start += 1;
      continue;
    }
    let end = start;
    while (end + 1 < out.length && out[end + 1].kind === "text") end += 1;
    const run = out.slice(start, end + 1);
    const continuation = out[start - 1]?.kind === "item" && run[0].indent >= 2;
    if (run.length >= 2 && !continuation) {
      const terms = run.filter((line) => termFromLine(line.text)).length;
      const unpunctuated = run.every((line) => !TERMINAL_PUNCTUATION.test(line.text) && countWords(line.text) <= 20);
      if (terms >= run.length / 2 || unpunctuated) {
        for (let at = start; at <= end; at += 1) out[at] = { ...out[at], kind: "item", ordered: false };
      }
    }
    start = end + 1;
  }
  return out;
}

function processSection(raw: RawSection, rawIndex: number, context: BuildContext, hasHeadings: boolean) {
  const heading = stripEmphasis(raw.heading).trim();
  const lastSection = () => (context.sections.length ? context.sections.length - 1 : undefined);

  if (heading && startsWithAny(heading, HEADING_WORDS.objectives)) {
    for (const line of raw.lines) if (line.kind === "item" || line.kind === "text") context.objectives.push(stripEmphasis(line.text));
    return;
  }

  if (heading && startsWithAny(heading, HEADING_WORDS.glossary)) {
    const content = raw.lines.filter((line) => line.kind !== "blank");
    const terms = content.map((line) => termFromLine(line.text));
    if (terms.filter(Boolean).length >= content.length / 2) {
      terms.forEach((term) => addTerm(context, term, lastSection() ?? 0));
      return;
    }
  }

  const extracted = extractQuestions(raw.lines, questionPurpose(heading || context.title));
  const remaining = listLikeRuns(extracted.remaining);
  const questions = extracted.questions;

  const entries: Entry[] = [];
  const paragraphs: string[] = [];
  const quotes: string[] = [];
  const table: string[][] = [];
  // An "Answer:" line with no question it belongs to is kept for the teacher, never shown as slide text.
  const answerNotes: string[] = [];
  let paragraph: string[] = [];
  let previous: Line | undefined;
  const flush = () => {
    if (paragraph.length) paragraphs.push(paragraph.join(" "));
    paragraph = [];
  };
  for (const line of remaining) {
    if (line.kind === "blank") flush();
    else if (line.kind === "answer") answerNotes.push(`${context.strings.answer}: ${line.text}`);
    else if (line.kind === "item" || line.kind === "choice") {
      flush();
      entries.push({ text: line.text, ordered: Boolean(line.ordered || line.kind === "choice"), dash: line.dash });
    } else if (line.kind === "quote") {
      quotes.push(line.text);
      if (line.author) entries.push({ text: line.author, ordered: false, dash: true });
    } else if (line.kind === "table" && line.cells) table.push(line.cells);
    else if (line.kind === "text" && line.indent >= 2 && previous?.kind === "item" && entries.length) {
      entries[entries.length - 1].text += ` ${line.text}`;
    } else paragraph.push(line.text);
    previous = line;
  }
  flush();
  const addAnswerNotes = (section: OutlineSection) => {
    if (answerNotes.length) section.notes = [section.notes, ...answerNotes.splice(0)].filter(Boolean).join("\n");
  };

  const prose = paragraphs.join("\n\n");
  const sentences = splitSentences(prose);
  const hasContent = entries.length || prose || quotes.length || table.length;
  const sectionIndexForQuestions = hasContent ? context.sections.length : lastSection();
  for (const question of questions) {
    if (sectionIndexForQuestions !== undefined && question.purpose !== "diagnostic") question.section = sectionIndexForQuestions;
    context.questions.push(question);
  }
  if (!hasContent) {
    const last = lastSection();
    if (last !== undefined) addAnswerNotes(context.sections[last]);
    return;
  }

  let fragment = false;
  const fallbackHeading = () => {
    if (rawIndex === 0 && hasHeadings) return context.overviewHeading;
    if (kind === "steps") return context.strings.topicSections.steps;
    if (entries.length >= 2 && entries.every((entry) => termFromLine(entry.text))) return context.strings.keyTerms;
    const author = kind === "quote" ? entries.find((entry) => entry.dash)?.text : undefined;
    if (author && countWords(author) <= 6) return author;
    const derived = deriveHeading(entries[0]?.text || prose || quotes[0] || "");
    fragment = derived.fragment;
    return derived.heading;
  };
  const allText = [heading, ...entries.map((entry) => entry.text), prose, ...quotes].join(" ");
  const kindEntries: Entry[] = entries.length ? entries : sentences.map((text) => ({ text, ordered: false }));
  const kind = detectKind(heading, kindEntries, quotes, table);
  const baseHeading = heading || fallbackHeading();
  const firstIndex = context.sections.length;

  const lineDefinitions = kind === "concept" || kind === "example" || kind === "summary";
  if (lineDefinitions) for (const entry of entries) addTerm(context, termFromLine(entry.text), firstIndex);
  sentences.forEach((sentence, index) => {
    const candidate = sentenceDefinition(sentence, heading, context.known, index === 0);
    if (candidate) {
      const next = sentences[index + 1];
      if (next && startsWithAny(next, HEADING_WORDS.examples)) candidate.example = next.replace(/^(?:e\.g\.|for example|for instance|por ejemplo|par exemple)[,:]?\s*/iu, "");
      addTerm(context, candidate, firstIndex);
    }
  });
  for (const entry of entries) {
    const candidate = sentenceDefinition(entry.text, heading, context.known);
    if (candidate) addTerm(context, candidate, firstIndex);
  }

  const push = (section: OutlineSection) => {
    if (!["question", "activity", "summary", "quote"].includes(section.kind)) section.imageQuery = imageQueryFor(section.heading, allText, context.titleTokens);
    if (fragment) context.fragmentHeadings.add(section);
    addAnswerNotes(section);
    context.sections.push(section);
  };

  if (kind === "steps" || kind === "timeline") {
    const items = kindEntries.map((entry) => {
      const text = stripEmphasis(entry.text);
      const dated = kind === "timeline" ? leadingDate(text) : undefined;
      return dated ? `${dated.date} — ${dated.rest}` : text;
    });
    chunk(items, OUTLINE_LIMITS.steps).forEach((part, index) => {
      const section: OutlineSection = { kind, heading: numbered(baseHeading, index), bullets: [], steps: part };
      const fullSteps = part.some((step) => Array.from(step).length > OUTLINE_LIMITS.step) ? part.join(" ") : "";
      const body = [index === 0 && entries.length ? prose : "", fullSteps].filter(Boolean).join(" ");
      if (body) section.body = body;
      push(section);
    });
    return;
  }

  if (kind === "compare") {
    const { compare, rest } = buildCompare(heading, kindEntries, table);
    if (compare) {
      const section: OutlineSection = { kind: "compare", heading: baseHeading, bullets: rest.slice(0, OUTLINE_LIMITS.bullets).map(stripEmphasis), compare };
      if (entries.length && prose) section.body = prose;
      push(section);
      return;
    }
  }

  if (kind === "stat") {
    const stat = statFrom(kindEntries[0].text);
    if (stat) {
      push({ kind: "stat", heading: baseHeading, bullets: kindEntries.slice(1).map((entry) => stripEmphasis(entry.text)), stat });
      return;
    }
  }

  if (kind === "quote") {
    const source = quotes.length ? quotes.join(" ") : kindEntries[0].text;
    const authorLine = quotes.length ? kindEntries.find((entry) => entry.dash || /^[—–-]\s*\S/.test(entry.text)) : kindEntries[1];
    const author = authorLine ? authorLine.text.replace(/^[—–-]\s*/, "").trim() : "";
    const text = source.replace(/^["“«„\s]+|["”»\s]+$/g, "").trim();
    const quote = author && countWords(author) <= 8 ? { text, author } : { text };
    const rest = kindEntries.filter((entry) => entry !== authorLine && (quotes.length || entry !== kindEntries[0])).map((entry) => entry.text);
    push({ kind: "quote", heading: baseHeading, bullets: rest, quote });
    return;
  }

  const bulletSource = entries.length ? entries.map((entry) => stripEmphasis(entry.text)) : sentences.map(stripEmphasis);
  if (entries.length) {
    chunk(bulletSource, OUTLINE_LIMITS.bullets).forEach((part, index) => {
      const section: OutlineSection = { kind, heading: numbered(baseHeading, index), bullets: part };
      if (index === 0 && prose) section.body = stripEmphasis(prose);
      push(section);
    });
    return;
  }

  const wordTotal = countWords(prose);
  const parts = wordTotal > 110 ? chunkSentences(sentences) : [sentences];
  parts.forEach((part, index) => {
    const text = stripEmphasis(part.join(" "));
    const partHeading = numbered(baseHeading, index);
    const section: OutlineSection = { kind: index === 0 ? kind : kind === "summary" ? "summary" : "concept", heading: partHeading, bullets: [] };
    if (part.length <= 3) {
      section.bullets = part.map(stripEmphasis);
      // Bullets are clamped to OUTLINE_LIMITS.bullet; keep the full text of long sentences.
      if (part.some((sentence) => Array.from(sentence).length > OUTLINE_LIMITS.bullet)) section.body = text;
    } else {
      section.body = text;
      section.bullets = topSentences(part, 3, partHeading).map(stripEmphasis);
    }
    push(section);
  });
}

/* ------------------------------------------------------------------ */
/* Generated questions & objectives                                     */
/* ------------------------------------------------------------------ */

const ARTICLE_START = /^(?:a|an|the|un|una|unos|unas|el|la|los|las|une|le|les|des|l['’])\s/iu;

const QUESTION_WORDS = /^(?:how|why|what|when|where|which|who|cómo|como|por|qué|que|cuándo|cuando|dónde|donde|cuál|cual|quién|quien|comment|pourquoi|quand|où|quel|quelle|quels|quelles|qui)$/;

/**
 * Lowercases the first word for use mid-sentence ("Explain key parts") unless it looks
 * like a proper noun or acronym: all caps, inner capitals, or only ever capitalized
 * mid-sentence in `source`.
 */
function lowerFirstIfCommon(text: string, source: string): string {
  const [first = ""] = text.split(/\s+/);
  const lowered = first.toLocaleLowerCase();
  if (first === lowered) return text;
  if (STOPWORDS.has(lowered) || QUESTION_WORDS.test(lowered)) return lowered + text.slice(first.length);
  if (isAllCaps(first) || /\p{Lu}/u.test(Array.from(first).slice(1).join("")) || /\d/.test(first)) return text;
  if (source) {
    const properMidSentence = new RegExp(`[\\p{Ll},;][ \\t]+${escapeRegExp(first)}(?![\\p{L}])`, "u").test(source);
    const usedLowercase = new RegExp(`(?:^|[^\\p{L}])${escapeRegExp(lowered)}(?![\\p{L}])`, "u").test(source);
    if (properMidSentence && !usedLowercase) return text;
  }
  return lowered + text.slice(first.length);
}

/**
 * Whether "Term is <definition>" reads as a sentence. English noun phrases start with an
 * article; for es/fr only singular indefinites are safe ("est une", never "est les").
 */
function copulaFits(definition: string, locale: string): boolean {
  return locale === "en" ? ARTICLE_START.test(definition) : /^(?:un|una|une)\s/iu.test(definition);
}

function statement(term: string, definition: string, copula: string, locale: string): string {
  const body = definition.replace(/[.]+$/, "");
  return copulaFits(body, locale) ? `${term} ${copula} ${lowerFirstIfCommon(body, "")}.` : `${term}: ${body}.`;
}

function generateQuestions(terms: TermCandidate[], language: string | undefined, budget: number): OutlineQuestion[] {
  const strings = composeStrings(language);
  const locale = composeLocale(language);
  const out: OutlineQuestion[] = [];
  if (!terms.length || budget <= 0) return out;
  const rotation = terms.length >= 3 ? ["mcq", "fill_blank", "true_false"] : ["fill_blank", "true_false"];
  terms.slice(0, 8).forEach((term, index) => {
    if (out.length >= budget) return;
    const seed = hashString(term.term);
    const kind = rotation[index % rotation.length];
    const definition = term.definition.replace(/[.]+$/, "");
    if (kind === "mcq") {
      const others = seededShuffle(terms.filter((other) => other !== term), seed).slice(0, 3).map((other) => other.term);
      const choices = seededShuffle([term.term, ...others], seed ^ 0x5bd1e995);
      out.push({
        type: "mcq",
        prompt: strings.whichTerm(lowerFirstIfCommon(definition, "")),
        choices,
        answer: choices.indexOf(term.term),
        explanation: statement(term.term, definition, strings.copula, locale),
        purpose: "check",
        section: term.section,
      });
    } else if (kind === "fill_blank") {
      const fromSentence = term.sentence ? blankOut(term.sentence, term.term) : undefined;
      const prompt = fromSentence ?? (copulaFits(definition, locale) ? `${BLANK} ${strings.copula} ${lowerFirstIfCommon(definition, "")}.` : `${BLANK}: ${definition}.`);
      out.push({ type: "fill_blank", prompt: capitalize(prompt), answer: term.term, purpose: "check", section: term.section });
    } else {
      const other = terms.length >= 2 ? terms[(index + 1) % terms.length] : undefined;
      const makeFalse = Boolean(other) && seed % 2 === 1;
      const shown = makeFalse && other ? other.definition.replace(/[.]+$/, "") : definition;
      const trueSentence = !makeFalse && term.sentence && countWords(term.sentence) <= 40 ? term.sentence : undefined;
      out.push({
        type: "true_false",
        prompt: trueSentence ?? statement(term.term, shown, strings.copula, locale),
        answer: !makeFalse,
        explanation: makeFalse ? statement(term.term, definition, strings.copula, locale) : undefined,
        purpose: "check",
        section: term.section,
      });
    }
  });
  if (terms.length >= 3 && out.length < budget) {
    out.push({
      type: "match",
      prompt: strings.matchPrompt,
      pairs: terms.slice(0, 6).map((term) => [term.term, clampText(term.definition.replace(/[.]+$/, ""), OUTLINE_LIMITS.pairSide)] as [string, string]),
      purpose: "final",
    });
  }
  return out.map((question) => {
    if (question.explanation === undefined) delete question.explanation;
    if (question.section === undefined) delete question.section;
    return question;
  });
}

const KIND_VERB: Partial<Record<OutlineSectionKind, keyof ReturnType<typeof composeStrings>["bloom"]>> = {
  concept: "explain",
  example: "apply",
  steps: "describe",
  timeline: "describe",
  compare: "compare",
  stat: "interpret",
};

const GENERIC_HEADINGS = new Set([
  "overview", "introduction", "intro", "background", "context", "key ideas", "main ideas", "notes", "key events", "key dates", "timeline", "events", "steps", "step by step", "procedure", "instructions",
  "introduccion", "contexto", "ideas principales", "apuntes", "cronologia", "linea de tiempo", "pasos", "paso a paso", "procedimiento",
  "presentation", "contexte", "idees principales", "chronologie", "etapes", "etape par etape",
]);

/** "What is photosynthesis?" -> "what photosynthesis is" (English only; es/fr read fine as-is). */
function objectivePhrase(heading: string, title: string, locale: string): string {
  const phrase = heading.replace(/\s*\(\d+\)$/, "").replace(/[?¿¡!:]/g, "").trim();
  if (!phrase || GENERIC_HEADINGS.has(foldText(phrase))) return title;
  if (locale === "en") {
    const question = /^(what|who)\s+(is|are|was|were)\s+(.+)$/i.exec(phrase);
    if (question) return `${question[1]} ${question[3]} ${question[2]}`;
  }
  return phrase;
}

function bloomObjectives(sections: OutlineSection[], fragments: Set<OutlineSection>, language: string | undefined, source: string, title: string): string[] {
  const strings = composeStrings(language);
  const used = new Set<string>();
  const fallbacks = ["explain", "describe", "summarize", "analyze", "identify", "apply"] as const;
  const objectives: string[] = [];
  const seen = new Set<string>();
  for (const section of sections) {
    if (objectives.length >= 3) break;
    let verb = KIND_VERB[section.kind];
    if (!verb) continue;
    const phrase = objectivePhrase(fragments.has(section) ? title : section.heading, title, composeLocale(language));
    const key = foldText(phrase);
    if (!phrase || seen.has(key)) continue;
    seen.add(key);
    if (used.has(verb)) verb = fallbacks.find((candidate) => !used.has(candidate)) ?? verb;
    used.add(verb);
    objectives.push(`${strings.bloom[verb]} ${lowerFirstIfCommon(phrase, source)}`);
  }
  return objectives;
}

/* ------------------------------------------------------------------ */
/* Public API                                                           */
/* ------------------------------------------------------------------ */

export interface OutlineFromTextOptions {
  title?: string;
  language?: string;
  /** Used as the title when the text has no usable first line. */
  fileName?: string;
}

function prepareText(text: string): string {
  const source = typeof text === "string" ? text : "";
  const markdown = looksLikeHtml(source) ? decodeEntities(normalizeLessonAuthoringContent(source)) : source;
  return markdown
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\t/g, "  ");
}

function cleanTitle(text: string): string {
  const letters = text.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
  if (!/\p{L}/u.test(text) || letters < text.replace(/\s/g, "").length / 2) return "";
  return stripEmphasis(text)
    .replace(/^(?:title|topic|lesson|unit|título|titulo|tema|lección|leccion|unidad|titre|sujet|leçon|lecon)\s*:\s*/i, "")
    .replace(/[:：]\s*$/, "")
    .replace(/^["“«]|["”»]$/g, "")
    .trim();
}

function detectTitle(lines: Line[], text: string, options: OutlineFromTextOptions): { title: string; consumed?: number } {
  const isContent = (line: Line) => line.kind !== "blank" && line.kind !== "rule";
  const firstIndex = lines.findIndex(isContent);
  const first = firstIndex >= 0 ? lines[firstIndex] : undefined;
  const provided = cleanTitle(options.title ?? "");
  if (provided) {
    const same = first && (first.kind === "heading" || first.kind === "text") && foldText(cleanTitle(first.text)) === foldText(provided);
    return { title: provided, consumed: same ? firstIndex : undefined };
  }
  const h1 = lines.findIndex((line) => line.kind === "heading" && line.level === 1);
  if (h1 >= 0) return { title: cleanTitle(lines[h1].text), consumed: h1 };
  if (first && (first.kind === "heading" || (first.kind === "text" && countWords(first.text) <= 12 && first.text.length <= 90 && !/[.?!]$/.test(first.text)))) {
    return { title: cleanTitle(first.text), consumed: firstIndex };
  }
  const fileTitle = cleanTitle((options.fileName ?? "").replace(/^.*[\\/]/, "").replace(/\.[a-z0-9]{1,5}$/i, "").replace(/[_-]+/g, " "));
  if (fileTitle) return { title: capitalize(fileTitle) };
  const firstText = lines.find(isContent)?.text ?? "";
  const subject = firstText ? cleanTitle(deriveHeading(firstText).heading) : "";
  if (subject && countWords(subject) <= 5) return { title: subject };
  const words = stripEmphasis(text).replace(/^[#>*\-\s]+/, "").split(/\s+/).filter(Boolean).slice(0, 6).join(" ");
  return { title: cleanTitle(words.replace(/[,:;.!?]+$/, "")) };
}

/**
 * Builds an outline from pasted notes, markdown or HTML with no AI: title and section
 * detection, bullets, section kinds, glossary, questions (parsed and generated) and
 * Bloom objectives. Keeps Unicode (accents, ¿¡, «»).
 */
export function outlineFromText(text: string, options: OutlineFromTextOptions = {}): LessonOutline {
  const prepared = prepareText(text);
  const language = normalizeLanguage(options.language) ?? detectLanguage(prepared);
  const strings = composeStrings(language);
  const lines = demoteStrayChoices(prepared.split("\n").map((line) => classify(line)));
  const { title, consumed } = detectTitle(lines, prepared, options);
  const body = consumed === undefined ? lines : lines.filter((_, index) => index !== consumed);
  promoteImplicitHeadings(body);

  let raw = splitByHeadings(body);
  const hasHeadings = raw.some((section) => section.heading);
  if (!hasHeadings && raw.length <= 1) raw = splitByBlocks(body);
  raw = mergeCompareSubsections(raw).flatMap(splitQuoteBlocks);

  const context: BuildContext = {
    language,
    known: knownTermsFromText(prepared),
    terms: new Map(),
    sections: [],
    fragmentHeadings: new Set(),
    questions: [],
    objectives: [],
    overviewHeading: strings.overview,
    titleTokens: keywordTokens(title).slice(0, 3),
    title,
    strings,
  };
  raw.forEach((section, index) => processSection(section, index, context, hasHeadings));
  const sections = context.sections.slice(0, OUTLINE_LIMITS.sections);
  const glossary = [...context.terms.values()].slice(0, OUTLINE_LIMITS.glossary);

  const inRange = <T extends { section?: number }>(item: T): T =>
    item.section !== undefined && item.section >= sections.length ? { ...item, section: undefined } : item;
  const parsed = context.questions.map(inRange);
  const generated = generateQuestions(
    glossary.map(inRange),
    language,
    Math.min(8, 12 - parsed.length),
  );
  const objectives = context.objectives.length ? context.objectives : bloomObjectives(sections, context.fragmentHeadings, language, prepared, title || strings.untitled);

  return normalizeOutline({
    v: 1,
    title: title || strings.untitled,
    language,
    objectives,
    sections,
    glossary: glossary.map(({ term, definition, example }) => (example ? { term, definition, example } : { term, definition })),
    questions: [...parsed, ...generated],
    activities: [],
  });
}

export interface OutlineFromTopicOptions {
  level?: LessonOutline["level"];
  language?: string;
  audience?: string;
}

/**
 * Topic-only skeleton: objectives by level, three concept slots, steps, a check and a
 * summary. Questions are `placeholder: true` slots with no invented options.
 */
export function outlineFromTopic(topic: string, options: OutlineFromTopicOptions = {}): LessonOutline {
  const language = normalizeLanguage(options.language);
  const strings = composeStrings(language);
  const title = cleanTitle(stripEmphasis(typeof topic === "string" ? topic : "").replace(/\s+/g, " ")) || strings.untitled;
  const subject = titleAsSubject(title);
  const verbs =
    options.level === "beginner"
      ? (["identify", "explain", "apply"] as const)
      : options.level === "advanced"
        ? (["analyze", "evaluate", "create"] as const)
        : (["explain", "apply", "evaluate"] as const);
  const sections: OutlineSection[] = [
    { kind: "concept", heading: strings.topicSections.keyIdea, bullets: [] },
    { kind: "concept", heading: strings.topicSections.howItWorks, bullets: [] },
    { kind: "concept", heading: strings.topicSections.whyItMatters, bullets: [] },
    { kind: "steps", heading: strings.topicSections.steps, bullets: [], steps: [] },
    { kind: "question", heading: strings.topicSections.check, bullets: [] },
    { kind: "summary", heading: strings.topicSections.summary, bullets: [] },
  ];
  const questions: OutlineQuestion[] = [
    { type: "short", prompt: strings.topicQuestions.prior(subject), purpose: "diagnostic", placeholder: true },
    { type: "mcq", prompt: strings.topicQuestions.describe(subject), choices: [], purpose: "check", section: 0, placeholder: true },
    { type: "mcq", prompt: strings.topicQuestions.example(subject), choices: [], purpose: "final", placeholder: true },
    { type: "short", prompt: strings.topicQuestions.ownWords(subject), purpose: "final", placeholder: true },
  ];
  const outline = normalizeOutline({
    v: 1,
    title,
    language,
    level: options.level,
    audience: options.audience,
    objectives: verbs.map((verb) => strings.topicObjective[verb](subject)),
    sections,
    glossary: [],
    questions,
    activities: [{ kind: "reflection", prompt: strings.topicQuestions.reflection(subject) }],
  });
  return outline;
}
