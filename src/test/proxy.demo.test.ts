import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";

function request(hostname: string, path: string, method: string) {
  return new NextRequest(`https://${hostname}${path}`, { method });
}

afterEach(() => vi.unstubAllEnvs());

describe("public demo write guard", () => {
  it("leaves production behavior unchanged when demo mode is off", () => {
    vi.stubEnv("EDSYNC_DEMO_MODE", undefined);
    vi.stubEnv("EDSYNC_DEMO_HOSTNAME", "edsync-demo.learn-app.workers.dev");

    expect(proxy(request("edsync.learn-app.workers.dev", "/api/lessons", "POST")).status).toBe(200);
  });

  it("allows demo sessions, logout, and the guarded data-query route only on the exact host", () => {
    vi.stubEnv("EDSYNC_DEMO_MODE", "1");
    vi.stubEnv("EDSYNC_DEMO_HOSTNAME", "edsync-demo.learn-app.workers.dev");

    expect(proxy(request("edsync-demo.learn-app.workers.dev", "/api/demo/session", "POST")).status).toBe(200);
    expect(proxy(request("edsync-demo.learn-app.workers.dev", "/api/auth/logout", "POST")).status).toBe(200);
    expect(proxy(request("edsync-demo.learn-app.workers.dev", "/api/data", "POST")).status).toBe(200);
    expect(proxy(request("edsync-demo.learn-app.workers.dev", "/api/lessons", "GET")).status).toBe(200);
    expect(proxy(request("preview.learn-app.workers.dev", "/api/demo/session", "POST")).status).toBe(403);
    expect(proxy(request("preview.learn-app.workers.dev", "/api/data", "POST")).status).toBe(403);
    expect(proxy(request("edsync-demo.learn-app.workers.dev.attacker.test", "/api/demo/session", "POST")).status).toBe(403);
    expect(proxy(new NextRequest(`https://edsync-demo.learn-app.workers.dev/api/demo/session`, {
      method: "POST",
      headers: { Host: "attacker.test" },
    })).status).toBe(403);
  });

  it("blocks API writes and page server actions in demo mode", () => {
    vi.stubEnv("EDSYNC_DEMO_MODE", "1");
    vi.stubEnv("EDSYNC_DEMO_HOSTNAME", "edsync-demo.learn-app.workers.dev");

    for (const [path, method] of [
      ["/api/lessons", "POST"],
      ["/api/storage/upload", "PUT"],
      ["/api/catalog/course.png", "DELETE"],
      ["/teacher/lessons", "POST"],
      ["/student/dashboard", "POST"],
    ]) {
      const response = proxy(request("edsync-demo.learn-app.workers.dev", path, method));
      expect(response.status, `${method} ${path}`).toBe(403);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
  });
});
