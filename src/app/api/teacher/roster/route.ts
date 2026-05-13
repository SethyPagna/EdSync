import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";

export async function GET() {
  const user = await getSessionUser();
  if (!user || (user.user_metadata.role !== "teacher" && user.user_metadata.role !== "admin")) {
    return NextResponse.json({ data: null, error: "Teacher access required." }, { status: 403 });
  }

  const classWhere = user.user_metadata.role === "admin" ? "1=1" : "teacher_id = ?";
  const classParams = user.user_metadata.role === "admin" ? [] : [user.id];
  const classes = await d1Query(
    `SELECT id, name, subject, grade_level, teacher_id
       FROM classes
      WHERE ${classWhere} AND is_active = 1
      ORDER BY name`,
    classParams,
  );

  const students = await d1Query(
    `SELECT DISTINCT p.id, p.full_name, p.email, p.grade_level, ce.class_id, c.name AS class_name
       FROM class_enrollments ce
       JOIN classes c ON c.id = ce.class_id
       JOIN profiles p ON p.id = ce.student_id
      WHERE ce.is_active = 1
        AND ${user.user_metadata.role === "admin" ? "1=1" : "c.teacher_id = ?"}
      ORDER BY c.name, p.full_name, p.email`,
    user.user_metadata.role === "admin" ? [] : [user.id],
  );

  return NextResponse.json({ data: { classes, students }, error: null });
}
