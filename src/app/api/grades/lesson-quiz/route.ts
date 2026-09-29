import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Batch, d1Query } from "@/lib/db/d1";
import { errorMessage, jsonError, optionalId, readJsonObject } from "@/lib/grades/http";
import {
  gradeQuiz,
  parseQuizAnswers,
  quizAnswersFingerprint,
  serializeQuizAnswer,
  type QuizAnswers,
  type StoredQuizQuestion,
} from "@/lib/grades/quiz-grading";
import { validateGradePercent } from "@/lib/grades/validation";
import { questionFeedback } from "@/lib/lessons/quiz";
import { loadAccessibleLesson } from "@/lib/lessons/access";
import { recordGradeEvent } from "@/lib/learning-events";
import { resolveTenantContext } from "@/lib/tenancy";
import {
  tenantObjectJoin,
  tenantObjectParams,
  tenantObjectPredicate,
} from "@/lib/tenancy/object-scope";

const LESSON_TABLE = "lessons";
const CLASS_TABLE = "classes";
const GRADED_EVENT = "grade.lesson_quiz.recorded";
const CLAIMED_EVENT = "grade.lesson_quiz.submitted";

type LessonRow = {
  id: string;
  title: string;
  teacher_id: string;
  class_id: string | null;
  /** Class the grade is filed under: the lesson's class, else the enrolled class it was assigned to, else null. */
  grade_class_id: string | null;
};

type RecordedQuizEvent = {
  attemptNumber: number;
  fingerprint: string | null;
  score: number | null;
  maxScore: number | null;
  pendingReview: number | null;
  claimedScore: number | null;
};

type StoredAttempt = {
  question_id: string;
  answer: string | null;
  question_type: string | null;
  attempt_number: number;
};

type StoredGrade = {
  points_earned: number;
  points_possible: number;
  percent: number | null;
  status: string;
  metadata: string | null;
};

const ENROLLED_CLASS_IDS = `SELECT ec.class_id
                              FROM class_enrollments ec
                             WHERE ec.student_id = ?
                               AND ec.is_active = 1`;

// Same rule as entitledLessonIds in src/lib/security/data-access.ts.
const ENTITLED_LESSON_IDS = `SELECT ep.course_id FROM entitlements ee
        JOIN billing_products ep ON ep.id = ee.product_id AND ep.tenant_id = ee.tenant_id
        JOIN tenants et ON et.id = ee.tenant_id
       WHERE ee.user_id = ? AND ee.status = 'active' AND ep.status = 'active' AND et.status = 'active'
         AND ep.course_id IS NOT NULL
         AND (ee.starts_at IS NULL OR datetime(ee.starts_at) <= datetime('now'))
         AND (ee.ends_at IS NULL OR datetime(ee.ends_at) > datetime('now'))`;

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function jsonObjectOrEmpty(value: string | null | undefined): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function predicateParams(objectTable: string, tenantId: string) {
  return tenantObjectParams({ objectTable, tenantId }).slice(1);
}

/**
 * Loads a published lesson the student may take: the lesson's class is one they are enrolled in, it is
 * assigned to them or to one of their enrolled classes, or an active entitlement covers it.
 */
async function loadStudentLesson(lessonId: string, tenantId: string, studentId: string) {
  const [lesson] = await d1Query<LessonRow>(
    `SELECT l.id, l.title, l.teacher_id, l.class_id,
            CASE
              WHEN l.class_id IN (${ENROLLED_CLASS_IDS}) THEN l.class_id
              ELSE (SELECT la.class_id
                      FROM lesson_assignments la
                     WHERE la.lesson_id = l.id
                       AND la.is_active = 1
                       AND la.class_id IN (${ENROLLED_CLASS_IDS})
                     ORDER BY la.created_at, la.id
                     LIMIT 1)
            END AS grade_class_id
       FROM lessons l
       ${tenantObjectJoin({ objectTable: LESSON_TABLE, objectAlias: "l", linkAlias: "lesson_link" })}
       LEFT JOIN classes c ON c.id = l.class_id
       ${tenantObjectJoin({ objectTable: CLASS_TABLE, objectAlias: "c", linkAlias: "class_link" })}
      WHERE l.id = ?
        AND (${tenantObjectPredicate({ linkAlias: "lesson_link" })}
          OR (l.class_id IS NOT NULL AND ${tenantObjectPredicate({ linkAlias: "class_link" })}))
        AND l.status = 'published'
        AND (l.class_id IN (${ENROLLED_CLASS_IDS})
          OR EXISTS (SELECT 1
                       FROM lesson_assignments la
                      WHERE la.lesson_id = l.id
                        AND la.is_active = 1
                        AND (la.student_id = ? OR la.class_id IN (${ENROLLED_CLASS_IDS})))
          OR l.id IN (${ENTITLED_LESSON_IDS}))
      LIMIT 1`,
    [
      studentId,
      studentId,
      LESSON_TABLE,
      CLASS_TABLE,
      lessonId,
      ...predicateParams(LESSON_TABLE, tenantId),
      ...predicateParams(CLASS_TABLE, tenantId),
      studentId,
      studentId,
      studentId,
      studentId,
    ],
  );
  return lesson ?? null;
}

