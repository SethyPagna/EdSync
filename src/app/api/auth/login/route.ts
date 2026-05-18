import { NextResponse } from "next/server";
import { d1Query } from "@/lib/db/d1";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, setActiveTenantCookie, setSessionCookies, type SessionUser } from "@/lib/auth/session";
import { normalizeOrganizationCode } from "@/lib/auth/organization-code";
import { enforceRateLimit, logSecurityEvent } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
    account_type?: "individual" | "organization";
    organization_code?: string;
  } | null;

  if (!body) {
    return NextResponse.json({
      data: { user: null, session: null },
      error: { message: "Invalid login request.", status: 400 },
    }, { status: 400 });
  }

  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json({
      data: { user: null, session: null },
      error: { message: "Email and password are required.", status: 400 },
    });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const accountType = body.account_type === "organization" ? "organization" : "individual";
  const organizationCode = normalizeOrganizationCode(body.organization_code);
  const rate = await enforceRateLimit({
    request,
    scope: "auth_login",
    limit: 8,
    windowSeconds: 300,
    subject: normalizedEmail,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      {
        data: { user: null, session: null },
        error: { message: "Too many login attempts. Try again shortly.", status: 429 },
      },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    );
  }

  const rows = await d1Query<{
    id: string;
    email: string;
    password_hash: string;
    role: "teacher" | "student";
    is_admin: number | null;
    full_name: string | null;
  }>(
    `SELECT u.id, u.email, u.password_hash, p.role, p.full_name,
            CASE WHEN au.user_id IS NULL THEN 0 ELSE 1 END AS is_admin
       FROM auth_users u
       JOIN profiles p ON p.id = u.id
       LEFT JOIN admin_users au ON au.user_id = u.id
      WHERE lower(u.email) = lower(?)
      LIMIT 1`,
    [normalizedEmail],
  );

  const account = rows[0];
  if (!account || !(await verifyPassword(password, account.password_hash))) {
    await logSecurityEvent({
      request,
      eventType: "login_failed",
      severity: "warning",
      subject: normalizedEmail,
      message: "Invalid login credentials.",
    });
    return NextResponse.json({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials.", status: 401 },
    });
  }

  let tenantContext: { id: string; slug: string; name: string } | null = null;
  if (accountType === "organization") {
    if (!organizationCode) {
      return NextResponse.json({
        data: { user: null, session: null },
        error: { message: "Organization code is required.", status: 400 },
      }, { status: 400 });
    }

    const [membership] = await d1Query<{ id: string; slug: string; name: string }>(
      `SELECT t.id, t.slug, t.name
         FROM tenants t
         JOIN tenant_memberships tm ON tm.tenant_id = t.id
        WHERE lower(t.slug) = lower(?)
          AND tm.user_id = ?
          AND tm.status = 'active'
          AND t.status = 'active'
        LIMIT 1`,
      [organizationCode, account.id],
    );

    if (!membership && !account.is_admin) {
      await logSecurityEvent({
        request,
        eventType: "organization_login_denied",
        severity: "warning",
        subject: normalizedEmail,
        message: "User attempted organization login without active membership.",
      });
      return NextResponse.json({
        data: { user: null, session: null },
        error: { message: "You do not have active access to this organization.", status: 403 },
      }, { status: 403 });
    }

    tenantContext = membership ?? null;
  }

  const user: SessionUser = {
    id: account.id,
    email: account.email,
    user_metadata: {
      role: account.is_admin ? "admin" : account.role,
      full_name: account.full_name,
      tenant_slug: tenantContext?.slug,
      tenant_name: tenantContext?.name,
    },
  };
  const session = await createSession(user);
  const response = NextResponse.json({
    data: { user, session: { expires_at: session.expires.toISOString() } },
    error: null,
  });

  setSessionCookies(response, session.token, user.user_metadata.role, session.expires);
  setActiveTenantCookie(response, tenantContext?.id, session.expires);
  return response;
}
