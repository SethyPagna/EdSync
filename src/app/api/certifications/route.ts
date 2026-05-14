import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import { deserializeRow } from "@/lib/db/schema";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { resolveTenantContext } from "@/lib/tenancy";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);
  const ruleRows = await d1Query("SELECT * FROM certification_rules WHERE tenant_id = ? ORDER BY updated_at DESC", [context.tenant.id]);
  const rules = ruleRows.map((row) => deserializeRow("certification_rules", row));
  const certifications = user.user_metadata.role === "student"
    ? await d1Query("SELECT * FROM learner_certifications WHERE tenant_id = ? AND user_id = ? ORDER BY expires_at ASC", [context.tenant.id, user.id])
    : await d1Query("SELECT * FROM learner_certifications WHERE tenant_id = ? ORDER BY expires_at ASC LIMIT 100", [context.tenant.id]);
  return NextResponse.json({ data: { rules, certifications, context }, error: null });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);
  try {
    await requirePermission(user, context, PERMISSIONS.coursesPublish);
  } catch {
    return NextResponse.json({ data: null, error: "Missing publish permission." }, { status: 403 });
  }
  const body = (await request.json()) as {
    action?: "create" | "update" | "delete";
    id?: string;
    title?: string;
    description?: string | null;
    courseId?: string | null;
    expiresAfterDays?: number | null;
    notifyBeforeDays?: number;
  };

  if (body.action === "delete") {
    if (!body.id) return NextResponse.json({ data: null, error: "Rule is required." }, { status: 400 });
    await d1Query("DELETE FROM certification_rules WHERE tenant_id = ? AND id = ?", [context.tenant.id, body.id]);
    return NextResponse.json({ data: { id: body.id }, error: null });
  }

  if (!body.title) return NextResponse.json({ data: null, error: "Title is required." }, { status: 400 });

  if (body.action === "update") {
    if (!body.id) return NextResponse.json({ data: null, error: "Rule is required." }, { status: 400 });
    await d1Query(
      `UPDATE certification_rules
       SET title = ?, description = ?, course_id = ?, expires_after_days = ?, notify_before_days = ?, updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [
        body.title.trim(),
        body.description ?? null,
        body.courseId ?? null,
        body.expiresAfterDays ?? null,
        Math.max(0, Number(body.notifyBeforeDays ?? 30)),
        context.tenant.id,
        body.id,
      ],
    );
    return NextResponse.json({ data: { id: body.id }, error: null });
  }

  const id = crypto.randomUUID();
  await d1Query(
    `INSERT INTO certification_rules (
       id, tenant_id, title, description, course_id, expires_after_days, notify_before_days, settings, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, '{}', datetime('now'), datetime('now'))`,
    [id, context.tenant.id, body.title.trim(), body.description ?? null, body.courseId ?? null, body.expiresAfterDays ?? null, body.notifyBeforeDays ?? 30],
  );
  return NextResponse.json({ data: { id }, error: null });
}
