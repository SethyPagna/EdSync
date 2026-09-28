import type {
  LessonOutline,
  OutlineActivity,
  OutlineIssue,
  OutlineQuestion,
  OutlineQuestionType,
  OutlineSection,
  OutlineSectionKind,
  OutlineTerm,
  ParsedOutline,
} from "./types";

export const OUTLINE_LIMITS = {
  title: 90,
  subtitle: 160,
  audience: 80,
  objectives: 5,
  objective: 140,
  sections: 24,
  heading: 70,
  bullets: 6,
  bullet: 140,
  body: 600,
  steps: 8,
  step: 140,
  comparePoints: 6,
  compareLabel: 40,
  statValue: 24,
  statLabel: 120,
  quote: 280,
  quoteAuthor: 80,
  imageQuery: 80,
  icon: 40,
  notes: 1200,
  glossary: 24,
  term: 60,
  definition: 240,
  example: 200,
  questions: 20,
  prompt: 280,
  choices: 6,
  choice: 140,
  answer: 200,
  explanation: 280,
  pairs: 8,
  pairSide: 100,
  activities: 8,
  activityItems: 8,
} as const;

export const BLANK = "_____";

const SECTION_KINDS: OutlineSectionKind[] = [
  "concept",
  "example",
  "steps",
  "compare",
  "timeline",
  "stat",
  "quote",
  "question",
  "activity",
  "summary",
];

/* ------------------------------------------------------------------ */
/* Locale strings (en / es / fr; anything else falls back to English)   */
/* ------------------------------------------------------------------ */

export type ComposeLocale = "en" | "es" | "fr";

type BloomVerb =
  | "explain"
  | "describe"
  | "apply"
  | "compare"
  | "analyze"
  | "interpret"
  | "summarize"
  | "practice"
  | "discuss"
  | "identify"
  | "evaluate"
  | "create";

type ActivityKind = OutlineActivity["kind"];

export interface ComposeStrings {
  untitled: string;
  overview: string;
  agenda: string;
  objectives: string;
  example: string;
  keyTerms: string;
  quiz: string;
  question: (n: number) => string;
  recap: string;
  closing: string;
  socialClosing: string;
  answerKey: string;
  answer: string;
  matchTerms: string;
  matchMeanings: string;
  trueLabel: string;
  falseLabel: string;
  copula: string;
  matchPrompt: string;
  whichTerm: (definition: string) => string;
  /** Speaker-note marker for generated question slots the author still has to fill in. */
  placeholderQuestion: string;
  activity: Record<ActivityKind, string>;
  bloom: Record<BloomVerb, string>;
  topicObjective: Record<"identify" | "explain" | "apply" | "evaluate" | "analyze" | "create", (topic: string) => string>;
  topicSections: {
    keyIdea: string;
    howItWorks: string;
    whyItMatters: string;
    steps: string;
    check: string;
    summary: string;
  };
  topicQuestions: {
    prior: (topic: string) => string;
    describe: (topic: string) => string;
    example: (topic: string) => string;
    ownWords: (topic: string) => string;
    reflection: (topic: string) => string;
  };
}

const STRINGS: Record<ComposeLocale, ComposeStrings> = {
  en: {
    untitled: "Untitled lesson",
    overview: "Overview",
    agenda: "Agenda",
    objectives: "Learning objectives",
    example: "Example",
    keyTerms: "Key terms",
    quiz: "Quiz",
    question: (n) => `Question ${n}`,
    recap: "Recap",
    closing: "Questions?",
    socialClosing: "Save for later",
    answerKey: "Answer key",
    answer: "Answer",
    matchTerms: "Terms",
    matchMeanings: "Meanings",
    trueLabel: "True",
    falseLabel: "False",
    copula: "is",
    matchPrompt: "Match each term to its meaning.",
    whichTerm: (definition) => `Which term means “${definition}”?`,
    placeholderQuestion: "Draft question: add choices and the answer.",
    activity: {
      discussion: "Discussion",
      poll: "Poll",
      reflection: "Reflection",
      practice: "Practice",
      matching: "Matching",
    },
    bloom: {
      explain: "Explain",
      describe: "Describe",
      apply: "Apply",
      compare: "Compare",
      analyze: "Analyze",
      interpret: "Interpret",
      summarize: "Summarize",
      practice: "Practice",
      discuss: "Discuss",
      identify: "Identify",
      evaluate: "Evaluate",
      create: "Create",
    },
    topicObjective: {
      identify: (t) => `Identify the key ideas of ${t}`,
      explain: (t) => `Explain ${t} in your own words`,
      apply: (t) => `Apply ${t} to a real example`,
      evaluate: (t) => `Evaluate when and why ${t} matters`,
      analyze: (t) => `Analyze how the parts of ${t} connect`,
      create: (t) => `Create an example that uses ${t}`,
    },
    topicSections: {
      keyIdea: "Key idea",
      howItWorks: "How it works",
      whyItMatters: "Why it matters",
      steps: "Step by step",
      check: "Check your understanding",
      summary: "Summary",
    },
    topicQuestions: {
      prior: (t) => `What do you already know about ${t}?`,
      describe: (t) => `Which statement best describes ${t}?`,
      example: (t) => `Which example shows ${t} in action?`,
      ownWords: (t) => `Explain ${t} in your own words.`,
      reflection: (t) => `What is one question you still have about ${t}?`,
    },
  },
  es: {
    untitled: "Lección sin título",
    overview: "Introducción",
    agenda: "Agenda",
    objectives: "Objetivos de aprendizaje",
    example: "Ejemplo",
    keyTerms: "Términos clave",
    quiz: "Cuestionario",
    question: (n) => `Pregunta ${n}`,
    recap: "Repaso",
    closing: "¿Preguntas?",
    socialClosing: "Guárdalo para después",
    answerKey: "Respuestas",
    answer: "Respuesta",
    matchTerms: "Términos",
    matchMeanings: "Significados",
    trueLabel: "Verdadero",
    falseLabel: "Falso",
    copula: "es",
    matchPrompt: "Relaciona cada término con su significado.",
    whichTerm: (definition) => `¿Qué término significa «${definition}»?`,
    placeholderQuestion: "Pregunta en borrador: añade las opciones y la respuesta.",
    activity: {
      discussion: "Debate",
      poll: "Encuesta",
      reflection: "Reflexión",
      practice: "Práctica",
      matching: "Relacionar",
    },
    bloom: {
      explain: "Explicar",
      describe: "Describir",
      apply: "Aplicar",
      compare: "Comparar",
      analyze: "Analizar",
      interpret: "Interpretar",
      summarize: "Resumir",
      practice: "Practicar",
      discuss: "Debatir",
      identify: "Identificar",
      evaluate: "Evaluar",
      create: "Crear",
    },
    topicObjective: {
      identify: (t) => `Identificar las ideas clave de ${t}`,
      explain: (t) => `Explicar ${t} con tus propias palabras`,
      apply: (t) => `Aplicar ${t} a un ejemplo real`,
      evaluate: (t) => `Evaluar cuándo y por qué importa ${t}`,
      analyze: (t) => `Analizar cómo se relacionan las partes de ${t}`,
      create: (t) => `Crear un ejemplo que use ${t}`,
    },
    topicSections: {
      keyIdea: "Idea clave",
      howItWorks: "Cómo funciona",
      whyItMatters: "Por qué importa",
      steps: "Paso a paso",
      check: "Comprueba lo aprendido",
      summary: "Resumen",
    },
    topicQuestions: {
      prior: (t) => `¿Qué sabes ya sobre ${t}?`,
      describe: (t) => `¿Qué afirmación describe mejor ${t}?`,
      example: (t) => `¿Qué ejemplo muestra ${t} en acción?`,
      ownWords: (t) => `Explica ${t} con tus propias palabras.`,
      reflection: (t) => `¿Qué pregunta te queda sobre ${t}?`,
    },
  },
  fr: {
    untitled: "Leçon sans titre",
    overview: "Introduction",
    agenda: "Au programme",
    objectives: "Objectifs d'apprentissage",
    example: "Exemple",
    keyTerms: "Mots clés",
    quiz: "Quiz",
    question: (n) => `Question ${n}`,
    recap: "Récapitulatif",
    closing: "Des questions ?",
    socialClosing: "À garder pour plus tard",
    answerKey: "Corrigé",
    answer: "Réponse",
    matchTerms: "Termes",
    matchMeanings: "Définitions",
    trueLabel: "Vrai",
    falseLabel: "Faux",
    copula: "est",
    matchPrompt: "Associez chaque terme à sa définition.",
    whichTerm: (definition) => `Quel terme signifie « ${definition} » ?`,
    placeholderQuestion: "Question à compléter : ajoutez les choix et la réponse.",
    activity: {
      discussion: "Discussion",
      poll: "Sondage",
      reflection: "Réflexion",
      practice: "Pratique",
      matching: "Association",
    },
    bloom: {
      explain: "Expliquer",
      describe: "Décrire",
      apply: "Appliquer",
      compare: "Comparer",
      analyze: "Analyser",
      interpret: "Interpréter",
      summarize: "Résumer",
      practice: "Pratiquer",
      discuss: "Débattre de",
      identify: "Identifier",
      evaluate: "Évaluer",
      create: "Créer",
    },
    topicObjective: {
      identify: (t) => `Identifier les idées clés de ${t}`,
      explain: (t) => `Expliquer ${t} avec ses propres mots`,
      apply: (t) => `Appliquer ${t} à un exemple concret`,
      evaluate: (t) => `Évaluer quand et pourquoi ${t} compte`,
      analyze: (t) => `Analyser comment les parties de ${t} s'articulent`,
      create: (t) => `Créer un exemple qui utilise ${t}`,
    },
    topicSections: {
      keyIdea: "Idée clé",
      howItWorks: "Comment ça marche",
      whyItMatters: "Pourquoi c'est important",
      steps: "Étape par étape",
      check: "Vérifiez vos acquis",
      summary: "Résumé",
    },
    topicQuestions: {
      prior: (t) => `Que savez-vous déjà sur ${t} ?`,
      describe: (t) => `Quelle affirmation décrit le mieux ${t} ?`,
      example: (t) => `Quel exemple montre ${t} en action ?`,
      ownWords: (t) => `Expliquez ${t} avec vos propres mots.`,
      reflection: (t) => `Quelle question vous reste-t-il sur ${t} ?`,
    },
  },
};

