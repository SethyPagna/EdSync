import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import { validateGradePercent } from "@/lib/grades/validation";
import { recordGradeEvent } from "@/lib/learning-events";
import { resolveTenantContext } from "@/lib/tenancy";
import {
  tenantObjectJoin,
  tenantObjectParams,
  tenantObjectPredicate,
} from "@/lib/tenancy/object-scope";
import { validateEarnedWorkPoints, validateWorkPoints } from "@/lib/work/validation";

const LESSON_TABLE = "lessons";
const CLASS_TABLE = "classes";

function predicateParams(objectTable: string, tenantId: string) {
  return tenantObjectParams({ objectTable, tenantId }).slice(1);
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  if (user.user_metadata.role !== "student") {
    return NextResponse.json({ data: null, error: "Student access required." }, { status: 403 });
  }

  const body = (await request.json()) as {
    lessonId?: string;
    score?: number;
    pointsEarned?: number;
    pointsPossible?: number;
  };
  if (!body.lessonId || body.score === undefined) {
    return NextResponse.json({ data: null, error: "Lesson and score are required." }, { status: 400 });
  }

  const context = await resolveTenantContext(user);
  const [lesson] = await d1Query<{ id: string; title: string; teacher_id: string; class_id: string | null }>(
    `SELECT l.id, l.title, l.teacher_id, l.class_id
       FROM lessons l
       ${tenantObjectJoin({ objectTable: LESSON_TABLE, objectAlias: "l", linkAlias: "lesson_link" })}
       LEFT JOIN classes c ON c.id = l.class_id
       ${tenantObjectJoin({ objectTable: CLASS_TABLE, objectAlias: "c", linkAlias: "class_link" })}
      WHERE l.id = ?
        AND (${tenantObjectPredicate({ linkAlias: "lesson_link" })}
          OR (l.class_id IS NOT NULL AND ${tenantObjectPredicate({ linkAlias: "class_link" })}))
      LIMIT 1`,
    [
      LESSON_TABLE,
      CLASS_TABLE,
      body.lessonId,
      ...predicateParams(LESSON_TABLE, context.tenant.id),
      ...predicateParams(CLASS_TABLE, context.tenant.id),
    ],
  );
  if (!lesson) return NextResponse.json({ data: null, error: "Lesson not found." }, { status: 404 });
  if (lesson.class_id) {
    const [enrollment] = await d1Query<{ id: string }>(
      `SELECT id
         FROM class_enrollments
        WHERE class_id = ?
          AND student_id = ?
          AND is_active = 1
        LIMIT 1`,
      [lesson.class_id, user.id],
    );
    if (!enrollment) return NextResponse.json({ data: null, error: "Lesson not found." }, { status: 404 });
  }

  let score: number;
  let pointsPossible: number;
  let pointsEarned: number;
  try {
    score = validateGradePercent(body.score);
    pointsPossible = validateWorkPoints(body.pointsPossible, 100);
    pointsEarned =
      body.pointsEarned !== undefined
        ? validateEarnedWorkPoints(body.pointsEarned, pointsPossible)
        : Math.round((score / 100) * pointsPossible);
  } catch (error) {
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Invalid quiz score." },
      { status: 400 },
    );
  }

  const result = await recordGradeEvent({
    tenantId: context.tenant.id,
    actorId: user.id,
    studentId: user.id,
    classId: lesson.class_id,
    sourceType: "lesson_quiz",
    sourceId: lesson.id,
    eventType: "grade.lesson_quiz.recorded",
    teacherId: lesson.teacher_id,
    title: `${lesson.title} final quiz`,
    pointsEarned,
    pointsPossible,
    payload: { score },
  });

  return NextResponse.json({ data: { recorded: true, eventId: result.eventId }, error: null });
}
