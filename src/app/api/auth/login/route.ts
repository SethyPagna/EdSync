import { NextResponse } from "next/server";
import { d1Query } from "@/lib/db/d1";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, setSessionCookies, type SessionUser } from "@/lib/auth/session";

export async function POST(request: Request) {
  const { email, password } = (await request.json()) as {
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    return NextResponse.json({
      data: { user: null, session: null },
      error: { message: "Email and password are required.", status: 400 },
    });
  }

  const rows = await d1Query<{
    id: string;
    email: string;
    password_hash: string;
    role: "teacher" | "student";
    full_name: string | null;
  }>(
    `SELECT u.id, u.email, u.password_hash, p.role, p.full_name
       FROM auth_users u
       JOIN profiles p ON p.id = u.id
      WHERE lower(u.email) = lower(?)
      LIMIT 1`,
    [email.trim()],
  );

  const account = rows[0];
  if (!account || !(await verifyPassword(password, account.password_hash))) {
    return NextResponse.json({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials.", status: 401 },
    });
  }

  const user: SessionUser = {
    id: account.id,
    email: account.email,
    user_metadata: { role: account.role, full_name: account.full_name },
  };
  const session = await createSession(user);
  const response = NextResponse.json({
    data: { user, session: { expires_at: session.expires.toISOString() } },
    error: null,
  });

  setSessionCookies(response, session.token, account.role, session.expires);
  return response;
}
