import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { normalizeCertificationRulePayload, validateCertificationRuleId } from "@/lib/certifications/rules";
import { issueEligibleCertifications } from "@/lib/certifications/issuance";
import { d1Query } from "@/lib/db/d1";
import { deserializeRow } from "@/lib/db/schema";
import { loadAccessibleLesson } from "@/lib/lessons/access";
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
import { toClientTenantContext } from "@/lib/tenancy/client-context";
import { isOwnerScoped, ownerScope } from "@/lib/tenancy/ownership";

// certification_rules has no owner column, so the creator is kept in settings.ownerId.
const RULE_OWNER = "CASE WHEN json_valid(settings) THEN json_extract(settings, '$.ownerId') END";

function ruleOwner(settings: unknown) {
  try {
    const parsed = typeof settings === "string" ? (JSON.parse(settings) as Record<string, unknown>) : settings;
    const ownerId = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>).ownerId : null;
    return typeof ownerId === "string" && ownerId ? ownerId : null;
  } catch {
    return null;
  }
}

function ruleId(value: unknown) {
  try {
    return validateCertificationRuleId(value);
  } catch (error) {
    throw new BadRequestError(error instanceof Error ? error.message : "Rule is required.");
  }
}

export const GET = withRoute(async (request) => {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  const context = await resolveTenantContext(user);
  const tenantId = context.tenant.id;
  const isStudent = user.user_metadata.role === "student";
  const scoped = isOwnerScoped(user, context);
  const cursor = new URL(request.url).searchParams.get("cursor");
  if (cursor !== null && (cursor.length === 0 || cursor.length > 500)) {
    throw new BadRequestError("Issue cursor is invalid.");
  }
  const issueResult = isStudent
    ? await issueEligibleCertifications({ tenantId, studentId: user.id, cursor: cursor ?? undefined })
    : null;
  const ruleFilter = !scoped
    ? { sql: "", params: [] as unknown[] }
    : isStudent
      ? {
          sql: " AND id IN (SELECT rule_id FROM learner_certifications WHERE tenant_id = ? AND user_id = ?)",
          params: [tenantId, user.id] as unknown[],
        }
      : ownerScope(user, context, RULE_OWNER);
  const ruleRows = await d1Query(
    `SELECT * FROM certification_rules WHERE tenant_id = ?${ruleFilter.sql} ORDER BY updated_at DESC`,
    [tenantId, ...ruleFilter.params],
  );
  const rules = ruleRows.map((row) => deserializeRow("certification_rules", row));
  const certifications = isStudent
    ? await d1Query("SELECT * FROM learner_certifications WHERE tenant_id = ? AND user_id = ? ORDER BY expires_at ASC", [tenantId, user.id])
    : scoped
      ? await d1Query(
          `SELECT lc.*
             FROM learner_certifications lc
             JOIN certification_rules cr ON cr.id = lc.rule_id
            WHERE lc.tenant_id = ? AND CASE WHEN json_valid(cr.settings) THEN json_extract(cr.settings, '$.ownerId') END = ?
            ORDER BY lc.expires_at ASC
            LIMIT 100`,
          [tenantId, user.id],
        )
      : await d1Query("SELECT * FROM learner_certifications WHERE tenant_id = ? ORDER BY expires_at ASC LIMIT 100", [tenantId]);
  return NextResponse.json({ data: { rules, certifications, context: toClientTenantContext(context), nextCursor: issueResult?.nextCursor ?? null }, error: null });
});

export const POST = withRoute(async (request) => {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  const context = await resolveTenantContext(user);
  await requirePermission(user, context, PERMISSIONS.coursesPublish).catch(() => {
    throw new ForbiddenError("Missing publish permission.");
  });
  const body = await readJson<{
    action?: "create" | "update" | "delete" | "issue";
    id?: string;
    title?: string;
    description?: string | null;
    courseId?: string | null;
    expiresAfterDays?: number | null;
    notifyBeforeDays?: number;
    settings?: Record<string, unknown>;
    cursor?: string;
  }>(request);
  const owner = ownerScope(user, context, RULE_OWNER);

  if (body.action === "issue") {
    const id = ruleId(body.id);
    if (body.cursor && (typeof body.cursor !== "string" || body.cursor.length > 500)) {
      throw new BadRequestError("Issue cursor is invalid.");
    }
    const [rule] = await d1Query<{ course_id: string | null }>(
      `SELECT course_id FROM certification_rules WHERE tenant_id = ? AND id = ?${owner.sql} LIMIT 1`,
      [context.tenant.id, id, ...owner.params],
    );
    if (!rule) throw new NotFoundError("Rule not found.");
    if (!rule.course_id) throw new BadRequestError("Link a course lesson before issuing certifications.");
    const result = await issueEligibleCertifications({
      tenantId: context.tenant.id,
      ruleId: id,
      ownerId: isOwnerScoped(user, context) ? user.id : undefined,
      cursor: body.cursor,
    });
    return NextResponse.json({ data: result, error: null });
  }

  if (body.action === "delete") {
    const id = ruleId(body.id);
    const [deleted] = await d1Query<{ id: string }>(
      `DELETE FROM certification_rules WHERE tenant_id = ? AND id = ?${owner.sql} RETURNING id`,
      [context.tenant.id, id, ...owner.params],
    );
    if (!deleted) throw new NotFoundError("Rule not found.");
    return NextResponse.json({ data: { id }, error: null });
  }

  let normalized;
  try {
    normalized = normalizeCertificationRulePayload(body);
  } catch (error) {
    throw new BadRequestError(error instanceof Error ? error.message : "Certification rule is invalid.");
  }
  if (normalized.courseId) {
    const lesson = await loadAccessibleLesson({
      lessonId: normalized.courseId,
      tenantId: context.tenant.id,
      user,
      tenantMember: context.membership?.status === "active",
    });
    if (!lesson) throw new BadRequestError("Choose a lesson in this organization that you can manage.");
  }
  const settings: Record<string, unknown> = { ...normalized.settings };
  delete settings.ownerId;

  if (body.action === "update") {
    const id = ruleId(body.id);
    const [existing] = await d1Query<{ settings: unknown }>(
      `SELECT settings FROM certification_rules WHERE tenant_id = ? AND id = ?${owner.sql} LIMIT 1`,
      [context.tenant.id, id, ...owner.params],
    );
    if (!existing) throw new NotFoundError("Rule not found.");
    const existingOwner = ruleOwner(existing.settings);
    if (existingOwner) settings.ownerId = existingOwner;
    await d1Query(
      `UPDATE certification_rules
       SET title = ?, description = ?, course_id = ?, expires_after_days = ?, notify_before_days = ?, settings = ?, updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [
        normalized.title,
        normalized.description,
        normalized.courseId,
        normalized.expiresAfterDays,
        normalized.notifyBeforeDays,
        JSON.stringify(settings),
        context.tenant.id,
        id,
      ],
    );
    return NextResponse.json({ data: { id }, error: null });
  }

  const id = crypto.randomUUID();
  await d1Query(
    `INSERT INTO certification_rules (
     id, tenant_id, title, description, course_id, expires_after_days, notify_before_days, settings, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [
      id,
      context.tenant.id,
      normalized.title,
      normalized.description,
      normalized.courseId,
      normalized.expiresAfterDays,
      normalized.notifyBeforeDays,
      JSON.stringify({ ...settings, ownerId: user.id }),
    ],
  );
  return NextResponse.json({ data: { id }, error: null });
});
