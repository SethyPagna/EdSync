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

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ data: null, error: "Authentication required." }, { status: 401 });
  }

  const body = (await request.json()) as {
    id?: string;
    mastery?: "again" | "almost" | "mastered";
    nextReviewAt?: string | null;
  };
  if (!body.id) {
    return NextResponse.json({ data: null, error: "Review card id is required." }, { status: 400 });
  }

  const context = await resolveTenantContext(user);
  const mastery = body.mastery === "mastered" || body.mastery === "almost" ? body.mastery : "again";
  await d1Query(
    `UPDATE practice_review_cards
        SET mastery = ?, next_review_at = ?, updated_at = datetime('now')
      WHERE id = ? AND tenant_id = ? AND user_id = ?`,
    [mastery, body.nextReviewAt ?? null, body.id, context.tenant.id, user.id],
  );

  return NextResponse.json({ data: { id: body.id, mastery }, error: null });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ data: null, error: "Authentication required." }, { status: 401 });
  }

  const context = await resolveTenantContext(user);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ data: null, error: "Review card id is required." }, { status: 400 });
  }

  await d1Query(
    "DELETE FROM practice_review_cards WHERE id = ? AND tenant_id = ? AND user_id = ?",
    [id, context.tenant.id, user.id],
  );

  return NextResponse.json({ data: { id, deleted: true }, error: null });
}
