import type { ContentType, DifficultyLevel } from "@/types";

export type LearningWorkflowState =
  | "local_draft"
  | "server_draft"
  | "needs_review"
  | "published"
  | "assigned"
  | "archived"
  | "conflict";

export type LearningObjectKind =
  | "lesson_package"
  | "document"
  | "slide_deck"
  | "sheet"
  | "practice_set"
  | "discussion"
  | "assessment"
  | "content_block";

export type LearningBlockType =
  | "text"
  | "media"
  | "callout"
  | "example"
  | "activity"
  | "discussion"
  | "quiz"
  | "reflection"
  | "rubric"
  | "table"
  | "slide"
  | "embed"
  | "attachment"
  | "teacher_note";

export type LearningSourceType =
  | "studio_document"
  | "lesson"
  | "lesson_section"
  | "quiz_question"
  | "content_block"
  | "import"
  | "ai_generation"
  | "manual";

export type LearningBlockOrigin = {
  sourceType: LearningSourceType;
  sourceId: string;
};

export type LearningBlock = {
  id: string;
  type: LearningBlockType;
  title: string;
  content: Record<string, unknown>;
  orderIndex: number;
  durationMinutes: number | null;
  required: boolean;
  origin: LearningBlockOrigin;
  metadata: Record<string, unknown>;
};

export type LearningObject = {
  id: string;
  tenantId: string | null;
  ownerId: string | null;
  kind: LearningObjectKind;
  title: string;
  objectives: string[];
  audience: string | null;
  sourceType: LearningSourceType;
  sourceId: string | null;
  tags: string[];
  language: string | null;
  estimatedMinutes: number | null;
  difficulty: DifficultyLevel | null;
  state: LearningWorkflowState;
  version: number;
  blocks: LearningBlock[];
  metadata: Record<string, unknown>;
  createdAt: string | null;
  updatedAt: string | null;
};

export type LegacyStudioDocument = {
  id: string;
  kind: string;
  title: string;
  content?: Record<string, unknown> | null;
  plainText?: string | null;
  status?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type LegacyLessonSection = {
  id: string;
  lesson_id: string;
  title: string;
  content: string | null;
  content_type: ContentType | string;
  order_index: number;
  duration_minutes: number | null;
  is_required: boolean | number;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};

export type LegacyQuizQuestion = {
  id: string;
  lesson_id: string;
  section_id: string | null;
  question_text: string;
  question_type: string;
  options?: unknown;
  correct_answer?: string | null;
  explanation?: string | null;
  difficulty?: DifficultyLevel | string | null;
  points?: number | null;
  is_diagnostic?: boolean | number;
  is_micro_check?: boolean | number;
  is_final_quiz?: boolean | number;
  order_index?: number | null;
};

export type LegacyContentBlock = {
  id: string;
  tenantId?: string | null;
  tenant_id?: string | null;
  ownerId?: string | null;
  owner_id?: string | null;
  blockType?: string | null;
  block_type?: string | null;
  title: string;
  data: Record<string, unknown>;
  version?: number | null;
  status?: string | null;
  tags?: unknown;
  createdAt?: string | null;
  created_at?: string | null;
  updatedAt?: string | null;
  updated_at?: string | null;
};

const KNOWN_STATES = new Set<LearningWorkflowState>([
  "local_draft",
  "server_draft",
  "needs_review",
  "published",
  "assigned",
  "archived",
  "conflict",
]);

const BLOCK_TYPE_BY_CONTENT_TYPE: Record<string, LearningBlockType> = {
  text: "text",
  video: "media",
  image: "media",
  quiz: "quiz",
  activity: "activity",
  discussion: "discussion",
};

const BLOCK_TYPE_BY_CONTENT_BLOCK: Record<string, LearningBlockType> = {
  rich_text: "text",
  doc: "text",
  note: "text",
  sheet: "table",
  slide: "slide",
  slide_deck: "slide",
  practice: "quiz",
  quiz: "quiz",
  activity: "activity",
  discussion: "discussion",
  rubric: "rubric",
  media: "media",
  embed: "embed",
  attachment: "attachment",
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanNumber(value: unknown, fallback: number | null = null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.round(value));
}

function cleanBoolean(value: unknown) {
  return value === true || value === 1;
}

function cleanRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...value } as Record<string, unknown> : {};
}