/**
 * Reads the event the student's lesson quiz gradebook row was last written from, if it has the given type.
 * Only the server writes that row, so events a client appended through /api/events are never replayed.
 */
async function loadRecordedQuizEvent(input: {
  studentId: string;
  lessonId: string;
  eventType: string;
}): Promise<RecordedQuizEvent | null> {
  const [row] = await d1Query<{ payload: string | null }>(
    `SELECT le.payload
       FROM gradebook_scores gs
       JOIN learning_events le
         ON le.id = CASE WHEN json_valid(gs.metadata) THEN json_extract(gs.metadata, '$.lastEventId') END
        AND le.event_type = ?
        AND le.student_id = gs.student_id
        AND le.source_type = gs.source_type
        AND le.source_id = gs.source_id
      WHERE gs.student_id = ?
        AND gs.source_type = 'lesson_quiz'
        AND gs.source_id = ?
      LIMIT 1`,
    [input.eventType, input.studentId, input.lessonId],
  );
  if (!row) return null;
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(row.payload || "{}") as Record<string, unknown>;
  } catch {
    payload = {};
  }
  return {
    attemptNumber: Number.isInteger(payload.attemptNumber) ? Number(payload.attemptNumber) : 0,
    fingerprint: typeof payload.fingerprint === "string" ? payload.fingerprint : null,
    score: numberOrNull(payload.score),
    maxScore: numberOrNull(payload.maxScore),
    pendingReview: numberOrNull(payload.pendingReview),
    claimedScore: numberOrNull(payload.claimedScore),
  };
}

function submittedAnswer(row: StoredAttempt): string | string[] | boolean | null {
  if (row.answer === null) return null;
  if (row.question_type === "true_false" && (row.answer === "true" || row.answer === "false")) {
    return row.answer === "true";
  }
  if (row.question_type === "multiple_choice" && row.answer.startsWith("[")) {
    try {
      const value: unknown = JSON.parse(row.answer);
      if (Array.isArray(value) && value.every((item): item is string => typeof item === "string")) return value;
    } catch {
      return row.answer;
    }
  }
  return row.answer;
}

