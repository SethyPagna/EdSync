import { NextResponse } from "next/server";
import { requireAdmin, auditAdminAction } from "@/lib/admin";
import { d1Query } from "@/lib/db/d1";
import { getProviderRow, serializeProvider } from "@/lib/ai/providers";
import { testAIProvider } from "@/lib/ai/gateway";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const row = await getProviderRow(params.id);
  if (!row) return NextResponse.json({ data: null, error: "Provider not found." }, { status: 404 });

  try {
    const message = await testAIProvider(row);
    await d1Query(
      `UPDATE ai_provider_configs
          SET last_status = 'ok', last_error = NULL, last_checked_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?`,
      [params.id],
    );
    await auditAdminAction({
      adminId: auth.user.id,
      action: "test",
      entityType: "ai_provider",
      entityId: params.id,
      metadata: { status: "ok" },
    });
    const updated = await getProviderRow(params.id);
    return NextResponse.json({
      data: { success: true, message, provider: updated ? serializeProvider(updated) : null },
      error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provider test failed.";
    await d1Query(
      `UPDATE ai_provider_configs
          SET last_status = 'error', last_error = ?, last_checked_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?`,
      [message, params.id],
    );
    await auditAdminAction({
      adminId: auth.user.id,
      action: "test",
      entityType: "ai_provider",
      entityId: params.id,
      metadata: { status: "error", message },
    });
    const updated = await getProviderRow(params.id);
    return NextResponse.json({
      data: { success: false, provider: updated ? serializeProvider(updated) : null },
      error: message,
    }, { status: 400 });
  }
}
