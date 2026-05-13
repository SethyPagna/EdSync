import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { d1Query } from "@/lib/db/d1";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const [securityEvents, auditLogs] = await Promise.all([
    d1Query(
      `SELECT *
         FROM security_events
        ORDER BY created_at DESC
        LIMIT 100`,
    ),
    d1Query(
      `SELECT aal.*, p.email AS admin_email, p.full_name AS admin_name
         FROM admin_audit_logs aal
         LEFT JOIN profiles p ON p.id = aal.admin_id
        ORDER BY aal.created_at DESC
        LIMIT 100`,
    ),
  ]);

  return NextResponse.json({ data: { securityEvents, auditLogs }, error: null });
}
