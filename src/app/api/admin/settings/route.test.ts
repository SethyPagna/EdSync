// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { d1Query } from "@/lib/db/d1";
import { GET, PATCH, POST } from "./route";

const state = vi.hoisted(() => ({
  flags: new Map<string, { id: string; flag_key: string; label: string; description: string; enabled: number; audience: string }>(),
}));

vi.mock("@/lib/admin", () => ({
  requireAdmin: vi.fn(async () => ({ user: { id: "admin-1" } })),
  auditAdminAction: vi.fn(async () => undefined),
}));
vi.mock("@/lib/db/d1", () => ({ d1Query: vi.fn(async (sql: string, params: unknown[] = []) => {
  if (sql.includes("INSERT OR IGNORE INTO feature_flags")) {
    const [id, key, label, description] = params as string[];
    if (!state.flags.has(key)) state.flags.set(key, { id, flag_key: key, label, description, enabled: 1, audience: "all" });
    return [];
  }
  if (sql.includes("SELECT * FROM feature_flags")) return [...state.flags.values()];
  if (sql.includes("SELECT flag_key FROM feature_flags")) return [...state.flags.values()].filter((row) => row.id === params[0]);
  if (sql.includes("UPDATE feature_flags")) {
    const row = state.flags.get(String(params[1]));
    if (row) row.enabled = Number(params[0]);
  }
  if (sql.includes("DELETE FROM feature_flags")) {
    for (const row of state.flags.values()) if (row.id === params[0]) state.flags.delete(row.flag_key);
  }
  return [];
}) }));

function jsonRequest(method: string, body: unknown) {
  return new Request("http://localhost/api/admin/settings", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  state.flags.clear();
  vi.mocked(d1Query).mockClear();
});

describe("admin platform flags", () => {
  it("labels connected controls as platform-wide and marks legacy keys disconnected", async () => {
    state.flags.set("obsolete", { id: "old-1", flag_key: "obsolete", label: "Old", description: "Unused", enabled: 1, audience: "student" });
    const response = await GET();
    const payload = await response.json();
    expect(payload.data.scope).toBe("platform");
    expect(payload.data.flags.find((flag: { flag_key: string }) => flag.flag_key === "work_items")).toMatchObject({ connected: true, audience: "all", label: "Assignments" });
    expect(payload.data.flags.find((flag: { flag_key: string }) => flag.flag_key === "obsolete")).toMatchObject({ connected: false });
  });

  it("can disable a connected feature but cannot create a fake switch", async () => {
    expect((await PATCH(jsonRequest("PATCH", { flagKey: "work_items", enabled: false }))).status).toBe(200);
    expect(state.flags.get("work_items")?.enabled).toBe(0);
    expect((await PATCH(jsonRequest("PATCH", { flagKey: "invented", enabled: false }))).status).toBe(400);
    expect((await POST(jsonRequest("POST", { action: "create_flag", id: "custom" }))).status).toBe(400);
  });

  it("protects connected flags from deletion while allowing legacy cleanup", async () => {
    await GET();
    const workId = state.flags.get("work_items")?.id;
    expect((await POST(jsonRequest("POST", { action: "delete_flag", id: workId }))).status).toBe(400);
    state.flags.set("obsolete", { id: "old-1", flag_key: "obsolete", label: "Old", description: "Unused", enabled: 1, audience: "all" });
    expect((await POST(jsonRequest("POST", { action: "delete_flag", id: "old-1" }))).status).toBe(200);
    expect(state.flags.has("obsolete")).toBe(false);
  });
});
