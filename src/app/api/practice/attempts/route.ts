import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import type { SessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
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

type PracticeAttemptBody = {
  mode?: string;
  sourceType?: string;
  sourceId?: string;
  elapsedSeconds?: number;
  targetSeconds?: number | null;
  items?: PracticeItem[];
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

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ data: null, error: "Authentication required." }, { status: 401 });
  }

  const body = (await request.json()) as PracticeAttemptBody;
  if (!body.mode || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ data: null, error: "Practice mode and items are required." }, { status: 400 });
  }
  if (!isPracticeMode(body.mode)) {
    return NextResponse.json({ data: null, error: "Choose a supported practice mode." }, { status: 400 });
  }

  const context = await resolveTenantContext(user);
  const mode: PracticeMode = normalizePracticeMode(body.mode);
  const attemptId = crypto.randomUUID();
  const sourceType = body.sourceType || "studio";
  const sourceId = body.sourceId || null;
  const canUseSource = await canUsePracticeSource({
    user,
    context,
    sourceType,
    sourceId,
  });
  if (!canUseSource) {
    return NextResponse.json({ data: null, error: "Practice source not found." }, { status: 404 });
  }
  const summary = summarizePracticeAttempt({
    mode,
    items: body.items,
    elapsedSeconds: Number(body.elapsedSeconds ?? 0),
    targetSeconds: body.targetSeconds ?? null,
  });
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

  const reviewCards = createReviewCards(body.items, attemptId);
  for (const item of body.items) {
    const itemId = crypto.randomUUID();
    const response = item.response === undefined ? null : JSON.stringify(item.response);
    const isCorrect = !summary.reviewCardIds.includes(item.id);
    await d1Query(
      `INSERT INTO practice_attempt_items (
        id, attempt_id, prompt, expected_answer, response, is_correct, points, explanation, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        itemId,
        attemptId,
        item.prompt,
        JSON.stringify(item.answer),
        response,
        isCorrect ? 1 : 0,
        item.points ?? 1,
        item.explanation ?? null,
        JSON.stringify(buildPracticeItemContext({ item, mode, isCorrect })),
      ],
    );

    const card = reviewCards.find((entry) => entry.id === item.id);
    if (card) {
      await d1Query(
        `INSERT INTO practice_review_cards (
          id, tenant_id, user_id, attempt_item_id, source_type, source_id,
          prompt, correct_answer, explanation, mastery, next_review_at, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
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
      );
    }
  }

  await d1Query(
    `INSERT INTO learning_events (
      id, tenant_id, actor_id, student_id, source_type, source_id, event_type, event_version, payload, created_at
    ) VALUES (?, ?, ?, ?, 'practice', ?, 'practice.attempt.completed', 1, ?, datetime('now'))`,
    [
      crypto.randomUUID(),
      context.tenant.id,
      user.id,
      user.id,
      attemptId,
      JSON.stringify({ summary, context: attemptContext }),
    ],
  );

  return NextResponse.json({ data: { attemptId, summary, context: attemptContext }, error: null });
}
