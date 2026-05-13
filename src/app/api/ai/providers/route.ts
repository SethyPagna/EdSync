import { NextResponse } from "next/server";
import { requireAdmin, auditAdminAction } from "@/lib/admin";
import { enqueueAutomationJob } from "@/lib/automation";
import { d1Query } from "@/lib/db/d1";
import {
  getProviderRow,
  listProviderRows,
  normalizeProviderPayload,
  PROVIDER_META,
  serializeProvider,
} from "@/lib/ai/providers";
import { DEFAULT_TENANT_ID } from "@/lib/tenancy";

export const preferredRegion = ["hkg1", "sin1"];

type ProviderAction = "toggle" | "reset_status";

type AIRunRow = {
  id: string;
  feature: string;
  provider: string | null;
  model: string | null;
  success: number;
  latency_ms: number | null;
  error_message: string | null;
  created_at: string;
};

async function enqueueProviderAutomation(jobType: string, payload: Record<string, unknown>) {
  try {
    await enqueueAutomationJob({ tenantId: DEFAULT_TENANT_ID, jobType, payload });
  } catch {
    // Admin settings changes should still save if the background queue is unavailable.
  }
}

function providerSummary(rows: ReturnType<typeof serializeProvider>[], recentRuns: AIRunRow[]) {
  const successfulRuns = recentRuns.filter((run) => Boolean(run.success));
  const latencies = successfulRuns.map((run) => Number(run.latency_ms || 0)).filter((latency) => latency > 0);
  const averageLatencyMs = latencies.length
    ? Math.round(latencies.reduce((total, latency) => total + latency, 0) / latencies.length)
    : null;

  return {
    total: rows.length,
    enabled: rows.filter((row) => row.enabled).length,
    healthy: rows.filter((row) => row.last_status === "ok").length,
    errors: rows.filter((row) => row.last_status === "error").length,
    chat: rows.filter((row) => row.provider_type === "chat").length,
    embed: rows.filter((row) => row.provider_type === "embed").length,
    recent_runs: recentRuns.length,
    recent_failures: recentRuns.filter((run) => !run.success).length,
    average_latency_ms: averageLatencyMs,
  };
}