export function normalizeLearningTags(value: unknown) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  return Array.from(
    new Set(
      source
        .map((tag) => cleanText(tag).toLowerCase())
        .filter(Boolean),
    ),
  ).slice(0, 12);
}

export function normalizeLearningWorkflowState(value: unknown): LearningWorkflowState {
  const state = cleanText(value).toLowerCase().replace(/[\s-]+/g, "_");
  if (KNOWN_STATES.has(state as LearningWorkflowState)) return state as LearningWorkflowState;
  if (state === "draft" || state === "saved") return "server_draft";
  if (state === "review") return "needs_review";
  return "server_draft";
}

export function getLearningStateLabel(state: LearningWorkflowState) {
  const labels: Record<LearningWorkflowState, string> = {
    local_draft: "Local draft",
    server_draft: "Server draft",
    needs_review: "Needs review",
    published: "Published",
    assigned: "Assigned",
    archived: "Archived",
    conflict: "Conflict",
  };
  return labels[state];
}

function mapStudioKind(kind: string): LearningObjectKind {
  if (kind === "slide") return "slide_deck";
  if (kind === "sheet") return "sheet";
  if (kind === "practice") return "practice_set";
  if (kind === "lesson") return "lesson_package";
  return "document";
}

function mapContentBlockType(type: string): LearningBlockType {
  return BLOCK_TYPE_BY_CONTENT_BLOCK[type] ?? "text";
}

function createTextBlock(input: {
  id: string;
  title: string;
  text: string;
  origin: LearningBlockOrigin;
  orderIndex?: number;
  metadata?: Record<string, unknown>;
}): LearningBlock {
  return {
    id: input.id,
    type: "text",
    title: input.title || "Untitled block",
    content: { text: input.text },
    orderIndex: input.orderIndex ?? 0,
    durationMinutes: null,
    required: true,
    origin: input.origin,
    metadata: input.metadata ?? {},
  };
}

