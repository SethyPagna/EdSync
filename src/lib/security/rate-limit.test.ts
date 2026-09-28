import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/lib/db/d1", () => ({ d1Query: mocks.query }));

import { enforceRateLimit, getClientIp, rateLimitKey } from "@/lib/security/rate-limit";

function request(headers: Record<string, string>) {
  return new Request("https://edsync.test/api/auth/login", { method: "POST", headers });
}

describe("rate limit keys", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("keys anonymous requests by Cloudflare IP and ignores the user agent", () => {
    const first = rateLimitKey(request({ "cf-connecting-ip": "203.0.113.9", "user-agent": "curl/8" }));
    const second = rateLimitKey(request({ "cf-connecting-ip": "203.0.113.9", "user-agent": "Mozilla/5.0" }));
    const other = rateLimitKey(request({ "cf-connecting-ip": "203.0.113.10", "user-agent": "curl/8" }));
    expect(first).toBeTruthy();
    expect(first).toBe(second);
    expect(other).not.toBe(first);
  });

  it("ignores spoofable forwarding headers unless proxy headers are trusted", () => {
    const spoofed = request({ "x-forwarded-for": "198.51.100.1", "x-real-ip": "198.51.100.2" });
    expect(getClientIp(spoofed)).toBeNull();
    expect(rateLimitKey(spoofed)).toBeNull();

    vi.stubEnv("TRUST_PROXY_HEADERS", "true");
    expect(getClientIp(request({ "x-forwarded-for": "198.51.100.1, 10.0.0.2" }))).toBe("10.0.0.2");
    expect(getClientIp(request({ "x-real-ip": "198.51.100.2", "x-forwarded-for": "198.51.100.1" }))).toBe("198.51.100.2");
  });

  it("prefers the Cloudflare IP over forwarded headers even when proxies are trusted", () => {
    vi.stubEnv("TRUST_PROXY_HEADERS", "true");
    expect(getClientIp(request({ "cf-connecting-ip": "203.0.113.9", "x-forwarded-for": "198.51.100.1" }))).toBe("203.0.113.9");
  });

  it("keys subject buckets independently of the caller IP", () => {
    const fromOneIp = rateLimitKey(request({ "cf-connecting-ip": "203.0.113.9" }), "teacher@example.com");
    const fromAnotherIp = rateLimitKey(request({ "cf-connecting-ip": "203.0.113.10" }), "teacher@example.com");
    expect(fromOneIp).toBe(fromAnotherIp);
    expect(fromOneIp).not.toBe(rateLimitKey(request({ "cf-connecting-ip": "203.0.113.9" })));
  });
});

describe("enforceRateLimit", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    mocks.query.mockReset();
  });

  it("counts with one atomic upsert", async () => {
    mocks.query.mockResolvedValueOnce([{ count: 3 }]);
    const result = await enforceRateLimit({
      request: request({ "cf-connecting-ip": "203.0.113.9" }),
      scope: "auth_login_ip",
      limit: 5,
      windowSeconds: 60,
    });
    expect(result).toEqual({ allowed: true, retryAfter: 0 });
    expect(mocks.query).toHaveBeenCalledTimes(1);
    const [sql, params] = mocks.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("ON CONFLICT(scope, subject_hash) DO UPDATE");
    expect(sql).toContain("RETURNING count");
    expect(params[1]).toBe("auth_login_ip");
  });

  it("blocks once the returned count passes the limit and logs the event", async () => {
    mocks.query.mockResolvedValueOnce([{ count: 6 }]).mockResolvedValueOnce([]);
    const result = await enforceRateLimit({
      request: request({ "cf-connecting-ip": "203.0.113.9" }),
      scope: "auth_login",
      limit: 5,
      windowSeconds: 60,
      subject: "teacher@example.com",
    });
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
    expect(result.retryAfter).toBeLessThanOrEqual(60);
    expect(String(mocks.query.mock.calls[1]?.[0])).toContain("INSERT INTO security_events");
  });

  it("does not count anonymous requests without a trustworthy IP", async () => {
    const result = await enforceRateLimit({
      request: request({ "x-forwarded-for": "198.51.100.1" }),
      scope: "auth_login_ip",
      limit: 1,
      windowSeconds: 60,
    });
    expect(result).toEqual({ allowed: true, retryAfter: 0 });
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