function enabledFromAction(value: unknown, fallback: number) {
  if (value === undefined) return fallback ? 1 : 0;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return value === 0 ? 0 : 1;
  return ["false", "0", "off", "disabled", "no"].includes(String(value).trim().toLowerCase()) ? 0 : 1;
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const [rows, recentRuns] = await Promise.all([
    listProviderRows(),
    d1Query<AIRunRow>(
      `SELECT id, feature, provider, model, success, latency_ms, error_message, created_at
         FROM ai_runs
        ORDER BY created_at DESC
        LIMIT 20`,
    ).catch(() => []),
  ]);
  const providers = rows.map(serializeProvider);
  return NextResponse.json({
    data: { providers, providerMeta: PROVIDER_META, summary: providerSummary(providers, recentRuns), recentRuns },
    error: null,
  });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  let payload;
  try {
    payload = normalizeProviderPayload((await request.json()) as Record<string, unknown>);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provider payload is invalid.";
    return NextResponse.json({ data: null, error: message }, { status: 400 });
  }
  const id = crypto.randomUUID();
  await d1Query(
    `INSERT INTO ai_provider_configs (
       id, name, provider, provider_type, account_email, project_name, api_key_encrypted,
       default_model, supported_models, endpoint_override, notes, enabled, priority,
       requests_per_minute, max_input_chars, max_completion_tokens, timeout_ms,
       cooldown_seconds, created_by, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [
      id,
      payload.name,
      payload.provider,
      payload.provider_type,
      payload.account_email,
      payload.project_name,
      payload.api_key_encrypted,
      payload.default_model,
      payload.supported_models,
      payload.endpoint_override,
      payload.notes,
      payload.enabled,
      payload.priority,
      payload.requests_per_minute,
      payload.max_input_chars,
      payload.max_completion_tokens,
      payload.timeout_ms,
      payload.cooldown_seconds,
      auth.user.id,
    ],
  );
  await auditAdminAction({ adminId: auth.user.id, action: "create", entityType: "ai_provider", entityId: id });
  await enqueueProviderAutomation("ai_provider.created", { providerId: id, provider: payload.provider, enabled: Boolean(payload.enabled) });
  const row = await getProviderRow(id);
  return NextResponse.json({ data: row ? serializeProvider(row) : null, error: null });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const body = (await request.json()) as Record<string, unknown> & { id?: string };
  if (!body.id) return NextResponse.json({ data: null, error: "Provider id is required." }, { status: 400 });
  const existing = await getProviderRow(body.id);
  if (!existing) return NextResponse.json({ data: null, error: "Provider not found." }, { status: 404 });

  if (body.action) {
    return handleProviderAction(auth.user.id, existing, String(body.action) as ProviderAction, body);
  }

  let payload;
  try {
    payload = normalizeProviderPayload(body, existing);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provider payload is invalid.";
    return NextResponse.json({ data: null, error: message }, { status: 400 });
  }
  await d1Query(
    `UPDATE ai_provider_configs
        SET name = ?, provider = ?, provider_type = ?, account_email = ?, project_name = ?,
            api_key_encrypted = ?, default_model = ?, supported_models = ?, endpoint_override = ?,
            notes = ?, enabled = ?, priority = ?, requests_per_minute = ?, max_input_chars = ?,
            max_completion_tokens = ?, timeout_ms = ?, cooldown_seconds = ?, updated_at = datetime('now')
      WHERE id = ?`,
    [
      payload.name,
      payload.provider,
      payload.provider_type,
      payload.account_email,
      payload.project_name,
      payload.api_key_encrypted,
      payload.default_model,
      payload.supported_models,
      payload.endpoint_override,
      payload.notes,
      payload.enabled,
      payload.priority,
      payload.requests_per_minute,
      payload.max_input_chars,
      payload.max_completion_tokens,
      payload.timeout_ms,
      payload.cooldown_seconds,
      body.id,
    ],
  );
  await auditAdminAction({ adminId: auth.user.id, action: "update", entityType: "ai_provider", entityId: body.id });
  await enqueueProviderAutomation("ai_provider.updated", { providerId: body.id, provider: payload.provider, enabled: Boolean(payload.enabled) });
  const row = await getProviderRow(body.id);
  return NextResponse.json({ data: row ? serializeProvider(row) : null, error: null });
}

async function handleProviderAction(
  adminId: string,
  existing: NonNullable<Awaited<ReturnType<typeof getProviderRow>>>,
  action: ProviderAction,
  body: Record<string, unknown> & { id?: string },
) {
  if (action === "toggle") {
    const enabled = body.enabled === undefined ? (existing.enabled ? 0 : 1) : enabledFromAction(body.enabled, existing.enabled);
    await d1Query("UPDATE ai_provider_configs SET enabled = ?, updated_at = datetime('now') WHERE id = ?", [enabled, existing.id]);
    await auditAdminAction({
      adminId,
      action: enabled ? "enable" : "disable",
      entityType: "ai_provider",
      entityId: existing.id,
      metadata: { provider: existing.provider },
    });
    await enqueueProviderAutomation("ai_provider.toggled", {
      providerId: existing.id,
      provider: existing.provider,
      enabled: Boolean(enabled),
    });
    const row = await getProviderRow(existing.id);
    return NextResponse.json({ data: row ? serializeProvider(row) : null, error: null });
  }

  if (action === "reset_status") {
    await d1Query(
      "UPDATE ai_provider_configs SET last_status = 'untested', last_error = NULL, last_checked_at = NULL, updated_at = datetime('now') WHERE id = ?",
      [existing.id],
    );
    await auditAdminAction({
      adminId,
      action: "reset_status",
      entityType: "ai_provider",
      entityId: existing.id,
      metadata: { provider: existing.provider },
    });
    await enqueueProviderAutomation("ai_provider.status_reset", { providerId: existing.id, provider: existing.provider });
    const row = await getProviderRow(existing.id);
    return NextResponse.json({ data: row ? serializeProvider(row) : null, error: null });
  }

  return NextResponse.json({ data: null, error: "Unsupported provider action." }, { status: 400 });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ data: null, error: "Provider id is required." }, { status: 400 });
  const existing = await getProviderRow(id);
  await d1Query("DELETE FROM ai_provider_configs WHERE id = ?", [id]);
  await auditAdminAction({ adminId: auth.user.id, action: "delete", entityType: "ai_provider", entityId: id });
  await enqueueProviderAutomation("ai_provider.deleted", { providerId: id, provider: existing?.provider ?? null });
  return NextResponse.json({ data: { deleted: true }, error: null });
}
