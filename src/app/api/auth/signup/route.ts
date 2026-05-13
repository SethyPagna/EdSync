import { NextResponse } from "next/server";
import { d1Query } from "@/lib/db/d1";
import { hashPassword } from "@/lib/auth/password";
import { createSession, setSessionCookies, type SessionUser } from "@/lib/auth/session";
import { enforceRateLimit, logSecurityEvent } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const { email, password, options } = (await request.json()) as {
    email?: string;
    password?: string;
    options?: { data?: { full_name?: string; role?: "teacher" | "student" } };
  };

  const normalizedEmail = email?.trim().toLowerCase();
  const role = options?.data?.role === "teacher" ? "teacher" : "student";
  const fullName = options?.data?.full_name?.trim() || null;

  if (!normalizedEmail || !password || password.length < 8) {
    return NextResponse.json({
      data: { user: null, session: null },
      error: { message: "A valid email and password of at least 8 characters are required.", status: 400 },
    });
  }

  const rate = await enforceRateLimit({
    request,
    scope: "auth_signup",
    limit: 5,
    windowSeconds: 900,
    subject: normalizedEmail,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      {
        data: { user: null, session: null },
        error: { message: "Too many signup attempts. Try again shortly.", status: 429 },
      },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    );
  }

  const existing = await d1Query<{ id: string }>("SELECT id FROM auth_users WHERE lower(email) = lower(?) LIMIT 1", [
    normalizedEmail,
  ]);

  if (existing[0]) {
    await logSecurityEvent({
      request,
      eventType: "signup_duplicate",
      severity: "info",
      subject: normalizedEmail,
      message: "Signup attempted for an existing email.",
    });
    return NextResponse.json({
      data: { user: null, session: null },
      error: { message: "This email is already registered. Try signing in.", status: 409 },
    });
  }

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  await d1Query(
    `INSERT INTO auth_users (id, email, password_hash, created_at, updated_at)
     VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
    [id, normalizedEmail, passwordHash],
  );
  await d1Query(
    `INSERT INTO profiles (
       id, email, full_name, role, subjects, interests, preferences, achievements,
       total_xp, streak_days, last_active_at, created_at, updated_at
     ) VALUES (?, ?, ?, ?, '[]', '[]', '{"theme":"light","text_size":"medium"}', '[]', 0, 0, datetime('now'), datetime('now'), datetime('now'))`,
    [id, normalizedEmail, fullName, role],
  );

  const user: SessionUser = {
    id,
    email: normalizedEmail,
    user_metadata: { role, full_name: fullName },
  };
  const session = await createSession(user);
  const response = NextResponse.json({
    data: { user, session: { expires_at: session.expires.toISOString() } },
    error: null,
  });

  setSessionCookies(response, session.token, role, session.expires);
  return response;
}
