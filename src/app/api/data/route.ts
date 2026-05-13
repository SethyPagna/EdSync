import { NextResponse } from "next/server";
import { executeDataRequest, type DataRequest } from "@/lib/db/d1";
import { getSessionUser } from "@/lib/auth/session";
import { authorizeDataRequest } from "@/lib/security/data-access";
import { enforceRateLimit, logSecurityEvent } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({
      data: null,
      error: { message: "Authentication required." },
    }, { status: 401 });
  }

  const payload = (await request.json()) as DataRequest;
  const rate = await enforceRateLimit({
    request,
    scope: `data_${payload.action}`,
    limit: payload.action === "select" ? 180 : 80,
    windowSeconds: 300,
    userId: user.id,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { data: null, error: { message: "Too many data requests. Try again shortly." } },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    );
  }

  const denied = authorizeDataRequest(user, payload);
  if (denied) {
    await logSecurityEvent({
      request,
      userId: user.id,
      eventType: "data_access_denied",
      severity: "warning",
      message: denied,
      metadata: { table: payload.table, action: payload.action },
    });
    return NextResponse.json({ data: null, error: { message: denied } }, { status: 403 });
  }

  const result = await executeDataRequest(payload);
  return NextResponse.json(result);
}
