import { d1Query } from "@/lib/db/d1";
import type { GradeSourceType, GradeStatus } from "@/lib/grades/validation";
import { linkTenantObject } from "@/lib/tenancy";

export type LearningEventInput = {
  tenantId: string;
  actorId?: string | null;
  studentId?: string | null;
  classId?: string | null;
  sourceType: string;
  sourceId?: string | null;
  eventType: string;
  payload?: Record<string, unknown>;
};

/**
 * Who is writing a gradebook score:
 * - teacher: always wins and marks the row as teacher-graded.
 * - system: server auto-grading; never overwrites a teacher-graded row.
 * - student: an unverified self-report; only fills an empty row or replaces an earlier, ungraded student claim.
 */
export type GradeWriter = "teacher" | "system" | "student";

export type GradeEventInput = Omit<LearningEventInput, "sourceType" | "sourceId"> & {
  sourceType: GradeSourceType;
  sourceId: string;
  writer: GradeWriter;
  teacherId: string;
  title: string;
  pointsEarned: number;
  pointsPossible: number;
  /** Overrides the percent derived from points (e.g. null while a score waits for review). */
  percent?: number | null;
  feedback?: string | null;
  status?: GradeStatus;
  /** undefined keeps the stored category; null clears it only for teacher writes. */
  categoryId?: string | null;
  metadata?: Record<string, unknown>;
};

const TEACHER_GRADED_ROW = `COALESCE(
         CASE WHEN json_valid(gradebook_scores.metadata)
              THEN json_extract(gradebook_scores.metadata, '$.gradedByRole') END, '') = 'teacher'`;

const STUDENT_CLAIMED_ROW = `COALESCE(
         CASE WHEN json_valid(gradebook_scores.metadata)
              THEN json_extract(gradebook_scores.metadata, '$.gradedByRole') END, 'student') = 'student'`;

const UPSERT_GUARDS: Record<GradeWriter, string> = {
  teacher: "",
  system: `WHERE NOT ${TEACHER_GRADED_ROW}`,
  student: `WHERE ${STUDENT_CLAIMED_ROW} AND gradebook_scores.status NOT IN ('graded', 'excused')`,
};

export async function appendLearningEvent(input: LearningEventInput) {
  const id = crypto.randomUUID();
  await d1Query(
    `INSERT INTO learning_events (
       id, tenant_id, actor_id, student_id, class_id, source_type, source_id,
       event_type, event_version, payload, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))`,
    [
      id,
      input.tenantId,
      input.actorId ?? null,
      input.studentId ?? null,
      input.classId ?? null,
      input.sourceType,
      input.sourceId ?? null,
      input.eventType,
      JSON.stringify(input.payload ?? {}),
    ],
  );
  return id;
}

/**
 * Appends the grade event and upserts the gradebook row for (student, sourceType, sourceId).
 * `applied` is false when the writer was not allowed to replace the stored row.
 * A write without a class keeps the class already stored on the row.
 */
export async function recordGradeEvent(input: GradeEventInput) {
  const pointsPossible = Math.max(0, Number(input.pointsPossible || 0));
  const pointsEarned = Math.max(0, Number(input.pointsEarned || 0));
  const percent =
    input.percent !== undefined
      ? input.percent
      : pointsPossible > 0
        ? Math.round((pointsEarned / pointsPossible) * 10000) / 100
        : null;
  const status = input.status ?? "graded";
  const gradedBy = input.writer === "teacher" ? (input.actorId ?? input.teacherId) : null;
  const eventId = await appendLearningEvent({
    tenantId: input.tenantId,
    actorId: input.actorId,
    studentId: input.studentId,
    classId: input.classId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    eventType: input.eventType,
    payload: {
      ...(input.payload ?? {}),
      title: input.title,
      categoryId: input.categoryId ?? null,
      pointsEarned,
      pointsPossible,
      percent,
      feedback: input.feedback ?? null,
      status,
      writer: input.writer,
    },
  });

  const written = await d1Query<{ id: string }>(
    `INSERT INTO gradebook_scores (
       id, class_id, student_id, teacher_id, category_id, source_type, source_id, title,
       points_earned, points_possible, percent, feedback, status, graded_at, metadata,
       created_at, updated_at
     ) VALUES (
       ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
       CASE WHEN ? IN ('graded', 'excused') THEN datetime('now') END,
       ?, datetime('now'), datetime('now')
     )
     ON CONFLICT(student_id, source_type, source_id) DO UPDATE SET
       class_id = COALESCE(excluded.class_id, gradebook_scores.class_id),
       category_id = CASE WHEN ? = 1 THEN excluded.category_id
                          ELSE COALESCE(excluded.category_id, gradebook_scores.category_id) END,
       points_earned = excluded.points_earned,
       points_possible = excluded.points_possible,
       percent = excluded.percent,
       feedback = excluded.feedback,
       status = excluded.status,
       graded_at = excluded.graded_at,
       metadata = excluded.metadata,
       updated_at = datetime('now')
     ${UPSERT_GUARDS[input.writer]}
     RETURNING id`,
    [
      crypto.randomUUID(),
      input.classId ?? null,
      input.studentId ?? null,
      input.teacherId,
      input.categoryId ?? null,
      input.sourceType,
      input.sourceId,
      input.title,
      pointsEarned,
      pointsPossible,
      percent,
      input.feedback ?? null,
      status,
      status,
      JSON.stringify({
        ...(input.metadata ?? {}),
        lastEventId: eventId,
        eventSourced: true,
        gradedBy,
        gradedByRole: input.writer,
      }),
      input.writer === "teacher" && input.categoryId !== undefined ? 1 : 0,
    ],
  );

  const applied = written.length > 0;
  let scoreId = written[0]?.id ?? null;
  if (!scoreId) {
    const [existing] = await d1Query<{ id: string }>(
      `SELECT id
         FROM gradebook_scores
        WHERE student_id = ?
          AND source_type = ?
          AND source_id = ?
        LIMIT 1`,
      [input.studentId ?? null, input.sourceType, input.sourceId],
    );
    scoreId = existing?.id ?? null;
  }
  if (applied && scoreId) {
    await linkTenantObject({
      tenantId: input.tenantId,
      table: "gradebook_scores",
      objectId: scoreId,
    });
  }
  return { eventId, scoreId, percent, applied };
}
