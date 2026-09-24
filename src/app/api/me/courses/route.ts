import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";

export async function GET() {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json(
      { data: null, error: "Unauthorized" },
      { status: 401 },
    );
  try {
    // Only the session owner can see these records, across their enrolled academies.
    // Do not expose billing tables through the general-purpose client data API.
    const courses = await d1Query(
      `
      SELECT bp.id, bp.title, COALESCE(bp.description, '') AS description,
             bp.course_id AS courseId, MIN(e.source_type) AS sourceType
        FROM entitlements e
        JOIN billing_products bp ON bp.id = e.product_id AND bp.tenant_id = e.tenant_id
        JOIN tenants t ON t.id = e.tenant_id
       WHERE e.user_id = ? AND e.status = 'active' AND bp.status = 'active' AND t.status = 'active'
         AND (e.starts_at IS NULL OR datetime(e.starts_at) <= datetime('now'))
         AND (e.ends_at IS NULL OR datetime(e.ends_at) > datetime('now'))
       GROUP BY bp.id, bp.title, bp.description, bp.course_id
       ORDER BY bp.title`,
      [user.id],
    );
    return NextResponse.json(
      { data: { courses }, error: null },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { data: null, error: "Your courses could not be loaded. Try again." },
      { status: 503 },
    );
  }
}
