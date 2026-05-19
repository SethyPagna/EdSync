import { NextResponse } from "next/server";
import { d1Query } from "@/lib/db/d1";
import { hashPassword } from "@/lib/auth/password";
import { createSession, setActiveTenantCookie, setSessionCookies, type SessionUser } from "@/lib/auth/session";
import { createOrganizationSlug, validateOrganizationCode } from "@/lib/auth/organization-code";
import { normalizeAccountType, normalizeOrganizationMode, normalizeSignupRole } from "@/lib/auth/roles";
import { enforceRateLimit, logSecurityEvent } from "@/lib/security/rate-limit";

function organizationSlug(name: string) {
  return createOrganizationSlug(name, crypto.randomUUID().slice(0, 8));
}

function roleProfileFor(input: { role: "teacher" | "student"; accountType: "individual" | "organization"; organizationMode?: "join" | "create" }) {
  if (input.role === "student") return "role_learner";
  if (input.accountType === "individual") return "role_solo_teacher";
  return input.organizationMode === "join" ? "role_instructor" : "role_portal_admin";
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
    options?: {
      data?: {
        full_name?: string;
        role?: "teacher" | "student";
        account_type?: "individual" | "organization";
        organization_mode?: "join" | "create";
        organization_name?: string;
        organization_code?: string;
      };
    };
  } | null;

  if (!body) {
    return NextResponse.json({
      data: { user: null, session: null },
      error: { message: "Invalid signup request.", status: 400 },
    }, { status: 400 });
  }

  const { email, password, options } = body;

  const normalizedEmail = email?.trim().toLowerCase();
  const role = normalizeSignupRole(options?.data?.role);
  if (!role) {
    return NextResponse.json({
      data: { user: null, session: null },
      error: { message: "Choose teacher or student before creating an account.", status: 400 },
    }, { status: 400 });
  }

  const accountType = normalizeAccountType(options?.data?.account_type);
  if (!accountType) {
    return NextResponse.json({
      data: { user: null, session: null },
      error: { message: "Choose individual or organization before creating an account.", status: 400 },
    }, { status: 400 });
  }

  const organizationMode = accountType === "organization"
    ? normalizeOrganizationMode(options?.data?.organization_mode)
    : null;
  if (accountType === "organization" && !organizationMode) {
    return NextResponse.json({
      data: { user: null, session: null },
      error: { message: "Choose whether to join or create an organization.", status: 400 },
    }, { status: 400 });
  }

  const fullName = options?.data?.full_name?.trim() || null;
  const organizationName = options?.data?.organization_name?.trim() || null;
  let organizationCode: string | null = null;
  if (accountType === "organization" && organizationMode === "join") {
    try {
      organizationCode = validateOrganizationCode(options?.data?.organization_code);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Organization code is invalid.";
      return NextResponse.json({
        data: { user: null, session: null },
        error: { message, status: 400 },
      }, { status: 400 });
    }
  }

  if (!normalizedEmail || !password || password.length < 8) {
    return NextResponse.json({
      data: { user: null, session: null },
      error: { message: "A valid email and password of at least 8 characters are required.", status: 400 },
    }, { status: 400 });
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

  if (accountType === "organization" && organizationMode === "create" && !organizationName) {
    return NextResponse.json({
      data: { user: null, session: null },
      error: { message: "Organization name is required.", status: 400 },
    }, { status: 400 });
  }

  const joinedTenantRows = accountType === "organization" && organizationMode === "join"
    ? await d1Query<{ id: string; name: string }>(
        "SELECT id, name FROM tenants WHERE lower(slug) = lower(?) AND status = 'active' LIMIT 1",
        [organizationCode],
      )
    : [];

  if (accountType === "organization" && organizationMode === "join" && !joinedTenantRows[0]) {
    return NextResponse.json({
      data: { user: null, session: null },
      error: { message: "Organization was not found. Check the code or ask your organization owner.", status: 404 },
    }, { status: 404 });
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
    }, { status: 409 });
  }

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  let tenantContext: { id: string; slug: string; name: string } | null = null;

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

  if (accountType === "organization" && organizationMode === "create" && organizationName) {
    const tenantId = crypto.randomUUID();
    const portalId = crypto.randomUUID();
    const tenantSlug = organizationSlug(organizationName);
    await d1Query(
      `INSERT INTO tenants (id, slug, name, owner_id, plan_tier, isolation_mode, settings, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'solo', 'shared_d1', ?, datetime('now'), datetime('now'))`,
      [
        tenantId,
        tenantSlug,
        organizationName,
        id,
        JSON.stringify({ signup_source: "auth_signup", owner_role: role }),
      ],
    );
    await d1Query(
      `INSERT INTO tenant_portals (id, tenant_id, slug, name, audience, is_default, theme, catalog_settings, created_at, updated_at)
       VALUES (?, ?, 'main', ?, 'internal', 1, '{"theme":"light"}', '{}', datetime('now'), datetime('now'))`,
      [portalId, tenantId, `${organizationName} Portal`],
    );
    await d1Query(
      `INSERT INTO tenant_memberships (id, tenant_id, user_id, role_profile_id, status, permissions, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', '[]', datetime('now'), datetime('now'))`,
      [
        crypto.randomUUID(),
        tenantId,
        id,
        roleProfileFor({ role, accountType, organizationMode: organizationMode ?? undefined }),
      ],
    );
    tenantContext = { id: tenantId, slug: tenantSlug, name: organizationName };
  }

  if (accountType === "organization" && organizationMode === "join" && joinedTenantRows[0]) {
    if (!organizationCode) {
      return NextResponse.json({
        data: { user: null, session: null },
        error: { message: "Organization code is required.", status: 400 },
      }, { status: 400 });
    }
    await d1Query(
      `INSERT INTO tenant_memberships (id, tenant_id, user_id, role_profile_id, status, permissions, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', '[]', datetime('now'), datetime('now'))`,
      [
        crypto.randomUUID(),
        joinedTenantRows[0].id,
        id,
        roleProfileFor({ role, accountType, organizationMode: organizationMode ?? undefined }),
      ],
    );
    tenantContext = {
      id: joinedTenantRows[0].id,
      slug: organizationCode,
      name: joinedTenantRows[0].name,
    };
  }

  const user: SessionUser = {
    id,
    email: normalizedEmail,
    user_metadata: {
      role,
      full_name: fullName,
      tenant_slug: tenantContext?.slug,
      tenant_name: tenantContext?.name,
    },
  };
  const session = await createSession(user);
  const response = NextResponse.json({
    data: { user, session: { expires_at: session.expires.toISOString() } },
    error: null,
  });

  setSessionCookies(response, session.token, role, session.expires);
  setActiveTenantCookie(response, tenantContext?.id, session.expires);
  return response;
}
