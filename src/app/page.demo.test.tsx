import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  host: "edsync-demo.learn-app.workers.dev",
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }),
  session: vi.fn(),
  tenant: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: mocks.host }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: mocks.session }));
vi.mock("@/lib/tenancy", () => ({ resolveTenantContext: mocks.tenant }));
vi.mock("./catalog/page", () => ({ default: () => <div>Sample catalog</div> }));

import RootPage from "./page";

beforeEach(() => {
  vi.stubEnv("EDSYNC_DEMO_MODE", "1");
  vi.stubEnv("EDSYNC_DEMO_HOSTNAME", "edsync-demo.learn-app.workers.dev");
  mocks.host = "edsync-demo.learn-app.workers.dev";
  mocks.redirect.mockClear();
  mocks.session.mockReset().mockResolvedValue(null);
  mocks.tenant.mockReset().mockResolvedValue({
    tenant: { slug: "edsync" },
    portal: { slug: "main", audience: "public" },
  });
});

afterEach(() => vi.unstubAllEnvs());

describe("demo home", () => {
  it("shows the demo catalog chooser at the root despite a public default portal", async () => {
    const result = await RootPage({ searchParams: Promise.resolve({}) });

    expect(result.type).toBeTypeOf("function");
    expect(mocks.tenant).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("keeps the official portal redirect outside the exact demo host", async () => {
    mocks.host = "edsync.learn-app.workers.dev";

    await expect(RootPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirect:/org/main?tenant=edsync");
    expect(mocks.tenant).toHaveBeenCalledOnce();
  });
});
