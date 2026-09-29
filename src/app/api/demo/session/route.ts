import { NextRequest, NextResponse } from "next/server";
import { d1Query } from "@/lib/db/d1";
import { createSession, revokeSession, setActiveTenantCookie, setSessionCookies } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { enforceRateLimit } from "@/lib/security/rate-limit";

const DEMO_TENANT_ID = "tenant_edsync_default";
const DEMO_ACCOUNTS = {
  student: {
    id: "651615e6-34a6-45b2-a3d7-9d6ab9abbdb2",
    email: "student@edsync.test",
    destination: "/student/dashboard",
  },
  teacher: {
    id: "7a53c3db-348e-46c4-a77a-384b24be0522",
    email: "teacher@edsync.test",
    destination: "/teacher/dashboard",
  },
} as const;

function isPublicDemoRequest(request: NextRequest) {
  const demoHostname = process.env.EDSYNC_DEMO_HOSTNAME?.trim().toLowerCase();
  const requestHostname = request.nextUrl.hostname.toLowerCase();
  const headerHostname = request.headers.get("host")?.split(":")[0]?.toLowerCase();
  return process.env.EDSYNC_DEMO_MODE === "1" &&
    Boolean(demoHostname && requestHostname === demoHostname) &&
    (!headerHostname || headerHostname === demoHostname) &&
    request.headers.get("origin") === request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  if (!isPublicDemoRequest(request)) {
    return NextResponse.json({ error: "Demo access is unavailable." }, { status: 404 });
  }

  const form = await request.formData().catch(() => null);
  const role = form?.get("role");
  if (role !== "student" && role !== "teacher") {
    return NextResponse.json({ error: "Choose a demo role." }, { status: 400 });
  }

  const rate = await enforceRateLimit({ request, scope: "demo_session", limit: 60, windowSeconds: 900 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many demo visits. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    );
  }

  const account = DEMO_ACCOUNTS[role];
  const [row] = await d1Query<{ full_name: string | null }>(
    `SELECT p.full_name
       FROM auth_users au
       JOIN profiles p ON p.id = au.id
       JOIN tenant_memberships tm ON tm.user_id = au.id
      WHERE au.id = ? AND lower(au.email) = ? AND lower(p.email) = ?
        AND p.role = ? AND tm.tenant_id = ? AND tm.status = 'active'
        AND NOT EXISTS (SELECT 1 FROM admin_users ad WHERE ad.user_id = au.id)
      LIMIT 1`,
    [account.id, account.email, account.email, role, DEMO_TENANT_ID],
  );
  if (!row) {
    return NextResponse.json({ error: "Demo accounts are not ready yet." }, { status: 503 });
  }

  await revokeSession(request.cookies.get(SESSION_COOKIE)?.value);
  const session = await createSession({
    id: account.id,
    email: account.email,
    user_metadata: { role, full_name: row.full_name },
  });
  const response = NextResponse.redirect(new URL(account.destination, request.url), 303);
  response.headers.set("Cache-Control", "no-store");
  setSessionCookies(response, session.token, role, session.expires);
  setActiveTenantCookie(response, DEMO_TENANT_ID, session.expires);
  return response;
}
