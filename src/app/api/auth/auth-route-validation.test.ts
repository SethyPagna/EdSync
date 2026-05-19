import { describe, expect, it } from "vitest";
import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as signupPost } from "@/app/api/auth/signup/route";

function jsonRequest(path: string, body: unknown) {
  return new Request(`https://edsync.test${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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
    expect(payload.error.message).toBe("A valid email and password of at least 8 characters are required.");
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
