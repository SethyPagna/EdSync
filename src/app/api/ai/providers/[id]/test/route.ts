import { NextResponse } from "next/server";
import { requireAdmin, auditAdminAction } from "@/lib/admin";
import { enqueueAutomationJob } from "@/lib/automation";
import { d1Query } from "@/lib/db/d1";
import { getProviderRow, serializeProvider } from "@/lib/ai/providers";
import { testAIProvider } from "@/lib/ai/gateway";
import { DEFAULT_TENANT_ID } from "@/lib/tenancy";

export const preferredRegion = ["hkg1", "sin1"];

async function enqueueProviderTest(providerId: string, provider: string, status: "ok" | "error", message?: string) {
  try {
    await enqueueAutomationJob({
      tenantId: DEFAULT_TENANT_ID,
      jobType: "ai_provider.tested",
      payload: { providerId, provider, status, message },
    });
  } catch {
    // Health tests should report their direct result even if the queue is unavailable.
  }
}

function statusForProviderTestError(message: string) {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("api key") ||
    normalized.includes("endpoint") ||
    normalized.includes("encryption") ||
    normalized.includes("decrypt")
  ) {
    return 422;
  }
  if (normalized.includes("busy") || normalized.includes("rate")) return 429;
  return 502;
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const row = await getProviderRow(id);
  if (!row) return NextResponse.json({ data: null, error: "Provider not found." }, { status: 404 });

  try {
    const message = await testAIProvider(row);
    await d1Query(
      `UPDATE ai_provider_configs
          SET last_status = 'ok', last_error = NULL, last_checked_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?`,
      [id],
    );
    await auditAdminAction({
      adminId: auth.user.id,
      action: "test",
      entityType: "ai_provider",
      entityId: id,
      metadata: { status: "ok" },
    });
    await enqueueProviderTest(id, row.provider, "ok", message);
    const updated = await getProviderRow(id);
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
      [message, id],
    );
    await auditAdminAction({
      adminId: auth.user.id,
      action: "test",
      entityType: "ai_provider",
      entityId: id,
      metadata: { status: "error", message },
    });
    await enqueueProviderTest(id, row.provider, "error", message);
    const updated = await getProviderRow(id);
    return NextResponse.json({
      data: { success: false, provider: updated ? serializeProvider(updated) : null },
      error: message,
    }, { status: statusForProviderTestError(message) });
  }
}
