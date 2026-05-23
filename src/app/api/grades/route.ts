import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import type { SessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import {
  GRADE_CATEGORY_NAME_MAX_LENGTH,
  normalizeManualGradeInput,
  validateGradeCategoryWeight,
  validateGradeText,
} from "@/lib/grades/validation";
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

function weightedAverage(
  scores: GradebookScoreRow[],
  categories: Array<{ id: string; weight: number }>,
) {
  const byCategory = new Map(categories.map((category) => [category.id, Number(category.weight || 0)]));
  const grouped = new Map<string, number[]>();

  for (const score of scores) {
    if (score.status !== "graded" || score.percent === null || score.percent === undefined) continue;
    const key = score.category_id || "uncategorized";
    grouped.set(key, [...(grouped.get(key) ?? []), Number(score.percent)]);
  }

  let weightedTotal = 0;
  let weightTotal = 0;
  for (const [categoryId, values] of Array.from(grouped.entries())) {
    const average = values.reduce((sum: number, value: number) => sum + value, 0) / values.length;
    const weight = byCategory.get(categoryId) ?? 1;
    weightedTotal += average * weight;
    weightTotal += weight;
  }

  return weightTotal > 0 ? Math.round((weightedTotal / weightTotal) * 100) / 100 : null;
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
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
    return NextResponse.json({
      data: { scores, overall: weightedAverage(scores, []) },
      error: null,
    });
  }

  if (user.user_metadata.role !== "teacher" && user.user_metadata.role !== "admin") {
    return NextResponse.json({ data: null, error: "Teacher access required." }, { status: 403 });
  }
  if (classId && !(await canManageClass({ user, context, classId }))) {
    return NextResponse.json({ data: null, error: "Class not found." }, { status: 404 });
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

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  if (user.user_metadata.role !== "teacher" && user.user_metadata.role !== "admin") {
    return NextResponse.json({ data: null, error: "Teacher access required." }, { status: 403 });
  }
  const context = await resolveTenantContext(user);

  const body = (await request.json()) as {
    kind?: "category" | "score";
    classId?: string;
    name?: string;
    weight?: number;
    studentId?: string;
    categoryId?: string | null;
    sourceType?: string;
    sourceId?: string | null;
    title?: string;
    pointsEarned?: number;
    pointsPossible?: number;
    feedback?: string | null;
    status?: "draft" | "graded";
  };

  if (body.kind === "category") {
    if (!body.classId) {
      return NextResponse.json({ data: null, error: "Class is required." }, { status: 400 });
    }
    if (!(await canManageClass({ user, context, classId: body.classId }))) {
      return NextResponse.json({ data: null, error: "Class not found." }, { status: 404 });
    }
    let categoryName: string;
    let categoryWeight: number;
    try {
      categoryName = validateGradeText(body.name, "Category name", GRADE_CATEGORY_NAME_MAX_LENGTH);
      categoryWeight = validateGradeCategoryWeight(body.weight);
    } catch (error) {
      return NextResponse.json(
        { data: null, error: error instanceof Error ? error.message : "Invalid grade category." },
        { status: 400 },
      );
    }
    const id = crypto.randomUUID();
    await d1Query(
      `INSERT INTO gradebook_categories (id, class_id, teacher_id, name, weight, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [id, body.classId, user.id, categoryName, categoryWeight],
    );
    await linkTenantObject({
      tenantId: context.tenant.id,
      portalId: context.portal?.id,
      table: CATEGORY_TABLE,
      objectId: id,
    });
    return NextResponse.json({ data: { id }, error: null });
  }

  if (!body.studentId) {
    return NextResponse.json({ data: null, error: "Student is required." }, { status: 400 });
  }

  let grade;
  try {
    grade = normalizeManualGradeInput(body);
  } catch (error) {
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Invalid grade score." },
      { status: 400 },
    );
  }
  const category = await resolveGradeCategory({ user, context, categoryId: body.categoryId });
  if (body.categoryId && !category) {
    return NextResponse.json({ data: null, error: "Category not found." }, { status: 404 });
  }
  if (category && body.classId && category.class_id !== body.classId) {
    return NextResponse.json({ data: null, error: "Category does not belong to this class." }, { status: 400 });
  }
  const classId = body.classId ?? category?.class_id ?? null;
  if (!(await canGradeStudent({ user, context, studentId: body.studentId, classId }))) {
    return NextResponse.json({ data: null, error: "Student not found." }, { status: 404 });
  }
  const id = crypto.randomUUID();
  const result = await recordGradeEvent({
    tenantId: context.tenant.id,
    actorId: user.id,
    studentId: body.studentId,
    classId,
    sourceType: grade.sourceType,
    sourceId: body.sourceId ?? id,
    eventType: "grade.manual.recorded",
    teacherId: user.id,
    title: grade.title,
    pointsEarned: grade.pointsEarned,
    pointsPossible: grade.pointsPossible,
    feedback: grade.feedback,
    status: body.status === "draft" ? "draft" : "graded",
    payload: { categoryId: body.categoryId ?? null },
  });

  return NextResponse.json({ data: { id, eventId: result.eventId }, error: null });
}
