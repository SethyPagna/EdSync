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
});
