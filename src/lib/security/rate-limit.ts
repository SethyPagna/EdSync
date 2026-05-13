import { createHash } from "node:crypto";
import { d1Query } from "@/lib/db/d1";

type RateLimitOptions = {
  request: Request;
  scope: string;
  limit: number;
  windowSeconds: number;
  userId?: string | null;
  subject?: string | null;
};

type SecurityEventInput = {
  request?: Request;
  userId?: string | null;
  eventType: string;
  severity?: "info" | "warning" | "critical";
  subject?: string | null;
  message: string;
  metadata?: Record<string, unknown>;
};

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    request.headers.get("cf-connecting-ip") ||
    forwarded ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function getClientFingerprint(request: Request, subject?: string | null) {
  const userAgent = request.headers.get("user-agent") || "unknown-agent";
  return hashValue(`${getClientIp(request)}:${userAgent}:${subject || ""}`);
}

export async function logSecurityEvent(input: SecurityEventInput) {
  const ip = input.request ? getClientIp(input.request) : null;
  const userAgent = input.request?.headers.get("user-agent")?.slice(0, 240) ?? null;
  const url = input.request ? new URL(input.request.url) : null;

  await d1Query(
    `INSERT INTO security_events (
       id, user_id, event_type, severity, subject_hash, ip_hash,
       user_agent, path, message, metadata, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      crypto.randomUUID(),
      input.userId ?? null,
      input.eventType,
      input.severity ?? "info",
      input.subject ? hashValue(input.subject) : null,
      ip ? hashValue(ip) : null,
      userAgent,
      url?.pathname ?? null,
      input.message,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}

export async function enforceRateLimit(options: RateLimitOptions) {
  const now = Date.now();
  const windowStartMs = Math.floor(now / (options.windowSeconds * 1000)) * options.windowSeconds * 1000;
  const windowStart = new Date(windowStartMs).toISOString();
  const subjectHash = getClientFingerprint(options.request, options.subject ?? options.userId ?? null);
  const id = `${options.scope}:${subjectHash}`;

  const [current] = await d1Query<{ count: number; window_start: string }>(
    "SELECT count, window_start FROM rate_limits WHERE scope = ? AND subject_hash = ? LIMIT 1",
    [options.scope, subjectHash],
  );

  const nextCount = current?.window_start === windowStart ? Number(current.count || 0) + 1 : 1;
  await d1Query(
    `INSERT INTO rate_limits (id, scope, subject_hash, window_start, count, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(scope, subject_hash) DO UPDATE SET
       window_start = excluded.window_start,
       count = excluded.count,
       updated_at = datetime('now')`,
    [id, options.scope, subjectHash, windowStart, nextCount],
  );

  if (nextCount > options.limit) {
    await logSecurityEvent({
      request: options.request,
      userId: options.userId,
      eventType: "rate_limit_exceeded",
      severity: "warning",
      subject: options.subject ?? options.userId ?? null,
      message: `Rate limit exceeded for ${options.scope}.`,
      metadata: {
        scope: options.scope,
        limit: options.limit,
        windowSeconds: options.windowSeconds,
        count: nextCount,
      },
    });
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((windowStartMs + options.windowSeconds * 1000 - now) / 1000)),
    };
  }

  return { allowed: true, retryAfter: 0 };
}
