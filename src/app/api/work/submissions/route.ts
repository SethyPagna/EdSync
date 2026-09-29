import { NextResponse } from "next/server";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { errorMessage, jsonError, optionalId, readJsonObject } from "@/lib/grades/http";
import { GRADE_FEEDBACK_MAX_LENGTH, isGradeSourceType, validateGradeText } from "@/lib/grades/validation";
import { appendLearningEvent, recordGradeEvent } from "@/lib/learning-events";
import { resolveTenantContext } from "@/lib/tenancy";
import {
  tenantObjectJoin,
  tenantObjectParams,
  tenantObjectPredicate,
} from "@/lib/tenancy/object-scope";
import { normalizeWorkGradingSettings, workGradeContribution } from "@/lib/work/grading";
import { evaluateWorkSubmission, normalizeWorkSubmissionPolicy } from "@/lib/work/policy";
import { validateEarnedWorkPoints, validateWorkPoints, validateWorkResponse } from "@/lib/work/validation";

const WORK_ITEM_TABLE = "learning_work_items";
const ALREADY_GRADED = "This work is already graded.";

const ATTEMPT_COLUMNS = `
  (SELECT COUNT(*) FROM learning_submission_attempts a WHERE a.submission_id = ls.id) AS attempt_count,
  (SELECT a.is_late
     FROM learning_submission_attempts a
    WHERE a.submission_id = ls.id
    ORDER BY a.attempt_number DESC
    LIMIT 1) AS is_late`;

type SubmissionTarget = {
  id: string;
  class_id: string | null;
  status: string;
  allow_late: number | null;
  due_at: string | null;
  settings: string | null;
  submission_id: string | null;
  submission_status: string | null;
  attempts: number | null;
};

function percent(pointsEarned: number, pointsPossible: number) {
  return pointsPossible > 0 ? Math.round((pointsEarned / pointsPossible) * 10000) / 100 : null;
}

function isStaff(user: SessionUser) {
  return user.user_metadata.role === "teacher" || user.user_metadata.role === "admin";
}

function workScopeParams(tenantId: string) {
  return tenantObjectParams({ objectTable: WORK_ITEM_TABLE, tenantId });
}

function workPredicateParams(tenantId: string) {
  return workScopeParams(tenantId).slice(1);
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);

  const params = new URL(request.url).searchParams;
  const workItemId = params.get("workItemId");
  const context = await resolveTenantContext(user);
  if (!(await isFeatureEnabled("work_items"))) return jsonError("Assignments are unavailable.", 403);

  if (user.user_metadata.role === "student") {
    const rows = await d1Query(
      `SELECT ls.*, wi.title, wi.work_type, wi.due_at, wi.allow_late, ${ATTEMPT_COLUMNS}
         FROM learning_submissions ls
         JOIN learning_work_items wi ON wi.id = ls.work_item_id
         ${tenantObjectJoin({ objectTable: WORK_ITEM_TABLE, objectAlias: "wi", linkAlias: "work_link" })}
        WHERE ${tenantObjectPredicate({ linkAlias: "work_link" })}
          AND ls.student_id = ?
          ${workItemId ? "AND ls.work_item_id = ?" : ""}
        ORDER BY ls.updated_at DESC`,
      workItemId
        ? [...workScopeParams(context.tenant.id), user.id, workItemId]
        : [...workScopeParams(context.tenant.id), user.id],
    );
    return NextResponse.json({ data: rows, error: null });
  }

  if (!isStaff(user)) return jsonError("Teacher access required.", 403);

  const ownerWhere = user.user_metadata.role === "admin" ? "1=1" : "wi.teacher_id = ?";
  const ownerParams = user.user_metadata.role === "admin" ? [] : [user.id];
  const rows = await d1Query(
    `SELECT ls.*, wi.title, wi.work_type, wi.points_possible AS work_points_possible,
            wi.settings AS work_settings, wi.due_at, wi.allow_late, ${ATTEMPT_COLUMNS},
            p.full_name, p.email
       FROM learning_submissions ls
       JOIN learning_work_items wi ON wi.id = ls.work_item_id
       JOIN profiles p ON p.id = ls.student_id
       ${tenantObjectJoin({ objectTable: WORK_ITEM_TABLE, objectAlias: "wi", linkAlias: "work_link" })}
      WHERE ${tenantObjectPredicate({ linkAlias: "work_link" })}
        AND ${ownerWhere}
        ${workItemId ? "AND ls.work_item_id = ?" : ""}
      ORDER BY ls.updated_at DESC`,
    workItemId
      ? [...workScopeParams(context.tenant.id), ...ownerParams, workItemId]
      : [...workScopeParams(context.tenant.id), ...ownerParams],
  );
  return NextResponse.json({ data: rows, error: null });
}

