// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { aiGatewayChat } from "@/lib/ai/gateway";
import { generateAIJson, parseJsonResponse } from "./chat";

vi.mock("@/lib/ai/gateway", () => ({ aiGatewayChat: vi.fn() }));

const request = { userId: "user-1", feature: "outline", messages: [{ role: "user" as const, content: "Give JSON" }] };
const guard = (value: unknown): value is { title: string } => !!value && typeof value === "object" && typeof (value as { title?: unknown }).title === "string";

describe("AI JSON", () => {
  beforeEach(() => vi.mocked(aiGatewayChat).mockReset());

  it("parses top-level arrays and fenced objects", () => {
    expect(parseJsonResponse<string[]>("Answer: [\"a\", \"b\"]")).toEqual(["a", "b"]);
    expect(parseJsonResponse<{ title: string }>("```json\n{\"title\":\"Water\"}\n```")).toEqual({ title: "Water" });
  });

  it("repairs one malformed response and keeps the user id", async () => {
    vi.mocked(aiGatewayChat).mockResolvedValueOnce("{bad json}").mockResolvedValueOnce('{"title":"Water"}');
    await expect(generateAIJson(request, guard)).resolves.toEqual({ title: "Water" });
    expect(aiGatewayChat).toHaveBeenCalledTimes(2);
    expect(vi.mocked(aiGatewayChat).mock.calls[1][0]).toMatchObject({ userId: "user-1", feature: "outline", jsonMode: true });
  });

  it("rejects invalid JSON after one repair", async () => {
    vi.mocked(aiGatewayChat).mockResolvedValueOnce("{}").mockResolvedValueOnce("{}");
    await expect(generateAIJson(request, guard)).rejects.toThrow(/does not match/);
    expect(aiGatewayChat).toHaveBeenCalledTimes(2);
  });
});
