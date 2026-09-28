import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { enqueueAutomationJob } from "@/lib/automation";
import {
  AUTOMATION_RECIPES,
  normalizeAutomationEnabled,
  normalizeAutomationRulePayload,
  validateAutomationRuleId,
} from "@/lib/automation/rules";
import { d1Query } from "@/lib/db/d1";
import { deserializeRow } from "@/lib/db/schema";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  readJson,
  withRoute,
} from "@/lib/security/http-errors";
import { resolveTenantContext } from "@/lib/tenancy";
import { isOwnerScoped, ownerScope } from "@/lib/tenancy/ownership";

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
        JSON.stringify(rule.conditions),
        JSON.stringify(rule.actions),
        userId,
      ],
    );
  }
}

function parsed<T>(parse: () => T, fallback: string): T {
  try {
    return parse();
  } catch (error) {
    throw new BadRequestError(error instanceof Error ? error.message : fallback);
  }
}

export const GET = withRoute(async () => {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  const context = await resolveTenantContext(user);
  await requirePermission(user, context, PERMISSIONS.reportsView).catch(() => {
    throw new ForbiddenError("Missing reports permission.");
  });
  // Tenant-wide default rules are only seeded by someone who can see the whole tenant.
  if (!isOwnerScoped(user, context)) await seedDefaultAutomations(context.tenant.id, user.id);
  const owner = ownerScope(user, context, "created_by");
  const rows = await d1Query(
    `SELECT * FROM automation_rules WHERE tenant_id = ?${owner.sql} ORDER BY updated_at DESC`,
    [context.tenant.id, ...owner.params],
  );
  const rules = rows.map((row) => deserializeRow("automation_rules", row));
  return NextResponse.json({ data: { rules, context }, error: null });
});

export const POST = withRoute(async (request) => {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  const context = await resolveTenantContext(user);
  await requirePermission(user, context, PERMISSIONS.coursesPublish).catch(() => {
    throw new ForbiddenError("Missing publish permission.");
  });
  const body = await readJson<{
    action?: "create" | "update" | "delete" | "toggle";
    id?: string;
    title?: string;
    triggerKey?: string;
    conditions?: Record<string, unknown>;
    actions?: Array<Record<string, unknown>>;
    enabled?: boolean;
  }>(request);
  const owner = ownerScope(user, context, "created_by");

  if (body.action === "delete") {
    const id = parsed(() => validateAutomationRuleId(body.id), "Rule is required.");
    const [deleted] = await d1Query<{ id: string }>(
      `DELETE FROM automation_rules WHERE tenant_id = ? AND id = ?${owner.sql} RETURNING id`,
      [context.tenant.id, id, ...owner.params],
    );
    if (!deleted) throw new NotFoundError("Rule not found.");
    return NextResponse.json({ data: { id }, error: null });
  }

  if (body.action === "toggle") {
    const { id, enabled } = parsed(
      () => ({ id: validateAutomationRuleId(body.id), enabled: normalizeAutomationEnabled(body.enabled) }),
      "Rule is required.",
    );
    const [updated] = await d1Query<{ id: string }>(
      `UPDATE automation_rules SET enabled = ?, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?${owner.sql} RETURNING id`,
      [enabled ? 1 : 0, context.tenant.id, id, ...owner.params],
    );
    if (!updated) throw new NotFoundError("Rule not found.");
    const jobId = await enqueueAutomationJob({ tenantId: context.tenant.id, jobType: "automation_rule.toggled", payload: { ruleId: id } });
    return NextResponse.json({ data: { id, jobId }, error: null });
  }

  const normalized = parsed(() => normalizeAutomationRulePayload(body), "Automation rule is invalid.");

  if (body.action === "update") {
    const id = parsed(() => validateAutomationRuleId(body.id), "Rule is required.");
    const [updated] = await d1Query<{ id: string }>(
      `UPDATE automation_rules
       SET title = ?, trigger_key = ?, conditions = ?, actions = ?, enabled = ?, updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?${owner.sql}
       RETURNING id`,
      [
        normalized.title,
        normalized.triggerKey,
        JSON.stringify(normalized.conditions),
        JSON.stringify(normalized.actions),
        normalized.enabled ? 1 : 0,
        context.tenant.id,
        id,
        ...owner.params,
      ],
    );
    if (!updated) throw new NotFoundError("Rule not found.");
    const jobId = await enqueueAutomationJob({ tenantId: context.tenant.id, jobType: "automation_rule.updated", payload: { ruleId: id } });
    return NextResponse.json({ data: { id, jobId }, error: null });
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
      JSON.stringify(normalized.conditions),
      JSON.stringify(normalized.actions),
      normalized.enabled ? 1 : 0,
      user.id,
    ],
  );
  const jobId = await enqueueAutomationJob({ tenantId: context.tenant.id, jobType: "automation_rule.created", payload: { ruleId: id } });
  return NextResponse.json({ data: { id, jobId }, error: null });
});
