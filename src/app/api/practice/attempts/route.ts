import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import type { SessionUser } from "@/lib/auth/session";
import { d1Batch, d1Query } from "@/lib/db/d1";
import type { D1Statement } from "@/lib/db/d1-adapter";
import {
  createReviewCards,
  summarizePracticeAttempt,
  type PracticeItem,
} from "@/lib/practice/engine";
import {
  buildPracticeAttemptContext,
  buildPracticeItemContext,
  buildPracticeReviewContext,
} from "@/lib/practice/attempt-context";
import { isPracticeMode, normalizePracticeMode } from "@/lib/practice/modes";
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
  readJson,
  withRoute,
} from "@/lib/security/http-errors";
import { linkTenantObject, resolveTenantContext, type TenantContext } from "@/lib/tenancy";
import {
  tenantObjectJoin,
  tenantObjectParams,
  tenantObjectPredicate,
} from "@/lib/tenancy/object-scope";
import type { PracticeMode } from "@/types";

const ATTEMPT_TABLE = "practice_attempts";
const CLASS_TABLE = "classes";
const LESSON_TABLE = "lessons";
const LOCAL_PRACTICE_SOURCE_ID = "local-practice";
const MAX_PRACTICE_ITEMS = 200;
const MAX_ANSWER_OPTIONS = 50;
const MAX_TEXT_LENGTH = 4_000;
const MAX_ID_LENGTH = 160;
const MAX_POINTS = 1_000;
const MAX_SECONDS = 7 * 24 * 60 * 60;

type PracticeAttemptBody = {
  mode?: string;
  sourceType?: unknown;
  sourceId?: unknown;
  elapsedSeconds?: unknown;
  targetSeconds?: unknown;
  items?: unknown;
};

function predicateParams(objectTable: string, tenantId: string) {
  return tenantObjectParams({ objectTable, tenantId }).slice(1);
}

async function canUseStudioSource(input: {
  user: SessionUser;
  context: TenantContext;
  sourceId: string;
}) {
  const [row] = await d1Query<{ id: string }>(
    `SELECT id
       FROM studio_documents
      WHERE id = ?
        AND tenant_id = ?
        AND (owner_id = ? OR status = 'published')
      LIMIT 1`,
    [input.sourceId, input.context.tenant.id, input.user.id],
  );
  return Boolean(row);
}

async function canUseLessonSource(input: {
  user: SessionUser;
  context: TenantContext;
  sourceId: string;
}) {
  const [row] = await d1Query<{ id: string }>(
    `SELECT l.id
       FROM lessons l
       ${tenantObjectJoin({ objectTable: LESSON_TABLE, objectAlias: "l", linkAlias: "lesson_link" })}
       LEFT JOIN classes c ON c.id = l.class_id
       ${tenantObjectJoin({ objectTable: CLASS_TABLE, objectAlias: "c", linkAlias: "class_link" })}
      WHERE l.id = ?
        AND (${tenantObjectPredicate({ linkAlias: "lesson_link" })}
          OR (l.class_id IS NOT NULL AND ${tenantObjectPredicate({ linkAlias: "class_link" })}))
        AND (
          l.class_id IS NULL
          OR EXISTS (
            SELECT 1
              FROM class_enrollments ce
             WHERE ce.class_id = l.class_id
               AND ce.student_id = ?
               AND ce.is_active = 1
          )
        )
      LIMIT 1`,
    [
      LESSON_TABLE,
      CLASS_TABLE,
      input.sourceId,
      ...predicateParams(LESSON_TABLE, input.context.tenant.id),
      ...predicateParams(CLASS_TABLE, input.context.tenant.id),
      input.user.id,
    ],
  );
  return Boolean(row);
}

async function canUsePracticeSource(input: {
  user: SessionUser;
  context: TenantContext;
  sourceType: string;
  sourceId: string | null;
}) {
  if (!input.sourceId || input.sourceId === LOCAL_PRACTICE_SOURCE_ID) return true;
  if (input.sourceType === "studio" || input.sourceType === "studio_document") {
    return canUseStudioSource({
      user: input.user,
      context: input.context,
      sourceId: input.sourceId,
    });
  }
  if (input.sourceType === "lesson") {
    return canUseLessonSource({
      user: input.user,
      context: input.context,
      sourceId: input.sourceId,
    });
  }
  return true;
}

function isAnswer(value: unknown): value is PracticeItem["answer"] {
  if (typeof value === "string") return value.length <= MAX_TEXT_LENGTH;
  if (typeof value === "boolean") return true;
  return (
    Array.isArray(value) &&
    value.length <= MAX_ANSWER_OPTIONS &&
    value.every((entry) => typeof entry === "string" && entry.length <= MAX_TEXT_LENGTH)
  );
}

function optionalText(value: unknown, label: string, maxLength: number) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || value.length > maxLength) {
    throw new BadRequestError(`${label} must be text of ${maxLength} characters or fewer.`);
  }
  return value;
}

function seconds(value: unknown, label: string) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > MAX_SECONDS) {
    throw new BadRequestError(`${label} must be a number of seconds between 0 and ${MAX_SECONDS}.`);
  }
  return value;
}

