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
});
