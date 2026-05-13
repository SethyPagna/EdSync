import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { enqueueAutomationJob } from "@/lib/automation";
import { d1Query } from "@/lib/db/d1";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { resolveTenantContext } from "@/lib/tenancy";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);
  await requirePermission(user, context, PERMISSIONS.reportsView);
  const rules = await d1Query("SELECT * FROM automation_rules WHERE tenant_id = ? ORDER BY updated_at DESC", [context.tenant.id]);
  return NextResponse.json({ data: { rules, context }, error: null });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);
  await requirePermission(user, context, PERMISSIONS.coursesPublish);
  const body = (await request.json()) as { title?: string; triggerKey?: string; conditions?: Record<string, unknown>; actions?: Array<Record<string, unknown>>; enabled?: boolean };
  if (!body.title || !body.triggerKey) {
    return NextResponse.json({ data: null, error: "Title and trigger are required." }, { status: 400 });
  }
  const id = crypto.randomUUID();
  await d1Query(
    `INSERT INTO automation_rules (id, tenant_id, title, trigger_key, conditions, actions, enabled, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [
      id,
      context.tenant.id,
      body.title.trim(),
      body.triggerKey,
      JSON.stringify(body.conditions ?? {}),
      JSON.stringify(body.actions ?? []),
      body.enabled === false ? 0 : 1,
      user.id,
    ],
  );
  const jobId = await enqueueAutomationJob({ tenantId: context.tenant.id, jobType: "automation_rule.created", payload: { ruleId: id } });
  return NextResponse.json({ data: { id, jobId }, error: null });
}