export function studioDocumentToLearningObject(row: LegacyStudioDocument): LearningObject {
  const metadata = cleanRecord(row.metadata);
  const title = cleanText(row.title) || "Untitled Studio item";
  const plainText = cleanText(row.plainText);
  const blocks = plainText
    ? [
        createTextBlock({
          id: `${row.id}:plain-text`,
          title,
          text: plainText,
          origin: { sourceType: "studio_document", sourceId: row.id },
          metadata: { generatedFrom: "plainText" },
        }),
      ]
    : [];

  return {
    id: row.id,
    tenantId: cleanText(metadata.tenantId) || null,
    ownerId: cleanText(metadata.ownerId) || null,
    kind: mapStudioKind(cleanText(row.kind)),
    title,
    objectives: normalizeLearningTags(metadata.objectives),
    audience: cleanText(metadata.audience) || null,
    sourceType: "studio_document",
    sourceId: row.sourceId ?? row.id,
    tags: normalizeLearningTags(metadata.tags),
    language: cleanText(metadata.language) || null,
    estimatedMinutes: cleanNumber(metadata.estimatedMinutes),
    difficulty: cleanText(metadata.difficulty) as DifficultyLevel || null,
    state: normalizeLearningWorkflowState(row.status),
    version: cleanNumber(metadata.version, 1) ?? 1,
    blocks,
    metadata: { ...metadata, content: row.content ?? {} },
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

export function lessonSectionToLearningBlock(row: LegacyLessonSection): LearningBlock {
  const contentType = cleanText(row.content_type);
  const type = BLOCK_TYPE_BY_CONTENT_TYPE[contentType] ?? "text";

  return {
    id: row.id,
    type,
    title: cleanText(row.title) || "Untitled section",
    content: {
      contentType,
      text: row.content ?? "",
    },
    orderIndex: cleanNumber(row.order_index, 0) ?? 0,
    durationMinutes: cleanNumber(row.duration_minutes),
    required: cleanBoolean(row.is_required),
    origin: { sourceType: "lesson_section", sourceId: row.id },
    metadata: {
      lessonId: row.lesson_id,
      createdAt: row.created_at ?? null,
      ...cleanRecord(row.metadata),
    },
  };
}

export function quizQuestionToLearningBlock(row: LegacyQuizQuestion): LearningBlock {
  return {
    id: row.id,
    type: "quiz",
    title: cleanText(row.question_text).slice(0, 80) || "Quiz question",
    content: {
      questionText: row.question_text,
      questionType: row.question_type,
      options: row.options ?? null,
      correctAnswer: row.correct_answer ?? null,
      explanation: row.explanation ?? null,
      points: cleanNumber(row.points, 1) ?? 1,
      difficulty: row.difficulty ?? null,
    },
    orderIndex: cleanNumber(row.order_index, 0) ?? 0,
    durationMinutes: null,
    required: true,
    origin: { sourceType: "quiz_question", sourceId: row.id },
    metadata: {
      lessonId: row.lesson_id,
      sectionId: row.section_id,
      isDiagnostic: cleanBoolean(row.is_diagnostic),
      isMicroCheck: cleanBoolean(row.is_micro_check),
      isFinalQuiz: cleanBoolean(row.is_final_quiz),
    },
  };
}

export function contentBlockToLearningBlock(row: LegacyContentBlock): LearningBlock {
  const blockType = cleanText(row.blockType ?? row.block_type);

  return {
    id: row.id,
    type: mapContentBlockType(blockType),
    title: cleanText(row.title) || "Untitled content block",
    content: {
      blockType,
      data: row.data,
    },
    orderIndex: 0,
    durationMinutes: null,
    required: true,
    origin: { sourceType: "content_block", sourceId: row.id },
    metadata: {
      tenantId: row.tenantId ?? row.tenant_id ?? null,
      ownerId: row.ownerId ?? row.owner_id ?? null,
      status: normalizeLearningWorkflowState(row.status),
      version: cleanNumber(row.version, 1) ?? 1,
      tags: normalizeLearningTags(row.tags),
      createdAt: row.createdAt ?? row.created_at ?? null,
      updatedAt: row.updatedAt ?? row.updated_at ?? null,
    },
  };
}

export function createLearningObjectFromLegacy(input: {
  id: string;
  tenantId?: string | null;
  ownerId?: string | null;
  title: string;
  sourceType: LearningSourceType;
  sourceId?: string | null;
  state?: LearningWorkflowState | string | null;
  objectives?: unknown;
  audience?: string | null;
  tags?: unknown;
  language?: string | null;
  estimatedMinutes?: number | null;
  difficulty?: DifficultyLevel | null;
  blocks?: LearningBlock[];
  metadata?: Record<string, unknown>;
  createdAt?: string | null;
  updatedAt?: string | null;
}): LearningObject {
  return {
    id: input.id,
    tenantId: input.tenantId ?? null,
    ownerId: input.ownerId ?? null,
    kind: "lesson_package",
    title: cleanText(input.title) || "Untitled learning package",
    objectives: normalizeLearningTags(input.objectives),
    audience: cleanText(input.audience) || null,
    sourceType: input.sourceType,
    sourceId: input.sourceId ?? null,
    tags: normalizeLearningTags(input.tags),
    language: cleanText(input.language) || null,
    estimatedMinutes: cleanNumber(input.estimatedMinutes),
    difficulty: input.difficulty ?? null,
    state: normalizeLearningWorkflowState(input.state),
    version: 1,
    blocks: input.blocks ?? [],
    metadata: input.metadata ?? {},
    createdAt: input.createdAt ?? null,
    updatedAt: input.updatedAt ?? null,
  };
}