export function composeLocale(language?: string): ComposeLocale {
  const code = (language ?? "").trim().toLowerCase().slice(0, 2);
  return code === "es" || code === "fr" ? code : "en";
}

export function composeStrings(language?: string): ComposeStrings {
  return STRINGS[composeLocale(language)];
}

/* ------------------------------------------------------------------ */
/* Text helpers                                                         */
/* ------------------------------------------------------------------ */

const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/g;
const HTML_TAG = /<\/?[a-z][a-z0-9]*(?:\s[^<>]*)?\/?>/i;

const NAMED_ENTITIES: Record<string, string> = {
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  laquo: "«",
  raquo: "»",
  copy: "©",
  deg: "°",
  times: "×",
  iexcl: "¡",
  iquest: "¿",
};
/** Latin-1 accented letters: "eacute" → "é", "Ccedil" → "Ç". */
const ACCENT_ENTITIES: [suffix: string, letters: string, mark: string][] = [
  ["acute", "aeiouy", "́"],
  ["grave", "aeiou", "̀"],
  ["circ", "aeiou", "̂"],
  ["uml", "aeiou", "̈"],
  ["tilde", "ano", "̃"],
  ["cedil", "c", "̧"],
];
for (const [suffix, letters, mark] of ACCENT_ENTITIES) {
  for (const letter of letters) {
    const accented = `${letter}${mark}`.normalize("NFC");
    NAMED_ENTITIES[`${letter}${suffix}`] = accented;
    NAMED_ENTITIES[`${letter.toUpperCase()}${suffix}`] = accented.toUpperCase();
  }
}

export function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&#(\d{1,6});/g, (_, code: string) => safeCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]{1,6});/gi, (_, code: string) => safeCodePoint(parseInt(code, 16)))
    .replace(/&([a-zA-Z]+);/g, (entity, name: string) => NAMED_ENTITIES[name] ?? entity)
    .replace(/&amp;/g, "&");
}

function safeCodePoint(code: number): string {
  return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
}

export function looksLikeHtml(text: string): boolean {
  return HTML_TAG.test(text);
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n- ")
      .replace(/<\/(p|div|h[1-6]|li|ul|ol|tr|blockquote|section)>/gi, "\n")
      .replace(/<(td|th)[^>]*>/gi, " ")
      .replace(/<[^>]+>/g, ""),
  );
}

/** Single-line clean text: strips tags, markdown emphasis, collapses whitespace. */
export function cleanText(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return "";
  let text = value.normalize("NFC").replace(ZERO_WIDTH, "").replace(/\u00A0/g, " ");
  text = looksLikeHtml(text) ? htmlToText(text) : decodeEntities(text);
  return stripEmphasis(text).replace(/\s+/g, " ").trim();
}