function practiceItems(value: unknown): PracticeItem[] {
  if (!Array.isArray(value) || value.length === 0) throw new BadRequestError("Practice mode and items are required.");
  if (value.length > MAX_PRACTICE_ITEMS) {
    throw new BadRequestError(`Practice attempts can include up to ${MAX_PRACTICE_ITEMS} items.`);
  }
  return value.map((raw) => {
    const item = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const id = optionalText(item.id, "Practice item id", MAX_ID_LENGTH);
    const prompt = optionalText(item.prompt, "Practice prompt", MAX_TEXT_LENGTH);
    if (!id || !prompt) throw new BadRequestError("Each practice item needs an id and a prompt.");
    const response = item.response ?? undefined;
    if (!isAnswer(item.answer) || (response !== undefined && !isAnswer(response))) {
      throw new BadRequestError("Practice answers must be text, true/false, or a list of text.");
    }
    const points = item.points ?? undefined;
    if (points !== undefined && (typeof points !== "number" || !Number.isFinite(points) || points < 0 || points > MAX_POINTS)) {
      throw new BadRequestError(`Practice item points must be between 0 and ${MAX_POINTS}.`);
    }
    return {
      id,
      prompt,
      answer: item.answer,
      response,
      explanation: optionalText(item.explanation, "Practice explanation", MAX_TEXT_LENGTH),
      points,
    };
  });
}

export const POST = withRoute(async (request) => {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError("Authentication required.");

  const body = await readJson<PracticeAttemptBody>(request);
  if (!body.mode) throw new BadRequestError("Practice mode and items are required.");
  if (!isPracticeMode(body.mode)) throw new BadRequestError("Choose a supported practice mode.");
  const items = practiceItems(body.items);
  const elapsedSeconds = seconds(body.elapsedSeconds, "Elapsed time") ?? 0;
  const targetSeconds = seconds(body.targetSeconds, "Target time");

  const context = await resolveTenantContext(user);
  const mode: PracticeMode = normalizePracticeMode(body.mode);
  const attemptId = crypto.randomUUID();
  const sourceType = optionalText(body.sourceType, "Practice source type", MAX_ID_LENGTH) ?? "studio";
  const sourceId = optionalText(body.sourceId, "Practice source", MAX_ID_LENGTH) ?? null;
  const canUseSource = await canUsePracticeSource({
    user,
    context,
    sourceType,
    sourceId,
  });
  if (!canUseSource) throw new NotFoundError("Practice source not found.");
  const summary = summarizePracticeAttempt({ mode, items, elapsedSeconds, targetSeconds });
  const attemptContext = buildPracticeAttemptContext({
    mode,
    sourceType,
    sourceId,
    summary,
  });

  await d1Query(
    `INSERT INTO practice_attempts (
      id, tenant_id, user_id, source_type, source_id, mode, target_seconds,
      elapsed_seconds, score_percent, points_earned, points_possible, summary, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      attemptId,
      context.tenant.id,
      user.id,
      sourceType,
      sourceId,
      mode,
      summary.targetSeconds,
      summary.elapsedSeconds,
      summary.percent,
      summary.pointsEarned,
      summary.pointsPossible,
      JSON.stringify({ ...summary, context: attemptContext }),
    ],
  );
  await linkTenantObject({
    tenantId: context.tenant.id,
    portalId: context.portal?.id,
    table: ATTEMPT_TABLE,
    objectId: attemptId,
  });

  // One batch instead of a round trip per item keeps large attempts fast and all-or-nothing.
  const reviewCards = new Map(createReviewCards(items, attemptId).map((card) => [card.id, card]));
  const statements: D1Statement[] = [];
  for (const item of items) {
    const itemId = crypto.randomUUID();
    const isCorrect = !summary.reviewCardIds.includes(item.id);
    statements.push({
      sql: `INSERT INTO practice_attempt_items (
        id, attempt_id, prompt, expected_answer, response, is_correct, points, explanation, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        itemId,
        attemptId,
        item.prompt,
        JSON.stringify(item.answer),
        item.response === undefined ? null : JSON.stringify(item.response),
        isCorrect ? 1 : 0,
        item.points ?? 1,
        item.explanation ?? null,
        JSON.stringify(buildPracticeItemContext({ item, mode, isCorrect })),
      ],
    });

    const card = reviewCards.get(item.id);
    if (card) {
      statements.push({
        sql: `INSERT INTO practice_review_cards (
          id, tenant_id, user_id, attempt_item_id, source_type, source_id,
          prompt, correct_answer, explanation, mastery, next_review_at, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          crypto.randomUUID(),
          context.tenant.id,
          user.id,
          itemId,
          card.sourceType,
          attemptId,
          card.prompt,
          card.correctAnswer,
          card.explanation,
          card.mastery,
          card.nextReviewAt,
          JSON.stringify(buildPracticeReviewContext({ item, mode })),
        ],
      });
    }
  }

  statements.push({
    sql: `INSERT INTO learning_events (
      id, tenant_id, actor_id, student_id, source_type, source_id, event_type, event_version, payload, created_at
    ) VALUES (?, ?, ?, ?, 'practice', ?, 'practice.attempt.completed', 1, ?, datetime('now'))`,
    params: [
      crypto.randomUUID(),
      context.tenant.id,
      user.id,
      user.id,
      attemptId,
      JSON.stringify({ summary, context: attemptContext }),
    ],
  });
  await d1Batch(statements);

  return NextResponse.json({ data: { attemptId, summary, context: attemptContext }, error: null });
});
