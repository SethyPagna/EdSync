import { describe, expect, it, vi } from "vitest";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  readJson,
  withRoute,
} from "@/lib/security/http-errors";

function jsonRequest(body: string) {
  return new Request("https://edsync.test/api/example", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

async function run(error: unknown) {
  const handler = withRoute(async () => {
    throw error;
  });
  const response = await handler(jsonRequest("{}"), undefined);
  return { response, payload: (await response.json()) as { data: unknown; error: string } };
}

describe("withRoute", () => {
  it.each([
    [new BadRequestError("Bad title."), 400, "Bad title."],
    [new ForbiddenError("Missing permission: billing.manage"), 403, "Missing permission: billing.manage"],
    [new NotFoundError("Price not found."), 404, "Price not found."],
    [new ConflictError("Already paid."), 409, "Already paid."],
  ])("maps %s to its status", async (error, status, message) => {
    const { response, payload } = await run(error);
    expect(response.status).toBe(status);
    expect(payload).toEqual({ data: null, error: message });
  });

  it("maps rate limit errors to 429 with Retry-After", async () => {
    const { response } = await run(new TooManyRequestsError("Slow down.", 42));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
  });

  it("maps raw JSON syntax errors to 400", async () => {
    const handler = withRoute(async (request: Request) => {
      await request.json();
      return new Response("ok");
    });
    const response = await handler(jsonRequest("{not json"), undefined);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ data: null, error: "Invalid JSON body." });
  });

  it("hides unexpected errors behind a generic 500", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { response, payload } = await run(new Error("D1_ERROR: no such table secrets"));
    expect(response.status).toBe(500);
    expect(payload.error).toBe("Something went wrong.");
    consoleError.mockRestore();
  });

  it("passes successful responses through", async () => {
    const handler = withRoute(async () => new Response("ok", { status: 201 }));
    const response = await handler(jsonRequest("{}"), undefined);
    expect(response.status).toBe(201);
  });
});

describe("readJson", () => {
  it("returns plain JSON objects", async () => {
    await expect(readJson(jsonRequest('{"title":"Lesson"}'))).resolves.toEqual({ title: "Lesson" });
  });

  it.each(["{broken", "null", "[1,2]", '"text"'])("rejects %s as a bad request", async (body) => {
    await expect(readJson(jsonRequest(body))).rejects.toBeInstanceOf(BadRequestError);
  });
});
