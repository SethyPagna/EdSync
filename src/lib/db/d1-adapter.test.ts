import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const context = vi.hoisted(() => vi.fn());
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: context }));
import { getD1QueryAdapter } from "./d1-adapter";

describe("D1 atomic batches", () => {
  beforeEach(() => {
    context.mockReset().mockImplementation(() => {
      throw new Error("outside Workers");
    });
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "test-account");
    vi.stubEnv("CLOUDFLARE_D1_DATABASE_ID", "test-database");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "test-token");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("sends related REST changes as a single batch and normalizes parameters", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          result: [{ success: true }, { success: true }],
        }),
      });
    vi.stubGlobal("fetch", fetcher);
    await getD1QueryAdapter().batch([
      { sql: "INSERT portal", params: [true, undefined] },
      { sql: "INSERT domain", params: [{ pending: true }] },
    ]);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
      batch: [
        { sql: "INSERT portal", params: [1, null] },
        { sql: "INSERT domain", params: ['{"pending":true}'] },
      ],
    });
  });

  it("propagates an individual statement failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          json: async () => ({
            success: true,
            result: [{ success: false, error: "constraint failed" }],
          }),
        }),
    );
    await expect(
      getD1QueryAdapter().batch([{ sql: "INSERT portal" }]),
    ).rejects.toThrow("constraint failed");
  });

  it("uses the Worker binding transaction for every statement", async () => {
    const bound = { all: vi.fn() };
    const bind = vi.fn().mockReturnValue(bound);
    const batch = vi
      .fn()
      .mockResolvedValue([{ success: true }, { success: true }]);
    context.mockReturnValue({
      env: { EDSYNC_DB: { prepare: vi.fn().mockReturnValue({ bind }), batch } },
    });
    await getD1QueryAdapter().batch([
      { sql: "INSERT portal", params: [true] },
      { sql: "INSERT domain" },
    ]);
    expect(batch).toHaveBeenCalledWith([bound, bound]);
    expect(bound.all).not.toHaveBeenCalled();
    expect(bind).toHaveBeenCalledWith(1);
  });
});
