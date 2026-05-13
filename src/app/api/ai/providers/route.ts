import { NextResponse } from "next/server";
import { requireAdmin, auditAdminAction } from "@/lib/admin";
import { d1Query } from "@/lib/db/d1";
import {
  getProviderRow,
  listProviderRows,
  normalizeProviderPayload,
  PROVIDER_META,
  serializeProvider,
} from "@/lib/ai/providers";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const rows = await listProviderRows();
  return NextResponse.json({
    data: { providers: rows.map(serializeProvider), providerMeta: PROVIDER_META },
    error: null,
  });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const payload = normalizeProviderPayload((await request.json()) as Record<string, unknown>);
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

  const payload = normalizeProviderPayload(body, existing);
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
  const row = await getProviderRow(body.id);
  return NextResponse.json({ data: row ? serializeProvider(row) : null, error: null });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ data: null, error: "Provider id is required." }, { status: 400 });
  await d1Query("DELETE FROM ai_provider_configs WHERE id = ?", [id]);
  await auditAdminAction({ adminId: auth.user.id, action: "delete", entityType: "ai_provider", entityId: id });
  return NextResponse.json({ data: { deleted: true }, error: null });
}
