import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import { normalizePracticeReviewCardRow } from "@/lib/practice/review-cards";
import { normalizeReviewUpdate, validateReviewCardId } from "@/lib/practice/review-validation";
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

  return NextResponse.json({
    data: rows.map((row) => normalizePracticeReviewCardRow(row)),
    error: null,
  });
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
  let update;
  try {
    update = normalizeReviewUpdate(body);
  } catch (error) {
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Invalid review update." },
      { status: 400 },
    );
  }

  const context = await resolveTenantContext(user);
  await d1Query(
    `UPDATE practice_review_cards
        SET mastery = ?, next_review_at = ?, updated_at = datetime('now')
      WHERE id = ? AND tenant_id = ? AND user_id = ?`,
    [update.mastery, update.nextReviewAt, update.id, context.tenant.id, user.id],
  );

  return NextResponse.json({ data: { id: update.id, mastery: update.mastery }, error: null });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ data: null, error: "Authentication required." }, { status: 401 });
  }

  const context = await resolveTenantContext(user);
  let id: string;
  try {
    id = validateReviewCardId(new URL(request.url).searchParams.get("id"));
  } catch (error) {
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Invalid review card." },
      { status: 400 },
    );
  }

  await d1Query(
    "DELETE FROM practice_review_cards WHERE id = ? AND tenant_id = ? AND user_id = ?",
    [id, context.tenant.id, user.id],
  );

  return NextResponse.json({ data: { id, deleted: true }, error: null });
}
