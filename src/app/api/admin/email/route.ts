import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { d1Query } from "@/lib/db/d1";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const rows = await d1Query(
    `SELECT eo.*, p.full_name AS teacher_name, p.email AS teacher_email, c.name AS class_name
       FROM email_outbox_events eo
       LEFT JOIN profiles p ON p.id = eo.teacher_id
       LEFT JOIN classes c ON c.id = eo.class_id
      ORDER BY eo.created_at DESC
      LIMIT 100`,
  );
  return NextResponse.json({ data: rows, error: null });
}
