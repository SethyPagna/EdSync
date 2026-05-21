import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import {
  tenantObjectJoin,
  tenantObjectParams,
  tenantObjectPredicate,
} from "@/lib/tenancy/object-scope";
import { resolveTenantContext } from "@/lib/tenancy";

type TeacherRosterScope = {
  tenantId: string;
  teacherId: string;
  isAdmin: boolean;
};

export async function GET() {
  const user = await getSessionUser();
  if (!user || (user.user_metadata.role !== "teacher" && user.user_metadata.role !== "admin")) {
    return NextResponse.json({ data: null, error: "Teacher access required." }, { status: 403 });
  }

  const context = await resolveTenantContext(user);
  const scope: TeacherRosterScope = {
    tenantId: context.tenant.id,
    teacherId: user.id,
    isAdmin: user.user_metadata.role === "admin",
  };
  const [classes, students] = await Promise.all([listClasses(scope), listStudents(scope)]);

  return NextResponse.json({ data: { classes, students }, error: null });
}

function teacherClassPredicate(scope: TeacherRosterScope) {
  return scope.isAdmin ? "" : "AND c.teacher_id = ?";
}

function scopeParams(scope: TeacherRosterScope) {
  const params = tenantObjectParams({ objectTable: "classes", tenantId: scope.tenantId });
  if (!scope.isAdmin) params.push(scope.teacherId);
  return params;
}

function listClasses(scope: TeacherRosterScope) {
  return d1Query(
    `SELECT id, name, subject, grade_level, teacher_id
       FROM classes c
       ${tenantObjectJoin({ objectTable: "classes", objectAlias: "c", linkAlias: "tol" })}
      WHERE ${tenantObjectPredicate({ linkAlias: "tol" })}
        AND c.is_active = 1
        ${teacherClassPredicate(scope)}
      ORDER BY name`,
    scopeParams(scope),
  );
}

function listStudents(scope: TeacherRosterScope) {
  return d1Query(
    `SELECT DISTINCT p.id, p.full_name, p.email, p.grade_level, ce.class_id, c.name AS class_name
       FROM class_enrollments ce
       JOIN classes c ON c.id = ce.class_id
       JOIN profiles p ON p.id = ce.student_id
       ${tenantObjectJoin({ objectTable: "classes", objectAlias: "c", linkAlias: "tol" })}
      WHERE ce.is_active = 1
        AND ${tenantObjectPredicate({ linkAlias: "tol" })}
        AND c.is_active = 1
        ${teacherClassPredicate(scope)}
      ORDER BY c.name, p.full_name, p.email`,
    scopeParams(scope),
  );
}
