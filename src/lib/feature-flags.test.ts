// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { d1Query } from "@/lib/db/d1";
import { isFeatureEnabled, isSupportedFeatureFlag } from "./feature-flags";

vi.mock("@/lib/db/d1", () => ({ d1Query: vi.fn() }));

beforeEach(() => vi.mocked(d1Query).mockReset());

describe("global feature flags", () => {
  it("supports only features with a server-side gate", () => {
    expect(isSupportedFeatureFlag("work_items")).toBe(true);
    expect(isSupportedFeatureFlag("made_up_feature")).toBe(false);
  });

  it("preserves existing behavior when a flag has not been seeded", async () => {
    vi.mocked(d1Query).mockResolvedValueOnce([]);
    expect(await isFeatureEnabled("gradebook")).toBe(true);
    expect(d1Query).toHaveBeenCalledWith(
      "SELECT enabled FROM feature_flags WHERE flag_key = ? LIMIT 1",
      ["gradebook"],
    );
  });

  it("blocks a stored disabled flag and allows an enabled flag", async () => {
    vi.mocked(d1Query).mockResolvedValueOnce([{ enabled: 0 }]).mockResolvedValueOnce([{ enabled: 1 }]);
    expect(await isFeatureEnabled("work_items")).toBe(false);
    expect(await isFeatureEnabled("work_items")).toBe(true);
  });

  it("keeps core features available if the flag table cannot be read", async () => {
    vi.mocked(d1Query).mockRejectedValueOnce(new Error("table not installed"));
    expect(await isFeatureEnabled("student_notes")).toBe(true);
  });
});
