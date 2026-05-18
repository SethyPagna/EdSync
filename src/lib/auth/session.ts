import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { d1Query } from "@/lib/db/d1";
import type { Profile } from "@/types";
import type { UserRole } from "@/types";
import { ACTIVE_TENANT_COOKIE, ROLE_COOKIE, SESSION_COOKIE } from "./constants";

const SESSION_DAYS = 30;

export type SessionUser = {
  id: string;
  email: string;
  user_metadata: {
    role: UserRole;
    full_name?: string | null;
    tenant_slug?: string | null;
    tenant_name?: string | null;
  };
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function expiresAt() {
  const date = new Date();
  date.setDate(date.getDate() + SESSION_DAYS);
  return date;
}

export async function createSession(user: SessionUser) {
  const token = randomBytes(32).toString("base64url");
  const expires = expiresAt();

  await d1Query(
    `INSERT INTO auth_sessions (id, user_id, token_hash, role, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    [
      crypto.randomUUID(),
      user.id,
      hashToken(token),
      user.user_metadata.role === "admin" ? "teacher" : user.user_metadata.role,
      expires.toISOString(),
    ],
  );

  return { token, expires };
}

export function setSessionCookies(
  response: NextResponse,
  token: string,
  role: UserRole,
  expires: Date,
) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
  response.cookies.set(ROLE_COOKIE, role, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", { path: "/", expires: new Date(0) });
  response.cookies.set(ROLE_COOKIE, "", { path: "/", expires: new Date(0) });
  clearActiveTenantCookie(response);
}

export function setActiveTenantCookie(response: NextResponse, tenantId: string | null | undefined, expires: Date) {
  if (!tenantId) {
    clearActiveTenantCookie(response);
    return;
  }

  response.cookies.set(ACTIVE_TENANT_COOKIE, tenantId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export function clearActiveTenantCookie(response: NextResponse) {
  response.cookies.set(ACTIVE_TENANT_COOKIE, "", { path: "/", expires: new Date(0) });
}

export async function getSessionUserFromToken(token?: string | null) {
  if (!token) return null;

  const rows = await d1Query<Profile & { is_admin: number | null }>(
    `SELECT p.*, CASE WHEN au.user_id IS NULL THEN 0 ELSE 1 END AS is_admin
       FROM auth_sessions s
       JOIN profiles p ON p.id = s.user_id
       LEFT JOIN admin_users au ON au.user_id = p.id
      WHERE s.token_hash = ?
        AND s.revoked_at IS NULL
        AND s.expires_at > datetime('now')
      LIMIT 1`,
    [hashToken(token)],
  );

  const profile = rows[0];
  if (!profile) return null;

  return {
    id: profile.id,
    email: profile.email,
    user_metadata: {
      role: profile.is_admin ? "admin" : profile.role,
      full_name: profile.full_name,
    },
  } satisfies SessionUser;
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  return getSessionUserFromToken(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function revokeSession(token?: string | null) {
  if (!token) return;
  await d1Query(
    "UPDATE auth_sessions SET revoked_at = datetime('now') WHERE token_hash = ?",
    [hashToken(token)],
  );
}

export function middlewareRole(request: NextRequest) {
  return request.cookies.get(ROLE_COOKIE)?.value;
}
