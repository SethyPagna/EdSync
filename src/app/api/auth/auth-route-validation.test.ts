// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type AccountRow = { id: string; email: string; password_hash: string; role: string; is_admin: number; full_name: string | null };

const db = vi.hoisted(() => ({
  buckets: new Map<string, number>(),
  account: null as AccountRow | null,
  emailTaken: false,
}));

vi.mock("@/lib/db/d1", () => ({
  d1Query: vi.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes("INSERT INTO rate_limits")) {
      const bucket = String(params[0]);
      const count = (db.buckets.get(bucket) ?? 0) + 1;
      db.buckets.set(bucket, count);
      return [{ count }];
    }
    if (sql.includes("SELECT u.id, u.email, u.password_hash")) {
      return db.account && String(params[0]).toLowerCase() === db.account.email ? [db.account] : [];
    }
    if (sql.includes("SELECT id FROM auth_users")) return db.emailTaken ? [{ id: "existing-user" }] : [];
    return [];
  }),
  d1Batch: vi.fn(async () => undefined),
}));

import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as signupPost } from "@/app/api/auth/signup/route";
import { hashPassword } from "@/lib/auth/password";

function jsonRequest(path: string, body: unknown, ip?: string) {
  return new Request(`https://edsync.test${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(ip ? { "cf-connecting-ip": ip } : {}) },
    body: JSON.stringify(body),
  });
}

function bucketKeys(scope: string) {
  return Array.from(db.buckets.keys()).filter((key) => key.startsWith(`${scope}:`));
}

async function readAuthError(response: Response): Promise<{ error: { message: string } }> {
  return response.json() as Promise<{ error: { message: string } }>;
}

describe("auth route validation responses", () => {
  it("returns HTTP 400 when login credentials are incomplete", async () => {
    const response = await loginPost(jsonRequest("/api/auth/login", {
      email: "teacher@example.com",
      account_type: "individual",
    }));
    const payload = await readAuthError(response);

    expect(response.status).toBe(400);
    expect(payload.error.message).toBe("Email and password are required.");
  });

  it("returns HTTP 400 when login email is blank after trimming", async () => {
    const response = await loginPost(jsonRequest("/api/auth/login", {
      email: "   ",
      password: "password123",
      account_type: "individual",
    }));
    const payload = await readAuthError(response);

    expect(response.status).toBe(400);
    expect(payload.error.message).toBe("Email is required.");
  });

  it("returns HTTP 400 when login email is malformed", async () => {
    const response = await loginPost(jsonRequest("/api/auth/login", {
      email: "not-an-email",
      password: "password123",
      account_type: "individual",
    }));
    const payload = await readAuthError(response);

    expect(response.status).toBe(400);
    expect(payload.error.message).toBe("Email must be a valid email address.");
  });

  it("returns HTTP 400 when signup account details are incomplete", async () => {
    const response = await signupPost(jsonRequest("/api/auth/signup", {
      email: "student@example.com",
      password: "short",
      options: {
        data: {
          role: "student",
          account_type: "individual",
        },
      },
    }));
    const payload = await readAuthError(response);

    expect(response.status).toBe(400);
    expect(payload.error.message).toBe("Password must be at least 8 characters.");
  });

  it("returns HTTP 400 when signup email is malformed", async () => {
    const response = await signupPost(jsonRequest("/api/auth/signup", {
      email: "bad",
      password: "password123",
      options: {
        data: {
          role: "student",
          account_type: "individual",
        },
      },
    }));
    const payload = await readAuthError(response);

    expect(response.status).toBe(400);
    expect(payload.error.message).toBe("Email must be a valid email address.");
  });

  it("returns HTTP 400 when login password is too long", async () => {
    const response = await loginPost(jsonRequest("/api/auth/login", {
      email: "teacher@example.com",
      password: "x".repeat(257),
      account_type: "individual",
    }));
    const payload = await readAuthError(response);

    expect(response.status).toBe(400);
    expect(payload.error.message).toBe("Password must be 256 characters or fewer.");
  });

  it("returns HTTP 400 when signup password is too long", async () => {
    const response = await signupPost(jsonRequest("/api/auth/signup", {
      email: "student@example.com",
      password: "x".repeat(257),
      options: {
        data: {
          role: "student",
          account_type: "individual",
        },
      },
    }));
    const payload = await readAuthError(response);

    expect(response.status).toBe(400);
    expect(payload.error.message).toBe("Password must be 256 characters or fewer.");
  });

  it("returns HTTP 400 when signup full name is too long", async () => {
    const response = await signupPost(jsonRequest("/api/auth/signup", {
      email: "student@example.com",
      password: "password123",
      options: {
        data: {
          full_name: "x".repeat(121),
          role: "student",
          account_type: "individual",
        },
      },
    }));
    const payload = await readAuthError(response);

    expect(response.status).toBe(400);
    expect(payload.error.message).toBe("Full name must be 120 characters or fewer.");
  });

  it("returns HTTP 400 when signup full name has multiple lines", async () => {
    const response = await signupPost(jsonRequest("/api/auth/signup", {
      email: "student@example.com",
      password: "password123",
      options: {
        data: {
          full_name: "Mina\nBcc: other@example.com",
          role: "student",
          account_type: "individual",
        },
      },
    }));
    const payload = await readAuthError(response);

    expect(response.status).toBe(400);
    expect(payload.error.message).toBe("Full name must be a single line.");
  });

  it("returns HTTP 400 when organization signup name is too long", async () => {
    const response = await signupPost(jsonRequest("/api/auth/signup", {
      email: "owner@example.com",
      password: "password123",
      options: {
        data: {
          role: "teacher",
          account_type: "organization",
          organization_mode: "create",
          organization_name: "x".repeat(121),
        },
      },
    }));
    const payload = await readAuthError(response);

    expect(response.status).toBe(400);
    expect(payload.error.message).toBe("Organization name must be 120 characters or fewer.");
  });
});

describe("auth rate limits", () => {
  const victimEmail = "teacher@school.test";
  const victimPassword = "Correct-Horse-9!";
  let victimHash = "";

  function login(email: string, password: string, ip: string) {
    return loginPost(jsonRequest("/api/auth/login", { email, password, account_type: "individual" }, ip));
  }

  beforeAll(async () => {
    victimHash = await hashPassword(victimPassword);
  });

  beforeEach(() => {
    db.buckets.clear();
    db.emailTaken = false;
    db.account = { id: "victim", email: victimEmail, password_hash: victimHash, role: "teacher", is_admin: 0, full_name: "Victim" };
  });

  it("does not let failures from other IPs lock the account owner out", async () => {
    expect((await login(victimEmail, victimPassword, "198.51.100.200")).status).toBe(200);
    for (let attempt = 1; attempt <= 8; attempt += 1) {
      expect((await login(victimEmail, `wrong-password-${attempt}A!`, `203.0.113.${attempt}`)).status).toBe(401);
    }
    expect((await login(victimEmail, victimPassword, "198.51.100.200")).status).toBe(200);
  });

  it("still throttles repeated failures for one account from one IP", async () => {
    for (let attempt = 1; attempt <= 8; attempt += 1) {
      expect((await login(victimEmail, `wrong-password-${attempt}A!`, "203.0.113.9")).status).toBe(401);
    }
    const blocked = await login(victimEmail, victimPassword, "203.0.113.9");
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
    expect((await login(victimEmail, victimPassword, "198.51.100.200")).status).toBe(200);
  });

  it("lets a whole school sign in from one shared IP and caps the IP at 1000 per window", async () => {
    for (let student = 1; student <= 150; student += 1) {
      expect((await login(`student${student}@school.test`, "wrong-password-A1!", "192.0.2.10")).status).toBe(401);
    }
    const [ipBucket] = bucketKeys("auth_login_ip");
    expect(ipBucket).toBeDefined();
    db.buckets.set(ipBucket as string, 1000);
    expect((await login("student151@school.test", "wrong-password-A1!", "192.0.2.10")).status).toBe(429);
  });

  it("lets a class sign up together from one shared IP and caps the IP at 200 per window", async () => {
    db.emailTaken = true;
    const signup = (email: string) =>
      signupPost(
        jsonRequest(
          "/api/auth/signup",
          { email, password: "password123", options: { data: { role: "student", account_type: "individual" } } },
          "192.0.2.20",
        ),
      );
    for (let student = 1; student <= 60; student += 1) {
      expect((await signup(`kid${student}@school.test`)).status).toBe(409);
    }
    const [ipBucket] = bucketKeys("auth_signup_ip");
    expect(ipBucket).toBeDefined();
    db.buckets.set(ipBucket as string, 200);
    expect((await signup("kid61@school.test")).status).toBe(429);
  });
});
