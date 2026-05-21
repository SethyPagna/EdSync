import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import { normalizePracticeReviewCardRow } from "@/lib/practice/review-cards";
import { summarizeTeacherPracticeReviews } from "@/lib/practice/teacher-review-signals";
import { resolveTenantContext } from "@/lib/tenancy";
import {
  tenantObjectJoin,
  tenantObjectParams,
  tenantObjectPredicate,
} from "@/lib/tenancy/object-scope";

const CLASS_TABLE = "classes";

function classPredicateParams(tenantId: string) {
  return tenantObjectParams({ objectTable: CLASS_TABLE, tenantId }).slice(1);
}

export async function GET() {
  const user = await getSessionUser();
  if (!user || (user.user_metadata.role !== "teacher" && user.user_metadata.role !== "admin")) {
    return NextResponse.json({ data: null, error: "Teacher access required." }, { status: 403 });
  }

  const context = await resolveTenantContext(user);
  const isAdmin = user.user_metadata.role === "admin";
  const rows = await d1Query(
    `SELECT prc.*
       FROM practice_review_cards prc
      WHERE prc.tenant_id = ?
        AND prc.mastery != 'mastered'
        AND EXISTS (
          SELECT 1
            FROM class_enrollments ce
            JOIN classes c ON c.id = ce.class_id
            ${tenantObjectJoin({ objectTable: CLASS_TABLE, objectAlias: "c", linkAlias: "class_link" })}
           WHERE ce.student_id = prc.user_id
             AND ce.is_active = 1
             AND c.is_active = 1
             AND ${tenantObjectPredicate({ linkAlias: "class_link" })}
             AND (? = 1 OR c.teacher_id = ?)
        )
      ORDER BY prc.created_at DESC
      LIMIT 100`,
    [context.tenant.id, CLASS_TABLE, ...classPredicateParams(context.tenant.id), isAdmin ? 1 : 0, user.id],
  );

  return NextResponse.json({
    data: summarizeTeacherPracticeReviews(rows.map((row) => normalizePracticeReviewCardRow(row))),
    error: null,
  });
}
