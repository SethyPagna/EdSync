import type { SessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import { DEFAULT_TENANT_ID } from "@/lib/tenancy";
import { tenantObjectJoin, tenantObjectPredicate } from "@/lib/tenancy/object-scope";

export type AccessibleLesson = {
  id: string;
  title: string;
  teacher_id: string;
  class_id: string | null;
  status: string;
};

type LessonPredicate = { sql: string; params: unknown[] };

const ALIAS = /^[a-z][a-z0-9_]*$/i;

export function lessonReadPredicate(alias: string, user: SessionUser): LessonPredicate {
  if (!ALIAS.test(alias)) throw new Error("Invalid lesson alias.");
  if (user.user_metadata.role === "admin") return { sql: "1 = 1", params: [] };
  if (user.user_metadata.role === "teacher") {
    return { sql: `${alias}.teacher_id = ?`, params: [user.id] };
  }
  return {
    sql: `${alias}.status = 'published' AND (
      EXISTS (SELECT 1 FROM class_enrollments ec
               WHERE ec.class_id = ${alias}.class_id AND ec.student_id = ? AND ec.is_active = 1)
      OR EXISTS (SELECT 1 FROM lesson_assignments la
                  WHERE la.lesson_id = ${alias}.id AND la.is_active = 1
                    AND (la.student_id = ? OR EXISTS (
                      SELECT 1 FROM class_enrollments ec
                       WHERE ec.class_id = la.class_id AND ec.student_id = ? AND ec.is_active = 1)))
      OR EXISTS (SELECT 1 FROM entitlements ee
                   JOIN billing_products bp ON bp.id = ee.product_id AND bp.tenant_id = ee.tenant_id
                   JOIN tenants et ON et.id = ee.tenant_id
                  WHERE ee.user_id = ? AND bp.course_id = ${alias}.id
                    AND ee.status = 'active' AND bp.status = 'active' AND et.status = 'active'
                    AND (ee.starts_at IS NULL OR datetime(ee.starts_at) <= datetime('now'))
                    AND (ee.ends_at IS NULL OR datetime(ee.ends_at) > datetime('now'))))`,
    params: [user.id, user.id, user.id, user.id],
  };
}

export async function loadAccessibleLesson(input: {
  lessonId: string;
  tenantId: string;
  user: SessionUser;
  tenantMember?: boolean;
}): Promise<AccessibleLesson | null> {
  if (input.user.user_metadata.role === "admin" && input.tenantId !== DEFAULT_TENANT_ID && !input.tenantMember) {
    return null;
  }
  const access = lessonReadPredicate("l", input.user);
  const [lesson] = await d1Query<AccessibleLesson>(
    `SELECT l.id, l.title, l.teacher_id, l.class_id, l.status
       FROM lessons l
       ${tenantObjectJoin({ objectTable: "lessons", objectAlias: "l", linkAlias: "lesson_link" })}
       LEFT JOIN classes c ON c.id = l.class_id
       ${tenantObjectJoin({ objectTable: "classes", objectAlias: "c", linkAlias: "class_link" })}
      WHERE l.id = ?
        AND (lesson_link.id IS NULL OR lesson_link.tenant_id = ?)
        AND (class_link.id IS NULL OR class_link.tenant_id = ?)
        AND (${tenantObjectPredicate({ linkAlias: "lesson_link" })}
          OR (l.class_id IS NOT NULL AND ${tenantObjectPredicate({ linkAlias: "class_link" })}))
        AND (${access.sql})
      LIMIT 1`,
    [
      "lessons",
      "classes",
      input.lessonId,
      input.tenantId,
      input.tenantId,
      input.tenantId,
      input.tenantId,
      DEFAULT_TENANT_ID,
      input.tenantId,
      input.tenantId,
      DEFAULT_TENANT_ID,
      ...access.params,
    ],
  );
  return lesson ?? null;
}
