import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { applyOfflineSync } from "@/lib/offline-sync";
import { normalizeOfflineSyncItems } from "@/lib/validation/offline-sync";
import { resolveTenantContext } from "@/lib/tenancy";
import { isTenantOutsider } from "@/lib/tenancy/ownership";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);
  if (isTenantOutsider(user, context)) {
    return NextResponse.json({ data: null, error: "Organization membership required." }, { status: 403 });
  }
  const body = (await request.json()) as { items?: unknown };
  let items;
  try {
    items = normalizeOfflineSyncItems(body.items);
  } catch (error) {
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Invalid offline sync payload." },
      { status: 400 },
    );
  }
  const results = await applyOfflineSync({ tenantId: context.tenant.id, userId: user.id, items });
  return NextResponse.json({ data: { results, syncedAt: new Date().toISOString() }, error: null });
}
