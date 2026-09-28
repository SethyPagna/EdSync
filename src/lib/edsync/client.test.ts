import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/edsync/client";

describe("EdSync client auth validation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not call login API when account type is missing", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const edsync = createClient();

    const response = await edsync.auth.signInWithPassword({
      email: "teacher@example.com",
      password: "password123",
      account_type: undefined as never,
    });

    expect(response.error?.status).toBe(400);
    expect(response.error?.message).toContain("individual or organization");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not call login API when email is malformed", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const edsync = createClient();

    const response = await edsync.auth.signInWithPassword({
      email: "bad",
      password: "password123",
      account_type: "individual",
    });

    expect(response.error?.status).toBe(400);
    expect(response.error?.message).toBe("Email must be a valid email address.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not call login API when password is too long", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const edsync = createClient();

    const response = await edsync.auth.signInWithPassword({
      email: "teacher@example.com",
      password: "x".repeat(257),
      account_type: "individual",
    });

    expect(response.error?.status).toBe(400);
    expect(response.error?.message).toBe("Password must be 256 characters or fewer.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not call login API when organization code is missing", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const edsync = createClient();

    const response = await edsync.auth.signInWithPassword({
      email: "teacher@example.com",
      password: "password123",
      account_type: "organization",
    });

    expect(response.error?.status).toBe(400);
    expect(response.error?.message).toBe("Organization code is required.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not call login API when organization code is too long before formatting", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const edsync = createClient();

    const response = await edsync.auth.signInWithPassword({
      email: "teacher@example.com",
      password: "password123",
      account_type: "organization",
      organization_code: " ".repeat(161),
    });

    expect(response.error?.status).toBe(400);
    expect(response.error?.message).toBe("Organization code must be 160 characters or fewer before formatting.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not call signup API when organization mode is missing", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const edsync = createClient();

    const response = await edsync.auth.signUp({
      email: "student@example.com",
      password: "password123",
      options: {
        data: {
          role: "student",
          account_type: "organization",
        },
      },
    });

    expect(response.error?.status).toBe(400);
    expect(response.error?.message).toContain("join or create");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not call signup API when organization join code is missing", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const edsync = createClient();

    const response = await edsync.auth.signUp({
      email: "student@example.com",
      password: "password123",
      options: {
        data: {
          role: "student",
          account_type: "organization",
          organization_mode: "join",
        },
      },
    });

    expect(response.error?.status).toBe(400);
    expect(response.error?.message).toBe("Organization code is required.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not call signup API when organization name is missing for create mode", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const edsync = createClient();

    const response = await edsync.auth.signUp({
      email: "teacher@example.com",
      password: "password123",
      options: {
        data: {
          role: "teacher",
          account_type: "organization",
          organization_mode: "create",
          organization_name: "   ",
        },
      },
    });

    expect(response.error?.status).toBe(400);
    expect(response.error?.message).toBe("Organization name is required.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not call signup API when organization name is too long for create mode", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const edsync = createClient();

    const response = await edsync.auth.signUp({
      email: "teacher@example.com",
      password: "password123",
      options: {
        data: {
          role: "teacher",
          account_type: "organization",
          organization_mode: "create",
          organization_name: "x".repeat(121),
        },
      },
    });

    expect(response.error?.status).toBe(400);
    expect(response.error?.message).toBe("Organization name must be 120 characters or fewer.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not call signup API when email is malformed", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const edsync = createClient();

    const response = await edsync.auth.signUp({
      email: "bad",
      password: "password123",
      options: {
        data: {
          role: "student",
          account_type: "individual",
        },
      },
    });

    expect(response.error?.status).toBe(400);
    expect(response.error?.message).toBe("Email must be a valid email address.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not call signup API when password is too short", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const edsync = createClient();

    const response = await edsync.auth.signUp({
      email: "student@example.com",
      password: "short",
      options: {
        data: {
          role: "student",
          account_type: "individual",
        },
      },
    });

    expect(response.error?.status).toBe(400);
    expect(response.error?.message).toBe("Password must be at least 8 characters.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not call signup API when full name is too long", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const edsync = createClient();

    const response = await edsync.auth.signUp({
      email: "student@example.com",
      password: "password123",
      options: {
        data: {
          full_name: "x".repeat(121),
          role: "student",
          account_type: "individual",
        },
      },
    });

    expect(response.error?.status).toBe(400);
    expect(response.error?.message).toBe("Full name must be 120 characters or fewer.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not call signup API when full name has multiple lines", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const edsync = createClient();

    const response = await edsync.auth.signUp({
      email: "student@example.com",
      password: "password123",
      options: {
        data: {
          full_name: "Mina\nBcc: other@example.com",
          role: "student",
          account_type: "individual",
        },
      },
    });

    expect(response.error?.status).toBe(400);
    expect(response.error?.message).toBe("Full name must be a single line.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("handles empty login responses without throwing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 200 }));
    const edsync = createClient();

    const response = await edsync.auth.signInWithPassword({
      email: "student@example.com",
      password: "password123",
      account_type: "individual",
    });

    expect(response.data.user).toBeNull();
    expect(response.error?.message).toBe("Request is unavailable. Try again shortly.");
  });

  it("handles empty data responses without throwing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 200 }));
    const edsync = createClient();

    const response = await edsync.from("classes").select("*");

    expect(response.data).toBeNull();
    expect(response.error).toBeNull();
  });
});

describe("EdSync client data requests", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  function mockFetch(...bodies: [unknown, number?][]) {
    const spy = vi.spyOn(globalThis, "fetch");
    for (const [body, status] of bodies) spy.mockImplementationOnce(async () => json(body, status));
    return spy;
  }

  function sentBody(spy: { mock: { calls: unknown[][] } }, call = -1) {
    const init = spy.mock.calls.at(call)?.[1] as RequestInit | undefined;
    return JSON.parse(String(init?.body));
  }

  it("resolves network failures to { data: null, error } instead of throwing", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    const edsync = createClient();
    const networkError = { message: "Network error. Check your connection and try again.", status: 0 };

    await expect(edsync.from("classes").select("*")).resolves.toEqual({ data: null, error: networkError });
    await expect(edsync.from("profiles").update({ full_name: "A" }).eq("id", "u1")).resolves.toEqual({ data: null, error: networkError });

    const upload = await edsync.storage.from("avatars").upload("u1/a.png", new File(["x"], "a.png"));
    expect(upload).toEqual({ data: null, error: networkError });

    const login = await edsync.auth.signInWithPassword({ email: "student@example.com", password: "password123", account_type: "individual" });
    expect(login).toEqual({ data: { user: null, session: null }, error: networkError });
  });

  it("normalizes string errors and non-JSON failures to { message, status }", async () => {
    mockFetch([{ data: null, error: "role cannot be changed." }, 403]);
    const edsync = createClient();
    const denied = await edsync.from("profiles").update({ role: "teacher" }).eq("id", "u1");
    expect(denied.error).toEqual({ message: "role cannot be changed.", status: 403 });

    vi.spyOn(globalThis, "fetch").mockImplementationOnce(async () => new Response("<html>Bad gateway</html>", { status: 502 }));
    const gateway = await edsync.from("classes").select("*");
    expect(gateway).toEqual({ data: null, error: { message: "Request returned an invalid response.", status: 502 } });
  });

  it("sends is() and not(is) as null-aware filters", async () => {
    const spy = mockFetch([{ data: null, error: null }], [{ data: [], error: null }]);
    const edsync = createClient();

    await edsync.from("quiz_questions").delete().eq("lesson_id", "l1").is("section_id", null);
    expect(sentBody(spy, 0)).toMatchObject({
      action: "delete",
      filters: [
        { op: "eq", column: "lesson_id", value: "l1" },
        { op: "is", column: "section_id", value: null },
      ],
    });

    await edsync.from("student_progress").select("score").in("lesson_id", ["l1"]).not("score", "is", null);
    expect(sentBody(spy).filters).toEqual([
      { op: "in", column: "lesson_id", value: ["l1"] },
      { op: "is_not", column: "score", value: null },
    ]);
  });

  it("rejects unsupported filters without calling the API", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const edsync = createClient();

    const like = await edsync.from("lessons").select("*").not("title", "like", "%a%");
    expect(like).toEqual({ data: null, error: { message: 'not("like") filters are not supported.', status: 400 } });

    const isText = await edsync.from("lessons").select("*").is("status", "draft");
    expect(isText.error?.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });

  it("keeps update().select() an update and resolves with the changed rows", async () => {
    const spy = mockFetch([{ data: [{ id: "g1", is_complete: true }], error: null }]);
    const result = await createClient().from("learning_goals").update({ is_complete: true }).eq("id", "g1").select();

    expect(sentBody(spy)).toMatchObject({ table: "learning_goals", action: "update", values: { is_complete: true }, columns: "*" });
    expect(result).toEqual({ data: [{ id: "g1", is_complete: true }], error: null });
  });

  it("sends the looked-up join code when enrolling", async () => {
    const spy = mockFetch([{ data: { id: "class-9", name: "Art" }, error: null }], [{ data: [{ id: "e1" }], error: null }]);
    const edsync = createClient();

    const { data: classItem } = await edsync.from("classes").select("id, name").eq("join_code", "ABCD1234").maybeSingle();
    await edsync
      .from("class_enrollments")
      .upsert({ class_id: classItem.id, student_id: "s1", is_active: true }, { onConflict: "class_id,student_id" });

    expect(sentBody(spy)).toMatchObject({
      table: "class_enrollments",
      action: "upsert",
      onConflict: "class_id,student_id",
      values: { class_id: "class-9", student_id: "s1", is_active: true, join_code: "ABCD1234" },
    });
  });

  it("warns in development when a mutation is built but never awaited", () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    void createClient().from("profiles").update({ preferences: { theme: "dark" } }).eq("id", "u1");
    vi.runAllTimers();

    expect(warn).toHaveBeenCalledWith('EdSync: update on "profiles" was never awaited, so it did not run.');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