function recordedResults(value: unknown, questionIds: Set<string>) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const result = item as Record<string, unknown>;
    if (typeof result.questionId !== "string" || !questionIds.has(result.questionId)) return [];
    if (result.correct !== null && typeof result.correct !== "boolean") return [];
    const pointsEarned = numberOrNull(result.pointsEarned);
    const pointsPossible = numberOrNull(result.pointsPossible);
    if (pointsEarned === null || pointsPossible === null) return [];
    return [{
      questionId: result.questionId,
      correct: result.correct,
      pointsEarned,
      pointsPossible,
      correctOptionIds: Array.isArray(result.correctOptionIds)
        ? result.correctOptionIds.filter((id): id is string => typeof id === "string")
        : [],
      ...(typeof result.answerText === "string" ? { answerText: result.answerText } : {}),
      ...(typeof result.explanation === "string" ? { explanation: result.explanation } : {}),
    }];
  });
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);
  if (user.user_metadata.role !== "student") return jsonError("Student access required.", 403);

  const lessonId = optionalId(new URL(request.url).searchParams.get("lessonId"));
  if (!lessonId) return jsonError("Lesson is required.", 400);

  const context = await resolveTenantContext(user);
  const accessible = await loadAccessibleLesson({
    lessonId,
    tenantId: context.tenant.id,
    tenantMember: Boolean(context.membership),
    user,
  });
  if (!accessible) return jsonError("Lesson not found.", 404);
  const lesson = await loadStudentLesson(lessonId, context.tenant.id, user.id);
  if (!lesson) return jsonError("Lesson not found.", 404);

  const attempts = await d1Query<StoredAttempt>(
    `SELECT qa.question_id, qa.answer, qq.question_type, qa.attempt_number
       FROM quiz_attempts qa
       JOIN quiz_questions qq ON qq.id = qa.question_id AND qq.lesson_id = qa.lesson_id AND qq.is_final_quiz = 1
      WHERE qa.student_id = ? AND qa.lesson_id = ?
        AND qa.attempt_number = (
          SELECT MAX(latest.attempt_number)
            FROM quiz_attempts latest
            JOIN quiz_questions final_question
              ON final_question.id = latest.question_id
             AND final_question.lesson_id = latest.lesson_id
             AND final_question.is_final_quiz = 1
           WHERE latest.student_id = ? AND latest.lesson_id = ?
        )
      ORDER BY qq.order_index, qq.created_at`,
    [user.id, lessonId, user.id, lessonId],
  );
  if (!attempts.length) return NextResponse.json({ data: { grade: null, answers: {} }, error: null });

  const attemptNumber = attempts[0].attempt_number;
  const [event] = await d1Query<{ payload: string | null }>(
    `SELECT le.payload
       FROM learning_events le
      WHERE le.tenant_id = ? AND le.student_id = ?
        AND le.source_type = 'lesson_quiz' AND le.source_id = ?
        AND le.event_type = ?
        AND json_valid(le.payload)
        AND json_extract(le.payload, '$.writer') = 'system'
        AND json_extract(le.payload, '$.attemptNumber') = ?
      ORDER BY le.rowid DESC
      LIMIT 1`,
    [context.tenant.id, user.id, lessonId, GRADED_EVENT, attemptNumber],
  );
  const [gradebook] = await d1Query<StoredGrade>(
    `SELECT points_earned, points_possible, percent, status, metadata
       FROM gradebook_scores
      WHERE student_id = ? AND source_type = 'lesson_quiz' AND source_id = ?
      LIMIT 1`,
    [user.id, lessonId],
  );
  const snapshot = jsonObjectOrEmpty(event?.payload);
  const questionIds = new Set(attempts.map((row) => row.question_id));
  const results = recordedResults(snapshot.results, questionIds);
  const answers = Object.fromEntries(attempts.flatMap((row) => {
    const answer = submittedAnswer(row);
    return answer === null ? [] : [[row.question_id, answer]];
  }));
  const score = numberOrNull(gradebook?.points_earned) ?? numberOrNull(snapshot.score);
  const maxScore = numberOrNull(gradebook?.points_possible) ?? numberOrNull(snapshot.maxScore);
  if (score === null || maxScore === null) {
    return NextResponse.json({ data: { grade: null, answers }, error: null });
  }
  const metadata = jsonObjectOrEmpty(gradebook?.metadata);
  return NextResponse.json({
    data: {
      grade: {
        score,
        maxScore,
        percent: gradebook ? numberOrNull(gradebook.percent) : numberOrNull(snapshot.percent),
        status: gradebook?.status === "graded" || gradebook?.status === "submitted"
          ? gradebook.status
          : snapshot.status === "graded" || snapshot.status === "submitted" ? snapshot.status : "ungraded",
        results,
        attemptNumber,
        recorded: true,
        locked: metadata.gradedByRole === "teacher",
      },
      answers,
    },
    error: null,
  });
}

async function nextAttemptNumber(studentId: string, lessonId: string) {
  const [row] = await d1Query<{ next_attempt: number | null }>(
    `SELECT COALESCE(MAX(attempt_number), 0) + 1 AS next_attempt
       FROM quiz_attempts
      WHERE student_id = ?
        AND lesson_id = ?`,
    [studentId, lessonId],
  );
  return Number(row?.next_attempt ?? 1);
}

