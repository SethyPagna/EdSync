import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { d1Query } from "@/lib/db/d1";

async function count(sql: string, params: unknown[] = []) {
  const [row] = await d1Query<{ count: number }>(sql, params);
  return row?.count ?? 0;
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const [
    users,
    teachers,
    students,
    classes,
    lessons,
    workItems,
    submissions,
    providers,
    emails,
    securityEvents,
  ] = await Promise.all([
    count("SELECT COUNT(*) AS count FROM profiles"),
    count("SELECT COUNT(*) AS count FROM profiles WHERE role = 'teacher'"),
    count("SELECT COUNT(*) AS count FROM profiles WHERE role = 'student'"),
    count("SELECT COUNT(*) AS count FROM classes WHERE is_active = 1"),
    count("SELECT COUNT(*) AS count FROM lessons"),
    count("SELECT COUNT(*) AS count FROM learning_work_items"),
    count("SELECT COUNT(*) AS count FROM learning_submissions"),
    count("SELECT COUNT(*) AS count FROM ai_provider_configs WHERE enabled = 1"),
    count("SELECT COUNT(*) AS count FROM email_outbox_events"),
    count("SELECT COUNT(*) AS count FROM security_events WHERE created_at >= datetime('now', '-7 days')"),
  ]);

  const recentAudit = await d1Query(
    `SELECT *
       FROM admin_audit_logs
      ORDER BY created_at DESC
      LIMIT 12`,
  );

  return NextResponse.json({
    data: {
      cards: { users, teachers, students, classes, lessons, workItems, submissions, providers, emails, securityEvents },
      recentAudit,
    },
    error: null,
  });
}
