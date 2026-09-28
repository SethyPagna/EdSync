import { NextResponse } from "next/server";
import { executeDataRequest } from "@/lib/db/d1";
import { getSessionUser } from "@/lib/auth/session";
import { authorizeDataRequest, parseDataRequest } from "@/lib/security/data-access";
import { enforceRateLimit, logSecurityEvent } from "@/lib/security/rate-limit";

function failure(error: string, status: number, headers?: HeadersInit) {
  return NextResponse.json({ data: null, error }, { status, headers });
}

async function logDenied(request: Request, userId: string, message: string, metadata: Record<string, unknown>) {
  try {
    await logSecurityEvent({ request, userId, eventType: "data_access_denied", severity: "warning", message, metadata });
  } catch {
    // Audit logging must never turn a clean 403 into a 500.
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return failure("Authentication required.", 401);

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return failure("Request body must be valid JSON.", 400);
    }

    const parsed = parseDataRequest(payload);
    if (!parsed.ok) return failure(parsed.error, 400);

    const rate = await enforceRateLimit({
      request,
      scope: `data_${parsed.request.action}`,
      limit: parsed.request.action === "select" ? 180 : 80,
      windowSeconds: 300,
      userId: user.id,
    });
    if (!rate.allowed) {
      return failure("Too many data requests. Try again shortly.", 429, { "Retry-After": String(rate.retryAfter) });
    }

    const metadata = { table: parsed.request.table, action: parsed.request.action };
    const decision = await authorizeDataRequest(user, parsed.request);
    if (!decision.allowed) {
      if (decision.status === 403) await logDenied(request, user.id, decision.error, metadata);
      return failure(decision.error, decision.status);
    }

    const result = await executeDataRequest(decision.request, { scope: decision.scope });
    if (result.error) {
      const status = result.error.status ?? 500;
      if (status === 403) await logDenied(request, user.id, result.error.message, metadata);
      return failure(result.error.message, status);
    }

    return NextResponse.json({ data: result.data, count: result.count ?? null, error: null });
  } catch (error) {
    console.error("EdSync data route failed", error);
    return failure("The data request could not be completed.", 500);
  }
}