/** Multi-line clean text: keeps paragraph breaks. */
export function cleanMultiline(value: unknown): string {
  if (typeof value !== "string") return cleanText(value);
  let text = value.normalize("NFC").replace(ZERO_WIDTH, "").replace(/\u00A0/g, " ").replace(/\r\n?/g, "\n");
  text = looksLikeHtml(text) ? htmlToText(text) : decodeEntities(text);
  return stripEmphasis(text)
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Removes **bold**, __bold__ and `code` markers; leaves "_____" blanks alone. */
export function stripEmphasis(text: string): string {
  return text
    .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, "$1")
    .replace(/(^|[^\p{L}\p{N}_])__(?=[^\s_])(.+?)(?<=[^\s_])__(?![\p{L}\p{N}_])/gu, "$1$2")
    .replace(/`([^`]+)`/g, "$1");
}

const LIST_MARKER = /^\s*(?:[-*+•◦▪‣·●○■□➢➤►▸✓✔]|\d{1,3}[.)]|\(\d{1,3}\)|\[[ xX✓]?\])\s+/u;

export function stripListMarker(text: string): string {
  return text.replace(LIST_MARKER, "").trim();
}

/** Cuts to `max` code points at a word boundary and adds an ellipsis. Idempotent. */
export function clampText(text: string, max: number): string {
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  const cut = chars.slice(0, Math.max(1, max - 1)).join("");
  const space = cut.lastIndexOf(" ");
  const base = space > cut.length * 0.6 ? cut.slice(0, space) : cut;
  return `${base.replace(/[\s,;:.\-–—(]+$/u, "")}…`;
}

export function capitalize(text: string): string {
  const [first = "", ...rest] = Array.from(text);
  return first.toLocaleUpperCase() + rest.join("");
}

export function countWords(text: string): number {
  return text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

export function foldText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** FNV-1a 32-bit hash; stable seed source for shuffles and ids. */
export function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 0x9e3779b9;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic Fisher-Yates shuffle; returns a new array. */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const next = seededRandom(seed);
  const out = [...items];
  for (let index = out.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(next() * (index + 1));
    [out[index], out[swap]] = [out[swap], out[index]];
  }
  return out;
}

export function normalizeIconId(value: unknown): string | undefined {
  const raw = cleanText(value);
  if (!raw) return undefined;
  const id = raw
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id) && id.length <= OUTLINE_LIMITS.icon ? id : undefined;
}

export function normalizeLanguage(value: unknown): string | undefined {
  const raw = cleanText(value).toLowerCase();
  if (!raw) return undefined;
  const named: Record<string, string> = {
    english: "en",
    inglés: "en",
    anglais: "en",
    spanish: "es",
    español: "es",
    espagnol: "es",
    castellano: "es",
    french: "fr",
    francés: "fr",
    français: "fr",
    francais: "fr",
    german: "de",
    deutsch: "de",
    portuguese: "pt",
    português: "pt",
    italian: "it",
    italiano: "it",
    khmer: "km",
    chinese: "zh",
    japanese: "ja",
    korean: "ko",
    arabic: "ar",
    vietnamese: "vi",
    thai: "th",
  };
  if (named[raw]) return named[raw];
  const code = raw.replace("_", "-");
  return /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(code) ? code : undefined;
}

/* ------------------------------------------------------------------ */
/* Tolerant JSON extraction                                             */
/* ------------------------------------------------------------------ */

const WORD_LITERALS: Record<string, string> = {
  True: "true",
  False: "false",
  None: "null",
  undefined: "null",
  NaN: "null",
  Infinity: "null",
};

function isUsableJson(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => item !== null && typeof item === "object");
  return value !== null && typeof value === "object";
}

function tryJson(text: string): unknown {
  try {
    const value: unknown = JSON.parse(text);
    return isUsableJson(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function stringStartBefore(text: string, endQuote: number): number {
  for (let index = endQuote - 1; index >= 0; index -= 1) {
    if (text[index] !== '"') continue;
    let slashes = 0;
    for (let back = index - 1; back >= 0 && text[back] === "\\"; back -= 1) slashes += 1;
    if (slashes % 2 === 0) return index;
  }
  return -1;
}

function closeJson(text: string, open: readonly string[]): string {
  let out = text.replace(/\s+$/, "");
  if (open[open.length - 1] === "}") {
    if (out.endsWith(":")) out = out.slice(0, -1).replace(/\s+$/, "");
    if (out.endsWith('"')) {
      const start = stringStartBefore(out, out.length - 1);
      const before = start > 0 ? out.slice(0, start).replace(/\s+$/, "") : "";
      if (start > 0 && (before.endsWith("{") || before.endsWith(","))) out = before;
    }
  }
  out = out.replace(/[,:]\s*$/, "");
  for (let index = open.length - 1; index >= 0; index -= 1) {
    out = `${out.replace(/,\s*$/, "")}${open[index]}`;
  }
  return out;
}

interface RepairCandidate {
  text: string;
  /** Brackets had to be closed because the reply stopped early. */
  truncated: boolean;
  /** The unfinished last item was cut back to the previous comma. */
  dropped: boolean;
}

/** String-aware repair pass: comments, trailing commas, unquoted keys, Python literals, truncation. */
function repairJsonCandidates(input: string, singleQuotes: boolean): RepairCandidate[] {
  let out = "";
  const stack: string[] = [];
  const cuts: { at: number; open: string[] }[] = [];
  let quote: string | null = null;
  let index = 0;
  while (index < input.length) {
    const ch = input[index];
    if (quote) {
      if (ch === "\\") {
        const next = input[index + 1];
        if (next === undefined) {
          index += 1;
          continue;
        }
        out += quote === "'" && next === "'" ? "'" : ch + next;
        index += 2;
        continue;
      }
      if (ch === quote) {
        out += '"';
        quote = null;
      } else if (ch === '"') out += '\\"';
      else if (ch === "\n") out += "\\n";
      else if (ch === "\t") out += "\\t";
      else if (ch !== "\r") out += ch;
      index += 1;
      continue;
    }
    if (ch === '"' || (singleQuotes && ch === "'")) {
      quote = ch;
      out += '"';
      index += 1;
      continue;
    }
    if (ch === "/" && input[index + 1] === "/") {
      const newline = input.indexOf("\n", index);
      index = newline < 0 ? input.length : newline;
      continue;
    }
    if (ch === "/" && input[index + 1] === "*") {
      const end = input.indexOf("*/", index + 2);
      index = end < 0 ? input.length : end + 2;
      continue;
    }
    if (ch === "{" || ch === "[") {
      stack.push(ch === "{" ? "}" : "]");
      out += ch;
      index += 1;
      continue;
    }
    if (ch === "}" || ch === "]") {
      out = out.replace(/,\s*$/, "");
      stack.pop();
      out += ch;
      index += 1;
      if (!stack.length) break;
      continue;
    }
    if (ch === ",") {
      cuts.push({ at: out.length, open: [...stack] });
      out += ch;
      index += 1;
      continue;
    }
    if (/[\p{L}_$]/u.test(ch)) {
      let end = index;
      while (end < input.length && /[\p{L}\p{N}_$]/u.test(input[end])) end += 1;
      const word = input.slice(index, end);
      const isKey = /^\s*:/.test(input.slice(end, end + 8)) && /[{,]\s*$/.test(out);
      out += isKey ? JSON.stringify(word) : (WORD_LITERALS[word] ?? word);
      index = end;
      continue;
    }
    out += ch;
    index += 1;
  }
  const openString = quote !== null;
  if (openString) out += '"';
  if (!stack.length) return [{ text: out, truncated: false, dropped: false }];
  const closed: RepairCandidate = { text: closeJson(out, stack), truncated: true, dropped: false };
  const cutBack = cuts
    .slice(-8)
    .reverse()
    .map((cut): RepairCandidate => ({ text: closeJson(out.slice(0, cut.at), cut.open), truncated: true, dropped: true }));
  // A string still open at the end is a half-written item ("make ener"): drop it first.
  return openString ? [...cutBack, closed] : [closed, ...cutBack];
}

function replaceSmartQuotes(text: string): string {
  return text.replace(/[“”„‟]/g, '"').replace(/[‘’‚‛]/g, "'");
}

/**
 * Pulls the first usable JSON object/array out of a model reply: handles code fences,
 * leading/trailing prose, trailing commas, comments, unquoted keys, truncated output and,
 * as a last resort, single-quoted strings. Returns undefined when nothing usable is found.
 */
export function extractJson(raw: string): unknown {
  return extractJsonReport(raw)?.value;
}

interface ExtractedJson {
  value: unknown;
  truncated: boolean;
  dropped: boolean;
}

function extractJsonReport(raw: string): ExtractedJson | undefined {
  const text = raw.replace(/^\uFEFF/, "").trim();
  if (!text) return undefined;
  const candidates: string[] = [];
  for (const match of text.matchAll(/```[\w-]*[ \t]*\n?([\s\S]*?)(?:```|$)/g)) {
    if (match[1]?.trim()) candidates.push(match[1].trim());
  }
  candidates.push(text);

  for (const candidate of candidates) {
    const direct = tryJson(candidate);
    if (direct !== undefined) return { value: direct, truncated: false, dropped: false };
  }

  for (const singleQuotes of [false, true]) {
    for (const candidate of candidates) {
      for (const variant of singleQuotes ? [candidate] : [candidate, replaceSmartQuotes(candidate)]) {
        const starts = [variant.indexOf("{"), variant.indexOf("[")].filter((at) => at >= 0).sort((a, b) => a - b);
        for (const start of starts) {
          for (const repaired of repairJsonCandidates(variant.slice(start), singleQuotes)) {
            const value = tryJson(repaired.text);
            if (value !== undefined) return { value, truncated: repaired.truncated, dropped: repaired.dropped };
          }
        }
      }
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Field readers                                                        */
/* ------------------------------------------------------------------ */

type Obj = Record<string, unknown>;

function asObj(value: unknown): Obj | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : null;
}

function keyOf(key: string) {
  return key.toLowerCase().replace(/[\s_-]/g, "");
}

function reader(obj: Obj) {
  const keys = new Map<string, string>();
  for (const key of Object.keys(obj)) {
    const normalized = keyOf(key);
    if (!keys.has(normalized)) keys.set(normalized, key);
  }
  return (...names: string[]): unknown => {
    for (const name of names) {
      const key = keys.get(keyOf(name));
      if (key === undefined) continue;
      const value = obj[key];
      if (value !== undefined && value !== null && value !== "") return value;
    }
    return undefined;
  };
}

const TEXT_KEYS = ["text", "title", "label", "value", "content", "point", "name", "prompt", "description", "statement"];

function textOf(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return cleanText(value);
  const obj = asObj(value);
  if (!obj) return "";
  const get = reader(obj);
  const title = cleanText(get("title", "label", "name", "term"));
  const body = cleanText(get("body", "description", "detail", "details", "text", "content", "definition"));
  if (title && body && title !== body) return `${title}: ${body}`;
  return cleanText(get(...TEXT_KEYS));
}

function listOf(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value.map((item) => stripListMarker(textOf(item))).filter(Boolean);
  if (typeof value === "string") {
    const text = cleanMultiline(value);
    const lines = text.split("\n").map((line) => stripListMarker(line)).filter(Boolean);
    return lines.length ? lines : [];
  }
  const single = stripListMarker(textOf(value));
  return single ? [single] : [];
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = foldText(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function clampList(items: string[], count: number, max: number): string[] {
  return dedupe(items)
    .slice(0, count)
    .map((item) => clampText(item, max));
}

/** Splits a free-text/HTML/markdown body into list items and remaining prose. */
function splitBodyAndBullets(value: string): { bullets: string[]; body: string } {
  const text = cleanMultiline(value);
  const bullets: string[] = [];
  const prose: string[] = [];
  for (const line of text.split("\n")) {
    if (LIST_MARKER.test(line)) bullets.push(stripListMarker(line));
    else prose.push(line);
  }
  return {
    bullets: bullets.filter(Boolean),
    body: prose.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
  };
}

/* ------------------------------------------------------------------ */
/* Normalizers                                                          */
/* ------------------------------------------------------------------ */

const KIND_ALIASES: Record<string, OutlineSectionKind> = {
  concept: "concept",
  content: "concept",
  text: "concept",
  definition: "concept",
  idea: "concept",
  explanation: "concept",
  intro: "concept",
  introduction: "concept",
  overview: "concept",
  bullets: "concept",
  example: "example",
  examples: "example",
  case: "example",
  casestudy: "example",
  walkthrough: "example",
  demo: "example",
  demonstration: "example",
  steps: "steps",
  step: "steps",
  process: "steps",
  procedure: "steps",
  howto: "steps",
  instructions: "steps",
  sequence: "steps",
  compare: "compare",
  comparison: "compare",
  contrast: "compare",
  versus: "compare",
  vs: "compare",
  timeline: "timeline",
  history: "timeline",
  chronology: "timeline",
  stat: "stat",
  stats: "stat",
  statistic: "stat",
  statistics: "stat",
  number: "stat",
  fact: "stat",
  metric: "stat",
  quote: "quote",
  quotation: "quote",
  question: "question",
  questions: "question",
  socratic: "question",
  discussion: "question",
  check: "question",
  prompt: "question",
  activity: "activity",
  practice: "activity",
  exercise: "activity",
  task: "activity",
  game: "activity",
  summary: "summary",
  recap: "summary",
  conclusion: "summary",
  takeaways: "summary",
  keytakeaways: "summary",
  review: "summary",
  wrapup: "summary",
};

export function normalizeSectionKind(value: unknown): OutlineSectionKind | undefined {
  const key = keyOf(cleanText(value)).replace(/[^a-z]/g, "");
  if (!key) return undefined;
  if ((SECTION_KINDS as string[]).includes(key)) return key as OutlineSectionKind;
  return KIND_ALIASES[key];
}

const QUESTION_TYPE_ALIASES: Record<string, OutlineQuestionType> = {
  mcq: "mcq",
  mc: "mcq",
  multiplechoice: "mcq",
  multiple: "mcq",
  choice: "mcq",
  singlechoice: "mcq",
  truefalse: "true_false",
  tf: "true_false",
  boolean: "true_false",
  yesno: "true_false",
  fillblank: "fill_blank",
  fillintheblank: "fill_blank",
  fillintheblanks: "fill_blank",
  fill: "fill_blank",
  cloze: "fill_blank",
  blank: "fill_blank",
  short: "short",
  shortanswer: "short",
  longanswer: "short",
  open: "short",
  openended: "short",
  essay: "short",
  written: "short",
  match: "match",
  matching: "match",
  pairs: "match",
};

export function normalizeQuestionType(value: unknown): OutlineQuestionType | undefined {
  const key = keyOf(cleanText(value)).replace(/[^a-z]/g, "");
  return key ? QUESTION_TYPE_ALIASES[key] : undefined;
}

function normalizePurpose(value: unknown): OutlineQuestion["purpose"] | undefined {
  const key = keyOf(cleanText(value)).replace(/[^a-z]/g, "");
  if (!key) return undefined;
  if (/^(diagnostic|pre|pretest|warmup|entry|prior)/.test(key)) return "diagnostic";
  if (/^(check|micro|microcheck|formative|quickcheck|during)/.test(key)) return "check";
  if (/^(final|exit|exitticket|summative|post|posttest|quiz|assessment|finalquiz)/.test(key)) return "final";
  return undefined;
}

function normalizeLevel(value: unknown): LessonOutline["level"] | undefined {
  const key = keyOf(cleanText(value));
  if (!key) return undefined;
  if (/^(beginner|basic|intro|introductory|easy|elementary|novice|principiante|básico|basico|débutant|debutant)/.test(key)) return "beginner";
  if (/^(intermediate|medium|moderate|intermedio|intermédiaire|intermediaire)/.test(key)) return "intermediate";
  if (/^(advanced|expert|hard|difficult|avanzado|avancé|avance)/.test(key)) return "advanced";
  return undefined;
}

function normalizeActivityKind(value: unknown): ActivityKind {
  const key = keyOf(cleanText(value));
  if (/^(poll|vote|survey|encuesta|sondage)/.test(key)) return "poll";
  if (/^(reflect|reflection|journal|exit|reflexi|réflexion)/.test(key)) return "reflection";
  if (/^(match|pair|relacion|association)/.test(key)) return "matching";
  if (/^(practice|exercise|task|activity|game|sprint|drill|práctica|practica|ejercicio|exercice|pratique)/.test(key)) return "practice";
  return "discussion";
}

const TRUE_WORDS = new Set(["true", "t", "yes", "y", "verdadero", "v", "vrai", "correct", "right", "si", "sí", "oui", "1"]);
const FALSE_WORDS = new Set(["false", "f", "no", "n", "falso", "faux", "incorrect", "wrong", "non", "0"]);

export function parseBooleanAnswer(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1 ? true : value === 0 ? false : undefined;
  const key = cleanText(value).toLowerCase().replace(/[.!]$/, "");
  if (TRUE_WORDS.has(key)) return true;
  if (FALSE_WORDS.has(key)) return false;
  return undefined;
}

/** Like parseBooleanAnswer, but only for words ("True", "no", "Vrai"): digits and single letters stay text. */
export function parseBooleanWord(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  const key = cleanText(value).toLowerCase().replace(/[.!]$/, "");
  return Array.from(key).length >= 2 && !/^\d+$/.test(key) ? parseBooleanAnswer(key) : undefined;
}

const OBJECTIVE_PREFIX =
  /^(?:by the end of (?:this|the) (?:lesson|unit|session|course)[^,]*,\s*)?(?:(?:you|students|learners|participants) (?:will|should|can) (?:be able to\s+)?)|^(?:al (?:final|terminar) de (?:esta|la) (?:lección|clase|unidad)[^,]*,\s*)?(?:(?:podrás|los estudiantes podrán|serás capaz de)\s+)|^(?:à la fin de (?:cette|la) (?:leçon|séance|unité)[^,]*,\s*)?(?:(?:vous serez capable de|vous pourrez|les élèves pourront)\s+)/i;

function cleanObjective(text: string): string {
  const stripped = text.replace(OBJECTIVE_PREFIX, "").replace(/^[,:;\s]+/, "").trim();
  return capitalize(stripped || text);
}

const BLANK_SOURCE = /_{3,}|\[\s*blank\s*\]|\{\{\s*blank\s*\}\}|\(\s*blank\s*\)/.source;
const HAS_BLANK = new RegExp(BLANK_SOURCE, "i");

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Replaces the first whole-word occurrence of `term` in `text` with a blank. */
export function blankOut(text: string, term: string): string | undefined {
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(term)}(?=$|[^\\p{L}\\p{N}])`, "iu");
  if (!pattern.test(text)) return undefined;
  return text.replace(pattern, (_, lead: string) => `${lead}${BLANK}`);
}

