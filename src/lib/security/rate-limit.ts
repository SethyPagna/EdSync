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

// Forwarded headers are client-controlled unless a known proxy sets them, so they are opt-in.
export function getClientIp(request: Request) {
  const cloudflareIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cloudflareIp) return cloudflareIp;
  if (process.env.TRUST_PROXY_HEADERS !== "true") return null;
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return forwarded?.at(-1) ?? null;
}

export function rateLimitKey(request: Request, subject?: string | null) {
  if (subject) return hashValue(`subject:${subject}`);
  const ip = getClientIp(request);
  return ip ? hashValue(`ip:${ip}`) : null;
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

/**
 * Counts one request against `scope`. With a subject (or userId) the bucket is that subject on
 * any IP; without one it is the client IP, and requests with no trustworthy IP are not counted.
 */
export async function enforceRateLimit(options: RateLimitOptions) {
  const subject = options.subject ?? options.userId ?? null;
  const subjectHash = rateLimitKey(options.request, subject);
  if (!subjectHash) return { allowed: true, retryAfter: 0 };

  const now = Date.now();
  const windowMs = options.windowSeconds * 1000;
  const windowStartMs = Math.floor(now / windowMs) * windowMs;
  const windowStart = new Date(windowStartMs).toISOString();

  const [row] = await d1Query<{ count: number }>(
    `INSERT INTO rate_limits (id, scope, subject_hash, window_start, count, updated_at)
     VALUES (?, ?, ?, ?, 1, datetime('now'))
     ON CONFLICT(scope, subject_hash) DO UPDATE SET
       count = CASE WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.count + 1 ELSE 1 END,
       window_start = excluded.window_start,
       updated_at = datetime('now')
     RETURNING count`,
    [`${options.scope}:${subjectHash}`, options.scope, subjectHash, windowStart],
  );
  const count = Number(row?.count ?? 1);

  if (count > options.limit) {
    await logSecurityEvent({
      request: options.request,
      userId: options.userId,
      eventType: "rate_limit_exceeded",
      severity: "warning",
      subject,
      message: `Rate limit exceeded for ${options.scope}.`,
      metadata: {
        scope: options.scope,
        limit: options.limit,
        windowSeconds: options.windowSeconds,
        count,
      },
    });
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((windowStartMs + windowMs - now) / 1000)),
    };
  }

  return { allowed: true, retryAfter: 0 };
}
