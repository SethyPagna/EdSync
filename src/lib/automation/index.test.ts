import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ context: vi.fn(), query: vi.fn(), send: vi.fn() }));

vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: mocks.context }));
vi.mock("@/lib/db/d1", () => ({ d1Query: mocks.query }));

import { enqueueAutomationJob } from "./index";

beforeEach(() => {
  mocks.context.mockReset().mockReturnValue({ env: { EDSYNC_QUEUE: { send: mocks.send } } });
  mocks.query.mockReset().mockResolvedValue([]);
  mocks.send.mockReset().mockResolvedValue(undefined);
});

describe("enqueueAutomationJob", () => {
  it("persists an EdSync job and sends the same ID and tenant to the bound queue", async () => {
    const id = await enqueueAutomationJob({ tenantId: "tenant-a", jobType: "automation_rule.updated", payload: { tenantId: "spoofed", ruleId: "rule-1" } });

    expect(mocks.query).toHaveBeenCalledOnce();
    expect(mocks.query.mock.calls[0][1]).toEqual([id, "automation_rule.updated", JSON.stringify({ tenantId: "tenant-a", ruleId: "rule-1" })]);
    expect(mocks.send).toHaveBeenCalledWith({ id, job_type: "automation_rule.updated", payload: { tenantId: "tenant-a", ruleId: "rule-1" } });
  });

  it("keeps a failed send queued for the scheduled recovery sweep", async () => {
    mocks.send.mockRejectedValueOnce(new Error("Queue unavailable"));

    const id = await enqueueAutomationJob({ tenantId: "tenant-a", jobType: "ai_provider.updated", payload: { providerId: "provider-1" } });

    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(mocks.query.mock.calls[1][0]).toContain("UPDATE automation_jobs SET last_error");
    expect(mocks.query.mock.calls[1][1]).toEqual(["Queue unavailable", id]);
  });
});
