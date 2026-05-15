import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import { resolveTenantContext } from "@/lib/tenancy";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ data: null, error: "Authentication required." }, { status: 401 });
  }

  const context = await resolveTenantContext(user);
  const rows = await d1Query(
    `SELECT *
       FROM practice_review_cards
      WHERE tenant_id = ? AND user_id = ?
      ORDER BY created_at DESC
      LIMIT 50`,
    [context.tenant.id, user.id],
  );

  return NextResponse.json({ data: rows, error: null });
}
