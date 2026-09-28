import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import type { SessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import { sqlInPlaceholders } from "@/lib/db/sql";
import { errorMessage, jsonError, optionalId, readJsonObject } from "@/lib/grades/http";
import {
  GRADE_CATEGORY_NAME_MAX_LENGTH,
  normalizeManualGradeInput,
  validateGradeCategoryWeight,
  validateGradeText,
  type GradeSourceType,
} from "@/lib/grades/validation";
import { referencedCategoryIds, weightedAverage } from "@/lib/grades/weighting";
import { recordGradeEvent } from "@/lib/learning-events";
import { linkTenantObject, resolveTenantContext, type TenantContext } from "@/lib/tenancy";
import {
  tenantObjectJoin,
  tenantObjectParams,
  tenantObjectPredicate,
} from "@/lib/tenancy/object-scope";

const CLASS_TABLE = "classes";
const CATEGORY_TABLE = "gradebook_categories";
const SCORE_TABLE = "gradebook_scores";

type GradebookScoreRow = {
  class_id: string | null;
  category_id: string | null;
  percent: number | null;
  status: string;
};

type TeacherScoreRow = GradebookScoreRow & {
  student_id: string;
  full_name: string | null;
  email: string;
};

function objectParams(objectTable: string, tenantId: string) {
  return tenantObjectParams({ objectTable, tenantId });
}

function predicateParams(objectTable: string, tenantId: string) {
  return objectParams(objectTable, tenantId).slice(1);
}

async function canManageClass(input: {
  user: SessionUser;
  context: TenantContext;
  classId: string;
}) {
  const isAdmin = input.user.user_metadata.role === "admin";
  const [row] = await d1Query<{ id: string }>(
    `SELECT c.id
       FROM classes c
       ${tenantObjectJoin({ objectTable: CLASS_TABLE, objectAlias: "c", linkAlias: "class_link" })}
      WHERE ${tenantObjectPredicate({ linkAlias: "class_link" })}
        AND c.id = ?
        AND c.is_active = 1
        AND (? = 1 OR c.teacher_id = ?)
      LIMIT 1`,
    [
      CLASS_TABLE,
      ...predicateParams(CLASS_TABLE, input.context.tenant.id),
      input.classId,
      isAdmin ? 1 : 0,
      input.user.id,
    ],
  );
  return Boolean(row);
}

async function canGradeStudent(input: {
  user: SessionUser;
  context: TenantContext;
  studentId: string;
  classId?: string | null;
}) {
  const isAdmin = input.user.user_metadata.role === "admin";
  if (input.classId) {
    const [row] = await d1Query<{ id: string }>(
      `SELECT c.id
         FROM classes c
         ${tenantObjectJoin({ objectTable: CLASS_TABLE, objectAlias: "c", linkAlias: "class_link" })}
         JOIN class_enrollments ce
           ON ce.class_id = c.id
          AND ce.student_id = ?
          AND ce.is_active = 1
        WHERE ${tenantObjectPredicate({ linkAlias: "class_link" })}
          AND c.id = ?
          AND c.is_active = 1
          AND (? = 1 OR c.teacher_id = ?)
        LIMIT 1`,
      [
        CLASS_TABLE,
        input.studentId,
        ...predicateParams(CLASS_TABLE, input.context.tenant.id),
        input.classId,
        isAdmin ? 1 : 0,
        input.user.id,
      ],
    );
    return Boolean(row);
  }

  const rows = isAdmin
    ? await d1Query<{ id: string }>(
        `SELECT p.id
           FROM profiles p
           JOIN tenant_memberships tm
             ON tm.user_id = p.id
            AND tm.tenant_id = ?
            AND tm.status = 'active'
          WHERE p.id = ?
            AND p.role = 'student'
          LIMIT 1`,
        [input.context.tenant.id, input.studentId],
      )
    : await d1Query<{ id: string }>(
        `SELECT p.id
           FROM profiles p
           JOIN class_enrollments ce
             ON ce.student_id = p.id
            AND ce.is_active = 1
           JOIN classes c ON c.id = ce.class_id
           ${tenantObjectJoin({ objectTable: CLASS_TABLE, objectAlias: "c", linkAlias: "class_link" })}
          WHERE ${tenantObjectPredicate({ linkAlias: "class_link" })}
            AND p.id = ?
            AND p.role = 'student'
            AND c.is_active = 1
            AND c.teacher_id = ?
          LIMIT 1`,
        [
          CLASS_TABLE,
          ...predicateParams(CLASS_TABLE, input.context.tenant.id),
          input.studentId,
          input.user.id,
        ],
      );
  return rows.length > 0;
}

async function resolveGradeCategory(input: {
  user: SessionUser;
  context: TenantContext;
  categoryId?: string | null;
}) {
  if (!input.categoryId) return null;
  const isAdmin = input.user.user_metadata.role === "admin";
  const [category] = await d1Query<{ id: string; class_id: string }>(
    `SELECT gc.id, gc.class_id
       FROM gradebook_categories gc
       ${tenantObjectJoin({ objectTable: CATEGORY_TABLE, objectAlias: "gc", linkAlias: "category_link" })}
       JOIN classes c ON c.id = gc.class_id
       ${tenantObjectJoin({ objectTable: CLASS_TABLE, objectAlias: "c", linkAlias: "class_link" })}
      WHERE (${tenantObjectPredicate({ linkAlias: "category_link" })}
          OR ${tenantObjectPredicate({ linkAlias: "class_link" })})
        AND gc.id = ?
        AND (? = 1 OR gc.teacher_id = ?)
      LIMIT 1`,
    [
      CATEGORY_TABLE,
      CLASS_TABLE,
      ...predicateParams(CATEGORY_TABLE, input.context.tenant.id),
      ...predicateParams(CLASS_TABLE, input.context.tenant.id),
      input.categoryId,
      isAdmin ? 1 : 0,
      input.user.id,
    ],
  );
  return category ?? null;
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);
  const context = await resolveTenantContext(user);

  const params = new URL(request.url).searchParams;
  const classId = params.get("classId");

  if (user.user_metadata.role === "student") {
    const scores = await d1Query<GradebookScoreRow>(
      `SELECT gs.*, gc.name AS category_name
         FROM gradebook_scores gs
         ${tenantObjectJoin({ objectTable: SCORE_TABLE, objectAlias: "gs", linkAlias: "score_link" })}
         LEFT JOIN classes c ON c.id = gs.class_id
         ${tenantObjectJoin({ objectTable: CLASS_TABLE, objectAlias: "c", linkAlias: "class_link" })}
         LEFT JOIN gradebook_categories gc ON gc.id = gs.category_id
        WHERE gs.student_id = ?
          AND (${tenantObjectPredicate({ linkAlias: "score_link" })}
            OR (gs.class_id IS NOT NULL AND ${tenantObjectPredicate({ linkAlias: "class_link" })}))
          AND gs.status != 'draft'
          ${classId ? "AND gs.class_id = ?" : ""}
        ORDER BY gs.updated_at DESC`,
      classId
        ? [
            SCORE_TABLE,
            CLASS_TABLE,
            user.id,
            ...predicateParams(SCORE_TABLE, context.tenant.id),
            ...predicateParams(CLASS_TABLE, context.tenant.id),
            classId,
          ]
        : [
            SCORE_TABLE,
            CLASS_TABLE,
            user.id,
            ...predicateParams(SCORE_TABLE, context.tenant.id),
            ...predicateParams(CLASS_TABLE, context.tenant.id),
          ],
    );
    const categoryIds = referencedCategoryIds(scores);
    const categoryChunks = Array.from({ length: Math.ceil(categoryIds.length / 100) }, (_, index) =>
      categoryIds.slice(index * 100, (index + 1) * 100));
    const categories = (await Promise.all(categoryChunks.map((ids) =>
      d1Query<{ id: string; class_id: string; name: string; weight: number }>(
        `SELECT id, class_id, name, weight
           FROM gradebook_categories
          WHERE id IN (${sqlInPlaceholders(ids)})`,
        ids,
      )))).flat();
    // Category weights only mean something inside their own class: weight each class like the teacher's
    // class view, then give every class (and the class-less scores) an equal share of the overall.
    const scoresByClass = new Map<string | null, GradebookScoreRow[]>();
    for (const score of scores) {
      const key = score.class_id || null;
      scoresByClass.set(key, [...(scoresByClass.get(key) ?? []), score]);
    }
    const averageByClass = Array.from(scoresByClass, ([scoreClassId, classScores]) => ({
      classId: scoreClassId,
      average: weightedAverage(classScores, categories),
    }));
    const overallByClass = Object.fromEntries(
      averageByClass.flatMap(({ classId: scoreClassId, average }) => (scoreClassId ? [[scoreClassId, average]] : [])),
    );
    const classAverages = averageByClass.flatMap(({ average }) => (average === null ? [] : [average]));
    const overall = classAverages.length
      ? Math.round((classAverages.reduce((sum, value) => sum + value, 0) / classAverages.length) * 100) / 100
      : null;
    return NextResponse.json({
      data: { scores, categories, overall, overallByClass },
      error: null,
    });
  }

  if (user.user_metadata.role !== "teacher" && user.user_metadata.role !== "admin") {
    return jsonError("Teacher access required.", 403);
  }
  if (classId && !(await canManageClass({ user, context, classId }))) {
    return jsonError("Class not found.", 404);
  }

  const categoryParams = user.user_metadata.role === "admin" ? [] : [user.id];
  const categories = await d1Query<{ id: string; class_id: string; name: string; weight: number }>(
    `SELECT gc.*
       FROM gradebook_categories gc
       ${tenantObjectJoin({ objectTable: CATEGORY_TABLE, objectAlias: "gc", linkAlias: "category_link" })}
       JOIN classes c ON c.id = gc.class_id
       ${tenantObjectJoin({ objectTable: CLASS_TABLE, objectAlias: "c", linkAlias: "class_link" })}
      WHERE (${tenantObjectPredicate({ linkAlias: "category_link" })}
          OR ${tenantObjectPredicate({ linkAlias: "class_link" })})
        AND ${user.user_metadata.role === "admin" ? "1=1" : "gc.teacher_id = ?"}
        ${classId ? "AND gc.class_id = ?" : ""}
      ORDER BY gc.class_id, gc.name`,
    classId
      ? [
          CATEGORY_TABLE,
          CLASS_TABLE,
          ...predicateParams(CATEGORY_TABLE, context.tenant.id),
          ...predicateParams(CLASS_TABLE, context.tenant.id),
          ...categoryParams,
          classId,
        ]
      : [
          CATEGORY_TABLE,
          CLASS_TABLE,
          ...predicateParams(CATEGORY_TABLE, context.tenant.id),
          ...predicateParams(CLASS_TABLE, context.tenant.id),
          ...categoryParams,
        ],
  );

  const scoreParams = user.user_metadata.role === "admin" ? [] : [user.id];
  const scores = await d1Query<TeacherScoreRow>(
    `SELECT gs.*, p.full_name, p.email, gc.name AS category_name
       FROM gradebook_scores gs
       ${tenantObjectJoin({ objectTable: SCORE_TABLE, objectAlias: "gs", linkAlias: "score_link" })}
       LEFT JOIN classes c ON c.id = gs.class_id
       ${tenantObjectJoin({ objectTable: CLASS_TABLE, objectAlias: "c", linkAlias: "class_link" })}
       JOIN profiles p ON p.id = gs.student_id
       LEFT JOIN gradebook_categories gc ON gc.id = gs.category_id
      WHERE (${tenantObjectPredicate({ linkAlias: "score_link" })}
          OR (gs.class_id IS NOT NULL AND ${tenantObjectPredicate({ linkAlias: "class_link" })}))
        AND ${user.user_metadata.role === "admin" ? "1=1" : "gs.teacher_id = ?"}
        ${classId ? "AND gs.class_id = ?" : ""}
      ORDER BY p.full_name, gs.updated_at DESC`,
    classId
      ? [
          SCORE_TABLE,
          CLASS_TABLE,
          ...predicateParams(SCORE_TABLE, context.tenant.id),
          ...predicateParams(CLASS_TABLE, context.tenant.id),
          ...scoreParams,
          classId,
        ]
      : [
          SCORE_TABLE,
          CLASS_TABLE,
          ...predicateParams(SCORE_TABLE, context.tenant.id),
          ...predicateParams(CLASS_TABLE, context.tenant.id),
          ...scoreParams,
        ],
  );

  const byStudent = new Map<
    string,
    { studentId: string; name: string; email: string; overall: number | null; scores: TeacherScoreRow[] }
  >();
  for (const score of scores) {
    const existing = byStudent.get(score.student_id) ?? {
      studentId: score.student_id,
      name: score.full_name || score.email,
      email: score.email,
      overall: null,
      scores: [],
    };
    existing.scores.push(score);
    byStudent.set(score.student_id, existing);
  }

  const rows = Array.from(byStudent.values()).map((row) => ({
    ...row,
    overall: weightedAverage(row.scores, categories),
  }));

  return NextResponse.json({ data: { categories, scores, rows }, error: null });
}