/**
 * Student submission. Enforces the due date (`due_at` + `allow_late`), locks graded work unless
 * `settings.allowResubmission` is true, caps attempts at `settings.maxAttempts`, and records every
 * attempt in learning_submission_attempts.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);
  if (user.user_metadata.role !== "student") return jsonError("Student access required.", 403);

  const body = await readJsonObject(request);
  if (!body) return jsonError("Send a JSON object body.", 400);
  const workItemId = optionalId(body.workItemId);
  if (!workItemId) return jsonError("Work item is required.", 400);

  let response: Record<string, unknown>;
  try {
    response = validateWorkResponse(body.response);
  } catch (error) {
    return jsonError(errorMessage(error, "Invalid submission response."), 400);
  }
  const responseJson = JSON.stringify(response);

  const context = await resolveTenantContext(user);
  if (!(await isFeatureEnabled("work_items"))) return jsonError("Assignments are unavailable.", 403);
  const [work] = await d1Query<SubmissionTarget>(
    `SELECT wi.id, wi.class_id, wi.status, wi.allow_late, wi.due_at, wi.settings,
            ls.id AS submission_id,
            ls.status AS submission_status,
            (SELECT MAX(a.attempt_number)
               FROM learning_submission_attempts a
              WHERE a.submission_id = ls.id) AS attempts
       FROM learning_work_items wi
       ${tenantObjectJoin({ objectTable: WORK_ITEM_TABLE, objectAlias: "wi", linkAlias: "work_link" })}
       LEFT JOIN class_enrollments ce
         ON ce.class_id = wi.class_id
        AND ce.student_id = ?
        AND ce.is_active = 1
       LEFT JOIN learning_submissions ls
         ON ls.work_item_id = wi.id
        AND ls.student_id = ?
      WHERE ${tenantObjectPredicate({ linkAlias: "work_link" })}
        AND wi.id = ?
        AND (wi.class_id IS NULL OR ce.student_id = ?)
      LIMIT 1`,
    [WORK_ITEM_TABLE, user.id, user.id, ...workPredicateParams(context.tenant.id), workItemId, user.id],
  );
  if (!work || work.status !== "published") return jsonError("Work item is not available.", 404);

  const policy = normalizeWorkSubmissionPolicy(work.settings);
  const decision = evaluateWorkSubmission({
    now: Date.now(),
    dueAt: work.due_at,
    allowLate: Number(work.allow_late ?? 1) !== 0,
    policy,
    existing: work.submission_id
      ? { status: work.submission_status ?? "submitted", attempts: Number(work.attempts ?? 0) }
      : null,
  });
  if (!decision.ok) return jsonError(decision.error, decision.status);

  const allowResubmission = policy.allowResubmission ? 1 : 0;
  const created = await d1Query<{ id: string }>(
    `INSERT INTO learning_submissions (
       id, work_item_id, student_id, class_id, response, status, submitted_at, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, 'submitted', datetime('now'), datetime('now'), datetime('now'))
     ON CONFLICT(work_item_id, student_id) DO NOTHING
     RETURNING id`,
    [crypto.randomUUID(), workItemId, user.id, work.class_id, responseJson],
  );

  // Claims the next attempt number in one statement, re-checking the graded lock and the attempt cap.
  const [attempt] = await d1Query<{ submission_id: string; attempt_number: number }>(
    `INSERT INTO learning_submission_attempts (
       id, submission_id, work_item_id, student_id, attempt_number, response, is_late, submitted_at, created_at
     )
     SELECT ?, ls.id, ls.work_item_id, ls.student_id, COALESCE(MAX(a.attempt_number), 0) + 1, ?, ?,
            datetime('now'), datetime('now')
       FROM learning_submissions ls
       LEFT JOIN learning_submission_attempts a ON a.submission_id = ls.id
      WHERE ls.work_item_id = ?
        AND ls.student_id = ?
        AND (COALESCE(ls.status, '') <> 'graded' OR ? = 1)
      GROUP BY ls.id
     HAVING ? IS NULL OR COALESCE(MAX(a.attempt_number), 0) < ?
     RETURNING submission_id, attempt_number`,
    [
      crypto.randomUUID(),
      responseJson,
      decision.late ? 1 : 0,
      workItemId,
      user.id,
      allowResubmission,
      policy.maxAttempts,
      policy.maxAttempts,
    ],
  );
  if (!attempt) {
    const gradedLock = work.submission_status === "graded" || policy.maxAttempts === null;
    return jsonError(gradedLock ? ALREADY_GRADED : "No attempts left.", 409);
  }

  if (created.length === 0) {
    const updated = await d1Query<{ id: string }>(
      `UPDATE learning_submissions
          SET response = ?, status = 'submitted', submitted_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
          AND (COALESCE(status, '') <> 'graded' OR ? = 1)
        RETURNING id`,
      [responseJson, attempt.submission_id, allowResubmission],
    );
    if (updated.length === 0) return jsonError(ALREADY_GRADED, 409);
  }

  const attemptNumber = Number(attempt.attempt_number);
  const eventId = await appendLearningEvent({
    tenantId: context.tenant.id,
    actorId: user.id,
    studentId: user.id,
    classId: work.class_id,
    sourceType: "learning_work_item",
    sourceId: workItemId,
    eventType: "work.submitted",
    payload: { submissionId: attempt.submission_id, attemptNumber, isLate: decision.late },
  });
  return NextResponse.json({
    data: { id: attempt.submission_id, eventId, attemptNumber, late: decision.late },
    error: null,
  });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);
  if (!isStaff(user)) return jsonError("Teacher access required.", 403);

  const body = await readJsonObject(request);
  if (!body) return jsonError("Send a JSON object body.", 400);
  const submissionId = optionalId(body.submissionId);
  if (!submissionId) return jsonError("Submission id is required.", 400);

  const context = await resolveTenantContext(user);
  if (!(await isFeatureEnabled("work_items"))) return jsonError("Assignments are unavailable.", 403);
  const [submission] = await d1Query<{
    id: string;
    work_item_id: string;
    student_id: string;
    class_id: string | null;
    title: string;
    work_type: string;
    teacher_id: string;
    category_id: string | null;
    points_possible: number;
    settings: unknown;
  }>(
    `SELECT ls.id, ls.work_item_id, ls.student_id, ls.class_id,
            wi.title, wi.work_type, wi.teacher_id, wi.category_id, wi.points_possible, wi.settings
      FROM learning_submissions ls
      JOIN learning_work_items wi ON wi.id = ls.work_item_id
      ${tenantObjectJoin({ objectTable: WORK_ITEM_TABLE, objectAlias: "wi", linkAlias: "work_link" })}
      WHERE ${tenantObjectPredicate({ linkAlias: "work_link" })}
        AND ls.id = ?
      LIMIT 1`,
    [...workScopeParams(context.tenant.id), submissionId],
  );
  if (!submission) return jsonError("Submission not found.", 404);
  if (user.user_metadata.role !== "admin" && submission.teacher_id !== user.id) {
    return jsonError("Submission not found.", 404);
  }
  const sourceType = submission.work_type;
  if (!isGradeSourceType(sourceType)) return jsonError("This work type can't be graded.", 400);

  let pointsPossible: number;
  let pointsEarned: number;
  let feedback: string | null;
  try {
    pointsPossible = validateWorkPoints(body.pointsPossible, submission.points_possible ?? 0);
    pointsEarned = validateEarnedWorkPoints(body.pointsEarned, pointsPossible);
    feedback = validateGradeText(body.feedback, "Feedback", GRADE_FEEDBACK_MAX_LENGTH, false) || null;
  } catch (error) {
    return jsonError(errorMessage(error, "Invalid score."), 400);
  }
  const scorePercent = percent(pointsEarned, pointsPossible);
  const grading = normalizeWorkGradingSettings(submission.settings);
  const weightedContribution = workGradeContribution({ pointsEarned, pointsPossible, settings: grading });

  await d1Query(
    `UPDATE learning_submissions
        SET points_earned = ?, points_possible = ?, percent = ?, feedback = ?,
            status = 'graded', graded_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?`,
    [pointsEarned, pointsPossible, scorePercent, feedback, submission.id],
  );

  if (!grading.countsTowardGrade) {
    const eventId = await appendLearningEvent({
      tenantId: context.tenant.id,
      actorId: user.id,
      studentId: submission.student_id,
      classId: submission.class_id,
      sourceType,
      sourceId: submission.work_item_id,
      eventType: `work.${grading.mode}.feedback_recorded`,
      payload: {
        submissionId: submission.id,
        pointsEarned,
        pointsPossible,
        percent: scorePercent,
        feedback,
        grading,
      },
    });
    return NextResponse.json({ data: { graded: true, percent: scorePercent, eventId, grading }, error: null });
  }

  const result = await recordGradeEvent({
    tenantId: context.tenant.id,
    actorId: user.id,
    studentId: submission.student_id,
    classId: submission.class_id,
    sourceType,
    sourceId: submission.work_item_id,
    eventType: "grade.work_submission.recorded",
    writer: "teacher",
    teacherId: submission.teacher_id,
    title: submission.title,
    pointsEarned,
    pointsPossible,
    feedback,
    categoryId: submission.category_id,
    payload: {
      submissionId: submission.id,
      grading,
      weightedContribution,
    },
  });

  return NextResponse.json({
    data: { graded: true, percent: scorePercent, eventId: result.eventId, grading, weightedContribution },
    error: null,
  });
}
