import { d1Query } from "@/lib/db/d1";
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

export async function recordGradeEvent(input: LearningEventInput & {
  teacherId: string;
  title: string;
  pointsEarned: number;
  pointsPossible: number;
  feedback?: string | null;
  status?: "draft" | "submitted" | "graded" | "excused" | "missing";
}) {
  const pointsPossible = Math.max(0, Number(input.pointsPossible || 0));
  const pointsEarned = Math.max(0, Number(input.pointsEarned || 0));
  const percent = pointsPossible > 0 ? Math.round((pointsEarned / pointsPossible) * 10000) / 100 : null;
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
      pointsEarned,
      pointsPossible,
      percent,
      feedback: input.feedback ?? null,
      status: input.status ?? "graded",
    },
  });

  await d1Query(
    `INSERT INTO gradebook_scores (
       id, class_id, student_id, teacher_id, source_type, source_id, title,
       points_earned, points_possible, percent, feedback, status, graded_at, metadata,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, datetime('now'), datetime('now'))
     ON CONFLICT(student_id, source_type, source_id) DO UPDATE SET
       points_earned = excluded.points_earned,
       points_possible = excluded.points_possible,
       percent = excluded.percent,
       feedback = excluded.feedback,
       status = excluded.status,
       graded_at = excluded.graded_at,
       metadata = excluded.metadata,
       updated_at = datetime('now')`,
    [
      crypto.randomUUID(),
      input.classId ?? null,
      input.studentId ?? null,
      input.teacherId,
      input.sourceType,
      input.sourceId ?? null,
      input.title,
      pointsEarned,
      pointsPossible,
      percent,
      input.feedback ?? null,
      input.status ?? "graded",
      JSON.stringify({ lastEventId: eventId, eventSourced: true }),
    ],
  );
  const [score] = await d1Query<{ id: string }>(
    `SELECT id
       FROM gradebook_scores
      WHERE student_id = ?
        AND source_type = ?
        AND source_id = ?
      ORDER BY updated_at DESC
      LIMIT 1`,
    [input.studentId ?? null, input.sourceType, input.sourceId ?? null],
  );
  if (score) {
    await linkTenantObject({
      tenantId: input.tenantId,
      table: "gradebook_scores",
      objectId: score.id,
    });
  }
  return { eventId, scoreId: score?.id ?? null, percent };
}
