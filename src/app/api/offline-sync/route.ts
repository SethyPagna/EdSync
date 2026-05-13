import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { applyOfflineSync, type OfflineSyncItem } from "@/lib/offline-sync";
import { resolveTenantContext } from "@/lib/tenancy";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);
  const body = (await request.json()) as { items?: OfflineSyncItem[] };
  const items = Array.isArray(body.items) ? body.items.slice(0, 100) : [];
  const results = await applyOfflineSync({ tenantId: context.tenant.id, userId: user.id, items });
  return NextResponse.json({ data: { results, syncedAt: new Date().toISOString() }, error: null });
}