async function classTeacherId(classId: string | null) {
  if (!classId) return null;
  const [row] = await d1Query<{ teacher_id: string }>("SELECT teacher_id FROM classes WHERE id = ? LIMIT 1", [classId]);
  return row?.teacher_id ?? null;
}

/**
 * Resolves the gradebook source a teacher is grading. Manual scores get a server-generated id; any
 * client-supplied sourceId must already belong to the class being graded, so one class can never
 * overwrite another class's score.
 */
async function resolveManualGradeSource(input: {
  user: SessionUser;
  studentId: string;
  classId: string | null;
  sourceType: GradeSourceType;
  sourceId: string | null;
}): Promise<{ sourceId: string; teacherId: string } | null> {
  const { user, classId, sourceId } = input;
  const isAdmin = user.user_metadata.role === "admin" ? 1 : 0;

  if (input.sourceType === "manual") {
    if (!sourceId) {
      return { sourceId: crypto.randomUUID(), teacherId: (await classTeacherId(classId)) ?? user.id };
    }
    const [row] = await d1Query<{ teacher_id: string }>(
      `SELECT teacher_id
         FROM gradebook_scores
        WHERE student_id = ?
          AND source_type = 'manual'
          AND source_id = ?
          AND class_id IS ?
          AND (? = 1 OR teacher_id = ?)
        LIMIT 1`,
      [input.studentId, sourceId, classId, isAdmin, user.id],
    );
    return row ? { sourceId, teacherId: row.teacher_id } : null;
  }

  if (!sourceId) return null;
  const [row] =
    input.sourceType === "lesson_quiz"
      ? await d1Query<{ teacher_id: string }>(
          `SELECT l.teacher_id
             FROM lessons l
            WHERE l.id = ?
              AND ((? IS NOT NULL AND (l.class_id = ? OR EXISTS (
                     SELECT 1
                       FROM lesson_assignments la
                      WHERE la.lesson_id = l.id
                        AND la.class_id = ?
                        AND la.is_active = 1)))
                OR (? IS NULL AND l.class_id IS NULL AND (? = 1 OR l.teacher_id = ?)))
            LIMIT 1`,
          [sourceId, classId, classId, classId, classId, isAdmin, user.id],
        )
      : await d1Query<{ teacher_id: string }>(
          `SELECT wi.teacher_id
             FROM learning_work_items wi
            WHERE wi.id = ?
              AND wi.work_type = ?
              AND ((? IS NOT NULL AND wi.class_id = ?)
                OR (? IS NULL AND wi.class_id IS NULL AND (? = 1 OR wi.teacher_id = ?)))
            LIMIT 1`,
          [sourceId, input.sourceType, classId, classId, classId, isAdmin, user.id],
        );
  return row ? { sourceId, teacherId: row.teacher_id } : null;
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);
  if (user.user_metadata.role !== "teacher" && user.user_metadata.role !== "admin") {
    return jsonError("Teacher access required.", 403);
  }

  const body = await readJsonObject(request);
  if (!body) return jsonError("Send a JSON object body.", 400);
  const context = await resolveTenantContext(user);
  const bodyClassId = optionalId(body.classId);

  if (body.kind === "category") {
    if (!bodyClassId) return jsonError("Class is required.", 400);
    if (!(await canManageClass({ user, context, classId: bodyClassId }))) {
      return jsonError("Class not found.", 404);
    }
    let categoryName: string;
    let categoryWeight: number;
    try {
      categoryName = validateGradeText(body.name, "Category name", GRADE_CATEGORY_NAME_MAX_LENGTH);
      categoryWeight = validateGradeCategoryWeight(body.weight);
    } catch (error) {
      return jsonError(errorMessage(error, "Invalid grade category."), 400);
    }
    const id = crypto.randomUUID();
    await d1Query(
      `INSERT INTO gradebook_categories (id, class_id, teacher_id, name, weight, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [id, bodyClassId, user.id, categoryName, categoryWeight],
    );
    await linkTenantObject({
      tenantId: context.tenant.id,
      portalId: context.portal?.id,
      table: CATEGORY_TABLE,
      objectId: id,
    });
    return NextResponse.json({ data: { id }, error: null });
  }

  const studentId = optionalId(body.studentId);
  if (!studentId) return jsonError("Student is required.", 400);

  let grade;
  try {
    grade = normalizeManualGradeInput(body);
  } catch (error) {
    return jsonError(errorMessage(error, "Invalid grade score."), 400);
  }
  const requestedSourceId = optionalId(body.sourceId);
  if (grade.sourceType !== "manual" && !requestedSourceId) {
    return jsonError("Choose the graded item for this score.", 400);
  }

  const categoryId = optionalId(body.categoryId);
  const category = await resolveGradeCategory({ user, context, categoryId });
  if (categoryId && !category) return jsonError("Category not found.", 404);
  if (category && bodyClassId && category.class_id !== bodyClassId) {
    return jsonError("Category does not belong to this class.", 400);
  }
  const classId = bodyClassId ?? category?.class_id ?? null;
  if (!(await canGradeStudent({ user, context, studentId, classId }))) {
    return jsonError("Student not found.", 404);
  }

  const source = await resolveManualGradeSource({
    user,
    studentId,
    classId,
    sourceType: grade.sourceType,
    sourceId: requestedSourceId,
  });
  if (!source) return jsonError("Graded item not found in this class.", 404);

  const result = await recordGradeEvent({
    tenantId: context.tenant.id,
    actorId: user.id,
    studentId,
    classId,
    sourceType: grade.sourceType,
    sourceId: source.sourceId,
    eventType: "grade.manual.recorded",
    writer: "teacher",
    teacherId: source.teacherId,
    title: grade.title,
    pointsEarned: grade.pointsEarned,
    pointsPossible: grade.pointsPossible,
    feedback: grade.feedback,
    status: body.status === "draft" ? "draft" : "graded",
    categoryId: body.categoryId === undefined ? undefined : (category?.id ?? null),
  });

  return NextResponse.json({
    data: {
      id: source.sourceId,
      sourceId: source.sourceId,
      sourceType: grade.sourceType,
      scoreId: result.scoreId,
      eventId: result.eventId,
    },
    error: null,
  });
}
