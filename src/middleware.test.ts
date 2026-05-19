import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { ROLE_COOKIE, SESSION_COOKIE } from "@/lib/auth/constants";
import { middleware } from "./middleware";

function makeRequest(path: string, cookie = "") {
  return new NextRequest(new URL(path, "https://edsync.test"), {
    headers: cookie ? { cookie } : undefined,
  });
}

function redirectPath(response: Response) {
  const location = response.headers.get("location");
  return location ? `${new URL(location).pathname}${new URL(location).search}` : null;
}

describe("middleware", () => {
  it("redirects protected routes to login when no session exists", () => {
    const response = middleware(makeRequest("/studio"));
    expect(response.status).toBe(307);
    expect(redirectPath(response)).toBe("/auth/login?next=%2Fstudio");
  });

  it("does not send malformed role sessions to the student portal", () => {
    const cookie = `${SESSION_COOKIE}=session-1; ${ROLE_COOKIE}=bad-role`;
    const response = middleware(makeRequest("/admin/dashboard?tab=ai", cookie));
    expect(response.status).toBe(307);
    expect(redirectPath(response)).toBe("/auth/login?next=%2Fadmin%2Fdashboard%3Ftab%3Dai");
  });

  it("routes known non-admin roles away from admin pages", () => {
    const cookie = `${SESSION_COOKIE}=session-1; ${ROLE_COOKIE}=teacher`;
    const response = middleware(makeRequest("/admin/dashboard", cookie));
    expect(response.status).toBe(307);
    expect(redirectPath(response)).toBe("/teacher/dashboard");
  });
});
