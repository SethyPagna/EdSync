import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import { appendLearningEvent } from "@/lib/learning-events";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { resolveTenantContext } from "@/lib/tenancy";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);
  await requirePermission(user, context, PERMISSIONS.reportsView);
  const events = await d1Query(
    "SELECT * FROM learning_events WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 100",
    [context.tenant.id],
  );
  return NextResponse.json({ data: { events, context }, error: null });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);
  const body = (await request.json()) as {
    sourceType?: string;
    sourceId?: string | null;
    eventType?: string;
    payload?: Record<string, unknown>;
  };
  if (!body.sourceType || !body.eventType) {
    return NextResponse.json({ data: null, error: "Source type and event type are required." }, { status: 400 });
  }
  const id = await appendLearningEvent({
    tenantId: context.tenant.id,
    actorId: user.id,
    studentId: user.user_metadata.role === "student" ? user.id : null,
    sourceType: body.sourceType,
    sourceId: body.sourceId ?? null,
    eventType: body.eventType,
    payload: body.payload ?? {},
  });
  return NextResponse.json({ data: { id }, error: null });
}
