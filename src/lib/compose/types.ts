/**
 * Content-only contract between AI (or the local text parser) and the app.
 * No layout, colors, counts-by-position or navigation: the app designs it.
 */

export type OutlineSectionKind =
  | "concept"
  | "example"
  | "steps"
  | "compare"
  | "timeline"
  | "stat"
  | "quote"
  | "question"
  | "activity"
  | "summary";

export interface OutlineSection {
  kind: OutlineSectionKind;
  heading: string;
  bullets: string[];
  body?: string;
  steps?: string[];
  compare?: {
    a: { label: string; points: string[] };
    b: { label: string; points: string[] };
  };
  stat?: { value: string; label: string };
  quote?: { text: string; author?: string };
  imageQuery?: string;
  icon?: string;
  notes?: string;
}

export type OutlineQuestionType =
  | "mcq"
  | "true_false"
  | "fill_blank"
  | "short"
  | "match";

export interface OutlineQuestion {
  type: OutlineQuestionType;
  prompt: string;
  choices?: string[];
  /** mcq: choice index; true_false: boolean; fill_blank/short: text; match: unused. */
  answer?: number | boolean | string;
  pairs?: [string, string][];
  explanation?: string;
  purpose?: "diagnostic" | "check" | "final";
  /** Index of the section this question checks. */
  section?: number;
  /** Local parser marks generated slots the author should review. */
  placeholder?: boolean;
}

export interface OutlineTerm {
  term: string;
  definition: string;
  example?: string;
}

export interface OutlineActivity {
  kind: "discussion" | "poll" | "reflection" | "practice" | "matching";
  prompt: string;
  items?: string[];
}

export interface LessonOutline {
  v: 1;
  title: string;
  subtitle?: string;
  audience?: string;
  level?: "beginner" | "intermediate" | "advanced";
  language?: string;
  objectives: string[];
  sections: OutlineSection[];
  glossary: OutlineTerm[];
  questions: OutlineQuestion[];
  activities: OutlineActivity[];
}

export interface OutlineIssue {
  path: string;
  message: string;
}

export interface ParsedOutline {
  outline: LessonOutline;
  issues: OutlineIssue[];
}