/* ------------------------------------------------------------------ */
/* Section coercion                                                     */
/* ------------------------------------------------------------------ */

const STAT_LEAD =
  /^([~≈<>±]?\s?[$€£¥₹]?\d[\d.,]*(?:\s?(?:%|‰|°[CF]?|x|×|k|K|M|B|bn|million|billion|trillion|millones|millón|milliards?|millions?))?(?:\s?(?:in|de|sur|of)\s\d[\d.,]*)?)\s+(.{2,})$/u;

/** Parses "72% of learners …" into a stat; ignores bare years. */
export function parseStatLine(text: string): { value: string; label: string } | undefined {
  const match = STAT_LEAD.exec(text.trim());
  if (!match) return undefined;
  const value = match[1].trim();
  if (/^\d{4}$/.test(value) && Number(value) >= 1000 && Number(value) <= 2100) return undefined;
  return { value: clampText(value, OUTLINE_LIMITS.statValue), label: clampText(match[2].replace(/^[:\-–—]\s*/, "").trim(), OUTLINE_LIMITS.statLabel) };
}

function coerceStat(value: unknown): { value: string; label: string } | undefined {
  if (typeof value === "string" || typeof value === "number") {
    const text = cleanText(value);
    return parseStatLine(text) ?? (/\d/.test(text) ? { value: clampText(text, OUTLINE_LIMITS.statValue), label: "" } : undefined);
  }
  const obj = asObj(value);
  if (!obj) return undefined;
  const get = reader(obj);
  const statValue = cleanText(get("value", "number", "figure", "stat", "metric", "amount"));
  if (!statValue) return undefined;
  return {
    value: clampText(statValue, OUTLINE_LIMITS.statValue),
    label: clampText(cleanText(get("label", "caption", "description", "text", "meaning", "context")), OUTLINE_LIMITS.statLabel),
  };
}