async function hasFinalQuiz(lessonId: string) {
  const [row] = await d1Query<{ questions: number }>(
    "SELECT COUNT(*) AS questions FROM quiz_questions WHERE lesson_id = ? AND is_final_quiz = 1",
    [lessonId],
  );
  return Number(row?.questions ?? 0) > 0;
}

async function recordClaimedScore(input: {
  tenantId: string;
  studentId: string;
  lesson: LessonRow;
  claimedScore: number;
}) {
  if (!(await hasFinalQuiz(input.lesson.id))) {
    return NextResponse.json({ data: { status: "ungraded", recorded: false }, error: null });
  }

  const last = await loadRecordedQuizEvent({
    studentId: input.studentId,
    lessonId: input.lesson.id,
    eventType: CLAIMED_EVENT,
  });
  // The gradebook row still holds this same claim.
  if (last?.claimedScore === input.claimedScore) {
    return NextResponse.json({ data: { status: "submitted", recorded: true, replayed: true }, error: null });
  }

  const result = await recordGradeEvent({
    tenantId: input.tenantId,
    actorId: input.studentId,
    studentId: input.studentId,
    classId: input.lesson.grade_class_id,
    sourceType: "lesson_quiz",
    sourceId: input.lesson.id,
    eventType: CLAIMED_EVENT,
    writer: "student",
    teacherId: input.lesson.teacher_id,
    title: `${input.lesson.title} final quiz`,
    pointsEarned: 0,
    pointsPossible: 0,
    percent: null,
    status: "submitted",
    payload: { claimedScore: input.claimedScore },
    metadata: { claimedScore: input.claimedScore },
  });
  return NextResponse.json({
    data: { status: "submitted", recorded: result.applied, eventId: result.eventId },
    error: null,
  });
}

