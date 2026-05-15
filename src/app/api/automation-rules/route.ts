import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { enqueueAutomationJob } from "@/lib/automation";
import { AUTOMATION_RECIPES, normalizeAutomationRulePayload } from "@/lib/automation/rules";
import { d1Query } from "@/lib/db/d1";
import { deserializeRow } from "@/lib/db/schema";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { resolveTenantContext } from "@/lib/tenancy";

async function seedDefaultAutomations(tenantId: string, userId: string) {
  for (const rule of AUTOMATION_RECIPES) {
    await d1Query(
      `INSERT OR IGNORE INTO automation_rules (
         id, tenant_id, title, trigger_key, conditions, actions, enabled, created_by, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, datetime('now'), datetime('now'))`,
      [
        `automation_${tenantId}_${rule.triggerKey.replace(/[^a-z0-9]+/gi, "_")}`,
        tenantId,
        rule.title,
        rule.triggerKey,
        rule.conditions,
        rule.actions,
        userId,
      ],
    );
  }
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);
  try {
    await requirePermission(user, context, PERMISSIONS.reportsView);
  } catch {
    return NextResponse.json({ data: null, error: "Missing reports permission." }, { status: 403 });
  }
  await seedDefaultAutomations(context.tenant.id, user.id);
  const rows = await d1Query("SELECT * FROM automation_rules WHERE tenant_id = ? ORDER BY updated_at DESC", [context.tenant.id]);
  const rules = rows.map((row) => deserializeRow("automation_rules", row));
  return NextResponse.json({ data: { rules, context }, error: null });
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
    action?: "create" | "update" | "delete" | "toggle";
    id?: string;
    title?: string;
    triggerKey?: string;
    conditions?: Record<string, unknown>;
    actions?: Array<Record<string, unknown>>;
    enabled?: boolean;
  };

  if (body.action === "delete") {
    if (!body.id) return NextResponse.json({ data: null, error: "Rule is required." }, { status: 400 });
    await d1Query("DELETE FROM automation_rules WHERE tenant_id = ? AND id = ?", [context.tenant.id, body.id]);
    return NextResponse.json({ data: { id: body.id }, error: null });
  }

  if (body.action === "toggle") {
    if (!body.id) return NextResponse.json({ data: null, error: "Rule is required." }, { status: 400 });
    await d1Query("UPDATE automation_rules SET enabled = ?, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?", [
      body.enabled === false ? 0 : 1,
      context.tenant.id,
      body.id,
    ]);
    const jobId = await enqueueAutomationJob({ tenantId: context.tenant.id, jobType: "automation_rule.toggled", payload: { ruleId: body.id } });
    return NextResponse.json({ data: { id: body.id, jobId }, error: null });
  }

  let normalized;
  try {
    normalized = normalizeAutomationRulePayload(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Automation rule is invalid.";
    return NextResponse.json({ data: null, error: message }, { status: 400 });
  }

  if (body.action === "update") {
    if (!body.id) return NextResponse.json({ data: null, error: "Rule is required." }, { status: 400 });
    await d1Query(
      `UPDATE automation_rules
       SET title = ?, trigger_key = ?, conditions = ?, actions = ?, enabled = ?, updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [
        normalized.title,
        normalized.triggerKey,
        normalized.conditions,
        normalized.actions,
        normalized.enabled ? 1 : 0,
        context.tenant.id,
        body.id,
      ],
    );
    const jobId = await enqueueAutomationJob({ tenantId: context.tenant.id, jobType: "automation_rule.updated", payload: { ruleId: body.id } });
    return NextResponse.json({ data: { id: body.id, jobId }, error: null });
  }

  const id = crypto.randomUUID();
  await d1Query(
    `INSERT INTO automation_rules (id, tenant_id, title, trigger_key, conditions, actions, enabled, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [
      id,
      context.tenant.id,
      normalized.title,
      normalized.triggerKey,
      normalized.conditions,
      normalized.actions,
      normalized.enabled ? 1 : 0,
      user.id,
    ],
  );
  const jobId = await enqueueAutomationJob({ tenantId: context.tenant.id, jobType: "automation_rule.created", payload: { ruleId: id } });
  return NextResponse.json({ data: { id, jobId }, error: null });
}