function stripQuoteMarks(text: string): string {
  return text.replace(/^["“”«»„'‘’\s]+|["“”«»„'‘’\s]+$/g, "").trim();
}

function coerceQuote(value: unknown): { text: string; author?: string } | undefined {
  if (typeof value === "string") {
    const text = cleanText(value);
    const match = /^(.*?)\s+[—–-]\s*([^—–-]{2,60})$/.exec(text);
    const quoteText = stripQuoteMarks(match && /["“”«»]/.test(match[1]) ? match[1] : text);
    if (!quoteText) return undefined;
    const author = match && /["“”«»]/.test(match[1]) ? cleanText(match[2]) : "";
    return author
      ? { text: clampText(quoteText, OUTLINE_LIMITS.quote), author: clampText(author, OUTLINE_LIMITS.quoteAuthor) }
      : { text: clampText(quoteText, OUTLINE_LIMITS.quote) };
  }
  const obj = asObj(value);
  if (!obj) return undefined;
  const get = reader(obj);
  const text = stripQuoteMarks(cleanText(get("text", "quote", "content", "value", "body")));
  if (!text) return undefined;
  const author = cleanText(get("author", "by", "source", "attribution", "speaker", "who")).replace(/^[—–-]\s*/, "");
  return author
    ? { text: clampText(text, OUTLINE_LIMITS.quote), author: clampText(author, OUTLINE_LIMITS.quoteAuthor) }
    : { text: clampText(text, OUTLINE_LIMITS.quote) };
}

type CompareSide = { label: string; points: string[] };

function coerceSide(value: unknown): CompareSide | undefined {
  const obj = asObj(value);
  if (!obj) return undefined;
  const get = reader(obj);
  const label = clampText(cleanText(get("label", "title", "name", "heading", "side")), OUTLINE_LIMITS.compareLabel);
  const points = clampList(listOf(get("points", "items", "bullets", "list", "values", "features")), OUTLINE_LIMITS.comparePoints, OUTLINE_LIMITS.bullet);
  return label && points.length ? { label, points } : undefined;
}

function coerceCompare(value: unknown): OutlineSection["compare"] | undefined {
  if (Array.isArray(value)) {
    const sides = value.map(coerceSide).filter((side): side is CompareSide => Boolean(side));
    return sides.length >= 2 ? { a: sides[0], b: sides[1] } : undefined;
  }
  const obj = asObj(value);
  if (!obj) return undefined;
  const get = reader(obj);
  const a = coerceSide(get("a", "left", "first", "one", "A"));
  const b = coerceSide(get("b", "right", "second", "two", "B"));
  return a && b ? { a, b } : undefined;
}

function stepText(value: unknown): string {
  const obj = asObj(value);
  if (obj) {
    const get = reader(obj);
    const date = cleanText(get("date", "year", "when", "time", "period"));
    const event = cleanText(get("event", "text", "description", "title", "label", "what", "body"));
    if (date && event) return `${date} — ${event}`;
  }
  return stripListMarker(textOf(value));
}

function firstWords(text: string, count: number): string {
  return text.split(/\s+/).filter(Boolean).slice(0, count).join(" ").replace(/[,:;.!?]+$/, "");
}

interface SectionResult {
  section: OutlineSection;
}

function coerceSection(raw: unknown, path: string, issues: OutlineIssue[]): SectionResult | null {
  if (typeof raw === "string") {
    const lines = cleanMultiline(raw).split("\n").map((line) => stripListMarker(line)).filter(Boolean);
    if (!lines.length) {
      issues.push({ path, message: "Empty section dropped." });
      return null;
    }
    return {
      section: {
        kind: "concept",
        heading: clampText(lines[0], OUTLINE_LIMITS.heading),
        bullets: clampList(lines.slice(1), OUTLINE_LIMITS.bullets, OUTLINE_LIMITS.bullet),
      },
    };
  }
  const obj = asObj(raw);
  if (!obj) {
    issues.push({ path, message: "Section is not an object; dropped." });
    return null;
  }
  const get = reader(obj);
  const declaredKind = get("kind", "type", "sectionType", "layout", "contentType");
  let kind = normalizeSectionKind(declaredKind);
  if (declaredKind !== undefined && !kind) issues.push({ path: `${path}.kind`, message: "Unknown kind; inferred from content." });

  let heading = cleanText(get("heading", "title", "name", "label", "header", "topic"));
  const rawBullets = get("bullets", "points", "onScreenText", "keyPoints", "items", "list", "takeaways");
  let bullets = listOf(rawBullets);
  const rawContent = get("body", "content", "text", "description", "explanation", "paragraph", "summary", "details");
  let body = "";
  if (Array.isArray(rawContent)) {
    bullets = bullets.length ? bullets : listOf(rawContent);
  } else if (typeof rawContent === "string") {
    const split = splitBodyAndBullets(rawContent);
    body = split.body;
    if (!bullets.length) bullets = split.bullets;
  }

  const rawSteps = get("steps", "procedure", "sequence", "events", "timeline", "stages");
  let steps = Array.isArray(rawSteps) ? rawSteps.map(stepText).filter(Boolean) : listOf(rawSteps);
  const compare = coerceCompare(get("compare", "comparison", "columns", "sides", "versus", "contrast"));
  const rawStats = get("stats", "statistics");
  let stat = coerceStat(get("stat", "statistic", "metric"));
  if (!stat && Array.isArray(rawStats)) {
    const stats = rawStats.map(coerceStat).filter((item): item is { value: string; label: string } => Boolean(item));
    stat = stats[0];
    bullets = [...bullets, ...stats.slice(1).map((item) => `${item.value} ${item.label}`.trim())];
  }
  let quote = coerceQuote(get("quote", "quotation", "citation"));
  const imageQuery = clampText(cleanText(get("imageQuery", "image", "imagePrompt", "imageSearch", "photo", "visual", "visualSuggestion")), OUTLINE_LIMITS.imageQuery);
  const icon = normalizeIconId(get("icon", "iconId", "iconName"));
  const notes = clampText(cleanMultiline(get("notes", "speakerNotes", "teacherNotes", "presenterNotes")), OUTLINE_LIMITS.notes);

  if (!kind) {
    if (steps.length >= 2) kind = "steps";
    else if (compare) kind = "compare";
    else if (stat) kind = "stat";
    else if (quote) kind = "quote";
    else if (heading.endsWith("?")) kind = "question";
    else kind = "concept";
  }

  if ((kind === "steps" || kind === "timeline") && !steps.length && bullets.length) {
    steps = bullets;
    bullets = [];
  }
  if (kind === "compare" && !compare) {
    issues.push({ path: `${path}.compare`, message: "Compare section without two labelled sides; kept as concept." });
    kind = "concept";
  }
  if (kind === "stat" && !stat) {
    const index = bullets.findIndex((bullet) => parseStatLine(bullet));
    const parsed = index >= 0 ? parseStatLine(bullets[index]) : parseStatLine(heading);
    if (parsed) {
      stat = parsed;
      if (index >= 0) bullets = bullets.filter((_, bulletIndex) => bulletIndex !== index);
    } else {
      issues.push({ path: `${path}.stat`, message: "Stat section without a value; kept as concept." });
      kind = "concept";
    }
  }
  if (kind === "quote" && !quote) {
    const source = body || bullets[0];
    quote = source ? coerceQuote(source) : undefined;
    if (quote) {
      if (body) body = "";
      else bullets = bullets.slice(1);
    } else {
      issues.push({ path: `${path}.quote`, message: "Quote section without text; kept as concept." });
      kind = "concept";
    }
  }

  const hasContent = bullets.length || body || steps.length || compare || stat || quote;
  if (!heading && !hasContent) {
    issues.push({ path, message: "Empty section dropped." });
    return null;
  }
  if (!heading) {
    const source = bullets[0] || steps[0] || body || quote?.text || (stat ? stat.label || stat.value : "");
    heading = firstWords(source, 6);
    issues.push({ path: `${path}.heading`, message: "Missing heading; derived from content." });
  }
  if (bullets.length > OUTLINE_LIMITS.bullets) issues.push({ path: `${path}.bullets`, message: `Trimmed to ${OUTLINE_LIMITS.bullets} bullets.` });

  const section: OutlineSection = {
    kind,
    heading: clampText(heading, OUTLINE_LIMITS.heading),
    bullets: clampList(bullets, OUTLINE_LIMITS.bullets, OUTLINE_LIMITS.bullet),
  };
  if (body) section.body = clampText(body, OUTLINE_LIMITS.body);
  if (steps.length) section.steps = clampList(steps, OUTLINE_LIMITS.steps, OUTLINE_LIMITS.step);
  if (compare) section.compare = compare;
  if (stat) section.stat = stat;
  if (quote) section.quote = quote;
  if (imageQuery) section.imageQuery = imageQuery;
  if (icon) section.icon = icon;
  if (notes) section.notes = notes;
  return { section };
}

/* ------------------------------------------------------------------ */
/* Question coercion                                                    */
/* ------------------------------------------------------------------ */

interface ChoiceInput {
  text: string;
  id?: string;
  correct?: boolean;
}

const CHOICE_PREFIX = /^\(?([a-fA-F])[.)]\s+/;
const CORRECT_SUFFIX = /\s*(?:\(correct\)|\*|✓|✔)$/i;
const ANSWER_LABEL = /^(?:correct answer|answer|respuesta correcta|respuesta|bonne réponse|réponse)\s*[:\-]\s*/i;

function coerceChoice(value: unknown): ChoiceInput | null {
  if (typeof value === "string" || typeof value === "number") {
    const raw = cleanText(value);
    const marked = CORRECT_SUFFIX.test(raw);
    const text = raw.replace(CORRECT_SUFFIX, "").trim();
    return text ? { text, correct: marked || undefined } : null;
  }
  const obj = asObj(value);
  if (!obj) return null;
  const get = reader(obj);
  const text = cleanText(get("text", "label", "value", "option", "choice", "answer", "content"));
  if (!text) return null;
  const flag = get("isCorrect", "correct", "right", "is_answer");
  const id = cleanText(get("id", "key", "letter"));
  return { text, id: id || undefined, correct: flag === undefined ? undefined : parseBooleanAnswer(flag) === true };
}

/**
 * Strips "a) … b) …" prefixes only when every choice has one and the letters run a, b, c…
 * in order, so initials such as "E. coli" or "C. difficile" stay intact. The stripped
 * letter becomes the choice id when it has none.
 */
function stripChoiceLetters(choices: ChoiceInput[]): ChoiceInput[] {
  const letters = choices.map((choice) => CHOICE_PREFIX.exec(choice.text)?.[1].toLowerCase());
  if (!choices.length || letters.some((letter, index) => letter !== String.fromCharCode(97 + index))) return choices;
  return choices.map((choice, index) => ({ ...choice, text: choice.text.replace(CHOICE_PREFIX, ""), id: choice.id ?? letters[index] }));
}

function letterIndex(text: string, count: number): number | undefined {
  const letter = /^(?:option\s+|choice\s+|opción\s+|réponse\s+)?\(?([a-f])\)?(?:[.):\s]|$)/i.exec(text);
  if (!letter || !(text.length <= 3 || /^\(?[a-f][.)]/i.test(text) || /^(option|choice|opción|réponse)\s/i.test(text))) return undefined;
  const index = letter[1].toLowerCase().charCodeAt(0) - 97;
  return index < count ? index : undefined;
}

function digitIndex(text: string, count: number): number | undefined {
  if (!/^\d+$/.test(text)) return undefined;
  const index = Number(text);
  if (index < count) return index;
  return index === count ? index - 1 : undefined;
}

/**
 * Correct choice from a flag, a 0-based number, an id, the exact choice text, then a letter
 * ("B", "b)") or digit string. Text beats letters and digits so choices like "4" or
 * "C. difficile" key correctly; `onAmbiguous` runs when a bare digit or letter answer also
 * names another choice by position.
 */
function resolveChoiceIndex(raw: unknown, choices: ChoiceInput[], onAmbiguous?: () => void): number | undefined {
  const flagged = choices.findIndex((choice) => choice.correct);
  if (flagged >= 0) return flagged;
  const values = Array.isArray(raw) ? raw : [raw];
  for (const value of values) {
    if (typeof value === "number" && Number.isInteger(value)) {
      if (value >= 0 && value < choices.length) return value;
      if (value === choices.length) return value - 1;
      continue;
    }
    const obj = asObj(value);
    const text = (obj ? cleanText(reader(obj)("text", "id", "value", "label")) : cleanText(value)).replace(ANSWER_LABEL, "");
    if (!text) continue;
    const lower = text.toLowerCase();
    const byId = choices.findIndex((choice) => choice.id?.toLowerCase() === lower);
    if (byId >= 0) return byId;
    const key = foldText(text);
    const byText = key ? choices.findIndex((choice) => foldText(choice.text) === key) : -1;
    const positional = letterIndex(text, choices.length) ?? digitIndex(text, choices.length);
    if (byText >= 0) {
      if (positional !== undefined && positional !== byText && /^(?:\d+|\p{L})$/u.test(text)) onAmbiguous?.();
      return byText;
    }
    if (positional !== undefined) return positional;
    const stripped = foldText(text.replace(CHOICE_PREFIX, ""));
    const byStripped = stripped ? choices.findIndex((choice) => foldText(choice.text) === stripped) : -1;
    if (byStripped >= 0) return byStripped;
  }
  return undefined;
}

function coercePairs(value: unknown): [string, string][] {
  const pairs: [string, string][] = [];
  const push = (left: unknown, right: unknown) => {
    const a = clampText(cleanText(left), OUTLINE_LIMITS.pairSide);
    const b = clampText(cleanText(right), OUTLINE_LIMITS.pairSide);
    if (a && b) pairs.push([a, b]);
  };
  if (Array.isArray(value)) {
    for (const item of value) {
      if (Array.isArray(item)) push(item[0], item[1]);
      else if (typeof item === "string") {
        const match = /^(.+?)\s*(?:=|->|→|:|\s[–—-]\s)\s*(.+)$/.exec(item);
        if (match) push(match[1], match[2]);
      } else {
        const obj = asObj(item);
        if (!obj) continue;
        const get = reader(obj);
        push(get("left", "term", "a", "prompt", "key", "item", "from"), get("right", "definition", "b", "answer", "match", "value", "to", "meaning"));
      }
    }
  } else {
    const obj = asObj(value);
    if (obj) for (const [key, right] of Object.entries(obj)) if (typeof right === "string") push(key, right);
  }
  const seen = new Set<string>();
  return pairs
    .filter(([left]) => {
      const key = foldText(left);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, OUTLINE_LIMITS.pairs);
}

const TF_PREFIX = /^(?:true or false|true\/false|t\/f|verdadero o falso|v\/f|vrai ou faux)\s*[:?.\-–—]\s*/i;

function isTrueFalseChoices(choices: ChoiceInput[]): boolean {
  if (choices.length !== 2) return false;
  const values = choices.map((choice) => parseBooleanWord(choice.text));
  return values[0] !== undefined && values[1] !== undefined && values[0] !== values[1];
}

function normalizeBlank(prompt: string): string {
  return prompt.replace(new RegExp(BLANK_SOURCE, "gi"), BLANK);
}

function coerceQuestion(
  raw: unknown,
  path: string,
  sectionMap: Map<number, number>,
  issues: OutlineIssue[],
): OutlineQuestion | null {
  const obj = asObj(raw);
  if (!obj) {
    issues.push({ path, message: "Question is not an object; dropped." });
    return null;
  }
  const get = reader(obj);
  let prompt = cleanText(get("prompt", "question", "questionText", "text", "stem", "statement", "q", "title"));
  if (!prompt) {
    issues.push({ path, message: "Question without a prompt; dropped." });
    return null;
  }
  const placeholder = get("placeholder") === true;
  let rawChoices = get("choices", "options", "alternatives");
  const declared = normalizeQuestionType(get("type", "questionType", "kind", "format"));
  if (rawChoices === undefined && declared !== "fill_blank" && declared !== "short") rawChoices = get("answers");
  const choices = stripChoiceLetters((Array.isArray(rawChoices) ? rawChoices : []).map(coerceChoice).filter((choice): choice is ChoiceInput => Boolean(choice)));
  const pairs = coercePairs(get("pairs", "matches", "matching", "match"));
  const rawAnswer = get("answer", "correctAnswer", "answerIndex", "correctIndex", "correctAnswerId", "correctOption", "correct", "solution", "key", "answerKey");

  let type: OutlineQuestionType | undefined = declared;
  if (!type) {
    if (pairs.length >= 2) type = "match";
    else if (choices.length >= 2) type = "mcq";
    else if (parseBooleanWord(rawAnswer) !== undefined) type = "true_false";
    else if (HAS_BLANK.test(prompt)) type = "fill_blank";
    else type = "short";
  }
  if (type === "mcq" && isTrueFalseChoices(choices)) type = "true_false";

  const question: OutlineQuestion = { type, prompt: "" };
  if (type === "mcq") {
    const unique: ChoiceInput[] = [];
    const remap = new Map<number, number>();
    choices.forEach((choice, index) => {
      const existing = unique.findIndex((item) => foldText(item.text) === foldText(choice.text));
      if (existing >= 0) {
        remap.set(index, existing);
        if (choice.correct) unique[existing].correct = true;
      } else {
        remap.set(index, unique.length);
        unique.push({ ...choice });
      }
    });
    const resolved = resolveChoiceIndex(rawAnswer, choices, () =>
      issues.push({ path: `${path}.answer`, message: "Answer matched choice text; ambiguous with an index." }),
    );
    let answer = resolved === undefined ? undefined : remap.get(resolved);
    if (choices.filter((choice) => choice.correct).length > 1) issues.push({ path: `${path}.answer`, message: "Several correct choices; kept the first." });
    let kept = unique;
    if (kept.length > OUTLINE_LIMITS.choices) {
      const correct = answer === undefined ? undefined : kept[answer];
      kept = kept.slice(0, OUTLINE_LIMITS.choices);
      if (correct && !kept.includes(correct)) kept[kept.length - 1] = correct;
      answer = correct ? kept.indexOf(correct) : undefined;
    }
    if (kept.length < 2) {
      const text = cleanText(typeof rawAnswer === "string" ? rawAnswer : kept[0]?.text);
      if (!placeholder && text) {
        issues.push({ path, message: "Multiple choice without enough choices; kept as short answer." });
        question.type = "short";
        question.answer = clampText(text, OUTLINE_LIMITS.answer);
      } else if (!placeholder) {
        issues.push({ path, message: "Multiple choice without choices; dropped." });
        return null;
      } else question.choices = kept.map((choice) => clampText(choice.text, OUTLINE_LIMITS.choice));
    } else {
      question.choices = kept.map((choice) => clampText(choice.text, OUTLINE_LIMITS.choice));
      if (answer !== undefined && answer >= 0 && answer < kept.length) question.answer = answer;
      else if (!placeholder) {
        issues.push({ path: `${path}.answer`, message: "Multiple choice without a valid answer; dropped." });
        return null;
      }
    }
  } else if (type === "true_false") {
    prompt = prompt.replace(TF_PREFIX, "");
    let answer = parseBooleanAnswer(rawAnswer);
    if (choices.length === 2 && (answer === undefined || typeof rawAnswer === "number" || /^[ab]$/i.test(cleanText(rawAnswer)))) {
      const index = resolveChoiceIndex(rawAnswer, choices);
      const picked = index === undefined ? undefined : parseBooleanAnswer(choices[index].text);
      if (picked !== undefined) answer = picked;
    }
    if (answer !== undefined) question.answer = answer;
    else if (!placeholder) {
      issues.push({ path: `${path}.answer`, message: "True/false without a boolean answer; dropped." });
      return null;
    }
  } else if (type === "fill_blank") {
    let answer = cleanText(Array.isArray(rawAnswer) ? rawAnswer[0] : rawAnswer);
    if (choices.length >= 2 && (typeof rawAnswer === "number" || /^[a-f]$/i.test(answer))) {
      const index = resolveChoiceIndex(rawAnswer, choices);
      if (index !== undefined) answer = choices[index].text;
    }
    prompt = normalizeBlank(prompt);
    if (!prompt.includes(BLANK) && answer) prompt = blankOut(prompt, answer) ?? prompt;
    if (!answer && !placeholder) {
      issues.push({ path: `${path}.answer`, message: "Fill-in-the-blank without an answer; dropped." });
      return null;
    }
    if (!prompt.includes(BLANK)) {
      if (!placeholder) issues.push({ path, message: "Fill-in-the-blank without a blank; kept as short answer." });
      question.type = "short";
    }
    if (answer) question.answer = clampText(answer, OUTLINE_LIMITS.answer);
  } else if (type === "short") {
    const answer = cleanText(Array.isArray(rawAnswer) ? rawAnswer[0] : typeof rawAnswer === "object" ? "" : rawAnswer);
    if (answer) question.answer = clampText(answer, OUTLINE_LIMITS.answer);
  } else {
    if (pairs.length < 2 && !placeholder) {
      issues.push({ path, message: "Matching question needs at least two pairs; dropped." });
      return null;
    }
    if (pairs.length) question.pairs = pairs;
  }

  question.prompt = clampText(prompt, OUTLINE_LIMITS.prompt);
  const explanation = clampText(cleanText(get("explanation", "rationale", "feedback", "reason", "why")), OUTLINE_LIMITS.explanation);
  if (explanation) question.explanation = explanation;
  const purpose =
    normalizePurpose(get("purpose", "role", "stage", "phase")) ??
    (get("isDiagnostic") === true ? "diagnostic" : get("isMicroCheck") === true ? "check" : get("isFinalQuiz") === true ? "final" : undefined);
  if (purpose) question.purpose = purpose;
  const rawSection = get("section", "sectionIndex");
  if (rawSection !== undefined) {
    const index = typeof rawSection === "number" ? rawSection : Number(cleanText(rawSection));
    const mapped = Number.isInteger(index) ? sectionMap.get(index) : undefined;
    if (mapped !== undefined) question.section = mapped;
    else issues.push({ path: `${path}.section`, message: "Section index out of range; removed." });
  }
  if (placeholder) question.placeholder = true;
  return question;
}

/* ------------------------------------------------------------------ */
/* Glossary & activities                                                */
/* ------------------------------------------------------------------ */

function coerceGlossary(value: unknown, issues: OutlineIssue[]): OutlineTerm[] {
  const raw: { term: unknown; definition: unknown; example?: unknown }[] = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string") {
        const match = /^(.{1,60}?)\s*(?::|\s[–—-]\s|=)\s*(.+)$/.exec(cleanText(item));
        if (match) raw.push({ term: match[1], definition: match[2] });
        continue;
      }
      const obj = asObj(item);
      if (!obj) continue;
      const get = reader(obj);
      raw.push({
        term: get("term", "word", "name", "title", "key", "concept"),
        definition: get("definition", "meaning", "description", "def", "explanation", "value"),
        example: get("example", "usage", "sentence", "exampleSentence"),
      });
    }
  } else {
    const obj = asObj(value);
    if (obj) for (const [term, definition] of Object.entries(obj)) raw.push({ term, definition });
  }
  const seen = new Set<string>();
  const terms: OutlineTerm[] = [];
  raw.forEach((item, index) => {
    const term = stripQuoteMarks(cleanText(item.term)).replace(/[:：]+$/, "");
    const definition = cleanText(item.definition);
    if (!term || !definition) {
      issues.push({ path: `glossary[${index}]`, message: "Term without a definition; dropped." });
      return;
    }
    const key = foldText(term);
    if (seen.has(key)) return;
    seen.add(key);
    const entry: OutlineTerm = {
      term: clampText(term, OUTLINE_LIMITS.term),
      definition: clampText(capitalize(definition), OUTLINE_LIMITS.definition),
    };
    const example = cleanText(item.example);
    if (example) entry.example = clampText(example, OUTLINE_LIMITS.example);
    terms.push(entry);
  });
  return terms.slice(0, OUTLINE_LIMITS.glossary);
}

function coerceActivities(value: unknown, issues: OutlineIssue[]): OutlineActivity[] {
  if (!Array.isArray(value)) return [];
  const activities: OutlineActivity[] = [];
  value.forEach((item, index) => {
    if (typeof item === "string") {
      const prompt = cleanText(item);
      if (prompt) activities.push({ kind: "discussion", prompt: clampText(prompt, OUTLINE_LIMITS.prompt) });
      return;
    }
    const obj = asObj(item);
    if (!obj) return;
    const get = reader(obj);
    const prompt = cleanText(get("prompt", "text", "question", "instructions", "title", "description", "task"));
    if (!prompt) {
      issues.push({ path: `activities[${index}]`, message: "Activity without a prompt; dropped." });
      return;
    }
    const activity: OutlineActivity = { kind: normalizeActivityKind(get("kind", "type", "format")), prompt: clampText(prompt, OUTLINE_LIMITS.prompt) };
    const items = clampList(listOf(get("items", "options", "choices", "steps", "points")), OUTLINE_LIMITS.activityItems, OUTLINE_LIMITS.bullet);
    if (items.length) activity.items = items;
    activities.push(activity);
  });
  return activities.slice(0, OUTLINE_LIMITS.activities);
}

/* ------------------------------------------------------------------ */
/* Root handling                                                        */
/* ------------------------------------------------------------------ */

function looksLikeOutline(obj: Obj): boolean {
  const get = reader(obj);
  return ["sections", "slides", "modules", "objectives", "questions", "quiz", "quizQuestions", "glossary"].some((key) => get(key) !== undefined);
}

function looksLikeQuestion(value: unknown): boolean {
  const obj = asObj(value);
  if (!obj) return false;
  const get = reader(obj);
  return Boolean(get("question", "questionText", "prompt", "stem")) && get("choices", "options", "answer", "correctAnswer", "pairs") !== undefined && get("bullets", "points", "heading") === undefined;
}

function isLegacySlide(value: unknown): boolean {
  const obj = asObj(value);
  if (!obj) return false;
  const get = reader(obj);
  return get("slideNumber", "onScreenText", "speakerNotes", "visualSuggestion") !== undefined;
}

function fromLegacySlides(slides: unknown[]): Obj {
  const out: Obj = { sections: [] as unknown[] };
  const sections = out.sections as unknown[];
  slides.forEach((slide, index) => {
    const obj = asObj(slide);
    if (!obj) return;
    const get = reader(obj);
    const type = cleanText(get("type")).toLowerCase();
    const title = get("title");
    const lines = get("onScreenText", "bullets", "content");
    if ((type === "title" || (!type && index === 0)) && !out.title) {
      out.title = title;
      out.subtitle = listOf(lines)[0];
      return;
    }
    if (type === "objectives") {
      out.objectives = lines;
      return;
    }
    const kind =
      type === "socratic" || type === "assessment" ? "question" : type === "content" ? "concept" : type || "concept";
    sections.push({ kind, heading: title, bullets: lines, notes: get("speakerNotes", "notes") });
  });
  return out;
}

function unwrapRoot(value: unknown, issues: OutlineIssue[]): Obj {
  if (Array.isArray(value)) {
    const objects = value.filter((item) => asObj(item));
    if (objects.length === 1 && looksLikeOutline(objects[0] as Obj)) return unwrapRoot(objects[0], issues);
    const clarification = objects.map((item) => cleanText(reader(item as Obj)("clarification"))).find(Boolean);
    if (clarification) {
      issues.push({ path: "$", message: `Clarification requested: ${clarification}` });
      return {};
    }
    if (objects.length && objects.every(isLegacySlide)) return fromLegacySlides(objects);
    if (objects.length && objects.filter(looksLikeQuestion).length > objects.length / 2) return { questions: value };
    return { sections: value };
  }
  const obj = asObj(value);
  if (!obj) {
    issues.push({ path: "$", message: "Outline must be a JSON object." });
    return {};
  }
  const get = reader(obj);
  const clarification = cleanText(get("clarification"));
  if (clarification && !looksLikeOutline(obj)) issues.push({ path: "$", message: `Clarification requested: ${clarification}` });
  for (const key of ["outline", "lesson", "data", "result", "output", "response"]) {
    const inner = asObj(get(key));
    if (inner && looksLikeOutline(inner) && !looksLikeOutline(obj)) return unwrapRoot(inner, issues);
  }
  const slides = get("slides");
  if (Array.isArray(slides) && slides.length && slides.every(isLegacySlide) && get("sections") === undefined) {
    return { ...fromLegacySlides(slides), ...Object.fromEntries(Object.entries(obj).filter(([key]) => key !== "slides")) };
  }
  return obj;
}

const TITLE_NOISE =
  /\s+(?:quiz|test|exam|review|notes|worksheet|vocabulary|cuestionario|examen|repaso|apuntes|vocabulario|contrôle|controle|révision|revision|vocabulaire)$/iu;

/**
 * Title as the object of a sentence: drops trailing "quiz/notes/…" and lowercases the
 * first word when it is an article or the title is in sentence case ("Water cycle").
 */
export function titleAsSubject(title: string): string {
  const trimmed = title.replace(TITLE_NOISE, "").trim() || title.trim();
  const words = trimmed.split(/\s+/);
  const first = words[0] ?? "";
  const article = /^(?:the|a|an|el|la|los|las|le|les|un|una|une)$/i.test(first);
  const sentenceCase =
    words.length > 1 &&
    words.slice(1).every((word) => !/^\p{Lu}/u.test(word)) &&
    !/\p{Lu}/u.test(Array.from(first).slice(1).join(""));
  const commonNoun =
    words.length === 1 &&
    /^\p{Lu}\p{Ll}+$/u.test(first) &&
    /(?:sis|tions?|sions?|isms?|ity|ities|ology|ics|ments?|ness|ing|ance|ence|cy|ures?|ción|ciones|sión|ismo|dad|logía|ión|isme|ité|logie)$/u.test(first);
  return article || sentenceCase || commonNoun ? first.toLocaleLowerCase() + trimmed.slice(first.length) : trimmed;
}

function defaultObjective(title: string, language?: string): string {
  return composeStrings(language).topicObjective.explain(titleAsSubject(title));
}

function coerceOutline(root: Obj, issues: OutlineIssue[]): LessonOutline {
  const get = reader(root);
  const language = normalizeLanguage(get("language", "lang", "locale"));
  const strings = composeStrings(language);

  const rawSections = get("sections", "slides", "modules", "parts", "chapters", "blocks");
  const sections: OutlineSection[] = [];
  const sectionMap = new Map<number, number>();
  if (Array.isArray(rawSections)) {
    rawSections.forEach((raw, index) => {
      if (sections.length >= OUTLINE_LIMITS.sections) return;
      const result = coerceSection(raw, `sections[${index}]`, issues);
      if (!result) return;
      sectionMap.set(index, sections.length);
      sections.push(result.section);
    });
    if (rawSections.length > OUTLINE_LIMITS.sections) issues.push({ path: "sections", message: `Trimmed to ${OUTLINE_LIMITS.sections} sections.` });
  } else if (rawSections !== undefined) issues.push({ path: "sections", message: "Sections must be an array." });

  let title = stripQuoteMarks(cleanText(get("title", "name", "topic", "lessonTitle", "heading"))).replace(/^(?:title|topic|lesson)\s*:\s*/i, "");
  if (!title) {
    title = sections[0]?.heading ?? strings.untitled;
    issues.push({ path: "title", message: "Missing title." });
  }
  title = clampText(title, OUTLINE_LIMITS.title);

  if (!sections.length) {
    issues.push({ path: "sections", message: "No usable sections; added an empty one." });
    sections.push({ kind: "concept", heading: clampText(title, OUTLINE_LIMITS.heading), bullets: [] });
  }

  let objectives = clampList(listOf(get("objectives", "learningObjectives", "goals", "outcomes", "aims", "learningGoals")).map(cleanObjective), OUTLINE_LIMITS.objectives, OUTLINE_LIMITS.objective);
  if (!objectives.length) {
    objectives = [clampText(defaultObjective(title, language), OUTLINE_LIMITS.objective)];
    issues.push({ path: "objectives", message: "No objectives; added a default." });
  }

  const rawQuestions = get("questions", "quiz", "quizQuestions", "assessment", "checks");
  const nestedQuestions = asObj(rawQuestions) ? reader(asObj(rawQuestions) as Obj)("questions", "items") : undefined;
  const questionList = Array.isArray(rawQuestions) ? rawQuestions : Array.isArray(nestedQuestions) ? nestedQuestions : [];
  const questions: OutlineQuestion[] = [];
  const seenPrompts = new Set<string>();
  questionList.forEach((raw, index) => {
    const question = coerceQuestion(raw, `questions[${index}]`, sectionMap, issues);
    if (!question) return;
    const key = foldText(question.prompt);
    if (seenPrompts.has(key)) return;
    seenPrompts.add(key);
    questions.push(question);
  });
  if (questions.length > OUTLINE_LIMITS.questions) issues.push({ path: "questions", message: `Trimmed to ${OUTLINE_LIMITS.questions} questions.` });

  const outline: LessonOutline = {
    v: 1,
    title,
    objectives,
    sections,
    glossary: coerceGlossary(get("glossary", "glossaryTerms", "terms", "vocabulary", "keyTerms", "definitions"), issues),
    questions: questions.slice(0, OUTLINE_LIMITS.questions),
    activities: coerceActivities(get("activities", "interactions", "tasks"), issues),
  };
  const subtitle = clampText(cleanText(get("subtitle", "description", "tagline", "summary")), OUTLINE_LIMITS.subtitle);
  if (subtitle && typeof get("subtitle", "description", "tagline", "summary") === "string") outline.subtitle = subtitle;
  const audience = clampText(cleanText(get("audience", "learners", "gradeLevel", "grade")), OUTLINE_LIMITS.audience);
  if (audience) outline.audience = audience;
  const level = normalizeLevel(get("level", "difficulty", "complexity"));
  if (level) outline.level = level;
  if (language) outline.language = language;
  return outline;
}

/* ------------------------------------------------------------------ */
/* Public API                                                           */
/* ------------------------------------------------------------------ */

/**
 * Tolerant parser for AI output (string or already-parsed JSON). Never throws: invalid
 * items are dropped and reported in `issues`; the outline always satisfies the limits.
 */
export function parseOutline(raw: unknown): ParsedOutline {
  const issues: OutlineIssue[] = [];
  let value = raw;
  if (typeof raw === "string") {
    const extracted = extractJsonReport(raw);
    if (!extracted) {
      issues.push({ path: "$", message: "No JSON outline found in the response." });
      return { outline: emptyOutline(""), issues };
    }
    value = extracted.value;
    if (extracted.dropped) issues.push({ path: "$", message: "Reply was cut off; closed the JSON and dropped the unfinished item." });
    else if (extracted.truncated) issues.push({ path: "$", message: "Reply was cut off; closed the JSON." });
  }
  return { outline: coerceOutline(unwrapRoot(value, issues), issues), issues };
}

/** Coerces any outline-like value into a valid, clamped LessonOutline. Idempotent. */
export function normalizeOutline(value: unknown): LessonOutline {
  return parseOutline(value).outline;
}

/** Smallest valid outline: one objective and one empty section. */
export function emptyOutline(title: string, language?: string): LessonOutline {
  const strings = composeStrings(language);
  const clean = clampText(cleanText(title) || strings.untitled, OUTLINE_LIMITS.title);
  const outline: LessonOutline = {
    v: 1,
    title: clean,
    objectives: [clampText(defaultObjective(clean, language), OUTLINE_LIMITS.objective)],
    sections: [{ kind: "concept", heading: clampText(clean, OUTLINE_LIMITS.heading), bullets: [] }],
    glossary: [],
    questions: [],
    activities: [],
  };
  const code = normalizeLanguage(language);
  if (code) outline.language = code;
  return outline;
}

/** True when every bullet is lifted from the body (the local parser's key sentences of a paragraph). */
export function bulletsRepeatBody(section: Pick<OutlineSection, "body" | "bullets">): boolean {
  if (!section.body || !section.bullets.length) return false;
  const body = ` ${foldText(section.body)} `;
  return section.bullets.every((bullet) => {
    const key = foldText(bullet);
    return Boolean(key) && body.includes(` ${key} `);
  });
}

/** True when the outline carries no real content (only headings / defaults). */
export function isOutlineEmpty(outline: LessonOutline): boolean {
  const sectionHasContent = outline.sections.some(
    (section) => section.bullets.length || section.body || section.steps?.length || section.compare || section.stat || section.quote,
  );
  return !sectionHasContent && !outline.glossary.length && !outline.questions.some((question) => !question.placeholder);
}