async function gradeAttempt(input: {
  tenantId: string;
  studentId: string;
  lesson: LessonRow;
  answers: QuizAnswers;
}) {
  const questions = await d1Query<StoredQuizQuestion & { explanation: string | null }>(
    `SELECT id, question_type, options, correct_answer, explanation, points
       FROM quiz_questions
      WHERE lesson_id = ?
        AND is_final_quiz = 1
      ORDER BY order_index, created_at`,
    [input.lesson.id],
  );
  const grade = gradeQuiz(questions, input.answers);
  const summary = { score: grade.score, maxScore: grade.maxScore, percent: grade.percent, results: grade.results };
  const reviewedResults = grade.results.map((result) => {
    const question = questions.find((item) => item.id === result.questionId);
    if (!question) return result;
    const feedback = questionFeedback(question);
    return { ...result, correctOptionIds: feedback.correctOptionIds, ...(feedback.explanation ? { explanation: feedback.explanation } : {}) };
  });
  if (questions.length === 0) {
    return NextResponse.json({ data: { ...summary, status: "ungraded", recorded: false }, error: null });
  }

  const status = grade.pendingReview > 0 ? "submitted" : "graded";
  const fingerprint = await quizAnswersFingerprint(questions, input.answers);
  const last = await loadRecordedQuizEvent({
    studentId: input.studentId,
    lessonId: input.lesson.id,
    eventType: GRADED_EVENT,
  });
  // The gradebook row still holds these answers graded against the same key: replay instead of recording again.
  if (
    last &&
    last.fingerprint === fingerprint &&
    last.score === grade.score &&
    last.maxScore === grade.maxScore &&
    last.pendingReview === grade.pendingReview
  ) {
    return NextResponse.json({
      data: { ...summary, results: reviewedResults, status, attemptNumber: last.attemptNumber, recorded: true, locked: false, replayed: true },
      error: null,
    });
  }

  const attemptNumber = await nextAttemptNumber(input.studentId, input.lesson.id);
  await d1Batch(
    grade.results.map((result) => ({
      sql: `INSERT INTO quiz_attempts (id, student_id, lesson_id, question_id, answer, is_correct, attempt_number, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      params: [
        crypto.randomUUID(),
        input.studentId,
        input.lesson.id,
        result.questionId,
        serializeQuizAnswer(input.answers.get(result.questionId)),
        result.correct === null ? null : result.correct ? 1 : 0,
        attemptNumber,
      ],
    })),
  );

  const recorded = await recordGradeEvent({
    tenantId: input.tenantId,
    actorId: input.studentId,
    studentId: input.studentId,
    classId: input.lesson.grade_class_id,
    sourceType: "lesson_quiz",
    sourceId: input.lesson.id,
    eventType: GRADED_EVENT,
    writer: "system",
    teacherId: input.lesson.teacher_id,
    title: `${input.lesson.title} final quiz`,
    pointsEarned: grade.score,
    pointsPossible: grade.maxScore,
    percent: status === "graded" ? grade.percent : null,
    status,
    payload: {
      attemptNumber,
      fingerprint,
      score: grade.score,
      maxScore: grade.maxScore,
      pendingReview: grade.pendingReview,
      results: reviewedResults,
    },
    metadata: { attemptNumber, pendingReview: grade.pendingReview },
  });

  return NextResponse.json({
    data: {
      ...summary,
      results: reviewedResults,
      status,
      attemptNumber,
      recorded: recorded.applied,
      locked: !recorded.applied,
      eventId: recorded.eventId,
    },
    error: null,
  });
}

/**
 * Grades a student's final lesson quiz on the server.
 *
 * The lesson must be published and open to the student: in a class they are enrolled in, assigned to them
 * or to one of their classes, or covered by an active entitlement. Any other lesson returns 404.
 *
 * Request:  POST { lessonId: string, answers: Record<questionId, string | string[] | boolean> }
 *   - multiple_choice: option id (or option text), or a list of ids for multi-answer questions
 *   - true_false: true/false, or the option id "true"/"false"
 *   - fill_blank: text, compared case- and whitespace-insensitively with the key
 *   - short_answer: text that matches the key (case- and whitespace-insensitively) is correct; any other
 *     answer waits for teacher review (correct: null)
 *   - long_answer / matching (or questions without a key): recorded for teacher review
 *   - blank answers are wrong
 * Response: { data: { score, maxScore, percent, results: [{ questionId, correct, pointsEarned, pointsPossible }],
 *             status: "graded" | "submitted" | "ungraded", attemptNumber, recorded, locked, replayed? } }
 *   - status "submitted" (percent stored as null) while any answer waits for teacher review
 *   - locked: a teacher already set this score, so the attempt was saved but the gradebook was left alone
 *   - resending the answers the gradebook row was last graded from replays that attempt instead of recording a new one
 *
 * Deprecated: POST { lessonId, score } (a client-computed percent) is accepted only as an unverified
 * claim: stored with status "submitted" and no percent. It only fills an empty row or replaces an earlier
 * claim, never a server-graded, pending or teacher score. A lesson without final quiz questions records nothing.
 * Response: { data: { status: "submitted" | "ungraded", recorded, replayed? } }
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);
  if (user.user_metadata.role !== "student") return jsonError("Student access required.", 403);

  const body = await readJsonObject(request);
  if (!body) return jsonError("Send a JSON object body.", 400);
  const lessonId = optionalId(body.lessonId);
  if (!lessonId) return jsonError("Lesson is required.", 400);

  const hasAnswers = body.answers !== undefined && body.answers !== null;
  if (!hasAnswers && body.score === undefined) return jsonError("Answers are required.", 400);

  let submission: { answers: QuizAnswers } | { claimedScore: number };
  try {
    submission = hasAnswers
      ? { answers: parseQuizAnswers(body.answers) }
      : { claimedScore: validateGradePercent(body.score) };
  } catch (error) {
    return jsonError(errorMessage(error, "Invalid quiz answers."), 400);
  }

  const context = await resolveTenantContext(user);
  const accessible = await loadAccessibleLesson({
    lessonId,
    tenantId: context.tenant.id,
    tenantMember: Boolean(context.membership),
    user,
  });
  if (!accessible) return jsonError("Lesson not found.", 404);
  const lesson = await loadStudentLesson(lessonId, context.tenant.id, user.id);
  if (!lesson) return jsonError("Lesson not found.", 404);

  const scope = { tenantId: context.tenant.id, studentId: user.id, lesson };
  return "answers" in submission
    ? gradeAttempt({ ...scope, answers: submission.answers })
    : recordClaimedScore({ ...scope, claimedScore: submission.claimedScore });
}
