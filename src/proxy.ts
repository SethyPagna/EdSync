import { NextResponse, type NextRequest } from "next/server";
import { ROLE_COOKIE, SESSION_COOKIE } from "@/lib/auth/constants";
import { homeForRole } from "@/lib/auth/redirects";
import { normalizeUserRole } from "@/lib/auth/roles";
import {
  ADMIN_VIEW_MODE_COOKIE,
  adminViewModeForWorkspaceRole,
  normalizeAdminViewMode,
  type AdminViewMode,
} from "@/lib/admin-view";

const PROTECTED_ROUTE_PREFIXES = [
  "/admin",
  "/teacher",
  "/student",
  "/studio",
  "/notes",
  "/docs",
  "/sheets",
  "/slides",
  "/ai",
  "/practice",
  "/quizzes",
  "/games",
] as const;

const AUTH_ROUTE_PREFIXES = ["/auth/login", "/auth/signup"] as const;

const TEACHER_ROUTE_PREFIX = "/teacher";
const STUDENT_ROUTE_PREFIX = "/student";
const ADMIN_ROUTE_PREFIX = "/admin";
const ADMIN_VIEW_MODE_HEADER = "x-edsync-admin-view-mode";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestedAdminViewMode = normalizeAdminViewMode(request.nextUrl.searchParams.get("adminView"));
  const isProtected = startsWithAny(pathname, PROTECTED_ROUTE_PREFIXES);
  const isAuthPage = startsWithAny(pathname, AUTH_ROUTE_PREFIXES);
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const role = normalizeUserRole(request.cookies.get(ROLE_COOKIE)?.value);

  if (!hasSession && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return withSecurityHeaders(NextResponse.redirect(url));
  }

  if (hasSession && isAuthPage && role) {
    const url = request.nextUrl.clone();
    url.pathname = homeForRole(role);
    return withSecurityHeaders(NextResponse.redirect(url));
  }

  if (hasSession && !role && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return withSecurityHeaders(NextResponse.redirect(url));
  }

  if (hasSession && role && role !== "admin" && pathname.startsWith(ADMIN_ROUTE_PREFIX)) {
    const url = request.nextUrl.clone();
    url.pathname = role === "teacher" ? "/teacher/dashboard" : "/student/dashboard";
    return withSecurityHeaders(NextResponse.redirect(url));
  }

  if (
    hasSession &&
    role === "admin" &&
    (pathname.startsWith(TEACHER_ROUTE_PREFIX) || pathname.startsWith(STUDENT_ROUTE_PREFIX))
  ) {
    const inferredMode = adminViewModeForPath(pathname, requestedAdminViewMode);
    const response = nextWithAdminViewMode(request, inferredMode);
    syncAdminViewModeCookie(response, pathname, inferredMode);
    return withSecurityHeaders(response);
  }

  if (hasSession && role === "teacher" && pathname.startsWith(STUDENT_ROUTE_PREFIX)) {
    const url = request.nextUrl.clone();
    url.pathname = "/teacher/dashboard";
    return withSecurityHeaders(NextResponse.redirect(url));
  }

  if (hasSession && role === "student" && pathname.startsWith(TEACHER_ROUTE_PREFIX)) {
    const url = request.nextUrl.clone();
    url.pathname = "/student/dashboard";
    return withSecurityHeaders(NextResponse.redirect(url));
  }

  const response = NextResponse.next();
  if (hasSession && role === "admin") {
    const inferredMode = adminViewModeForPath(pathname, requestedAdminViewMode);
    const nextResponse = nextWithAdminViewMode(request, inferredMode);
    syncAdminViewModeCookie(nextResponse, pathname, inferredMode);
    return withSecurityHeaders(nextResponse);
  }
  return withSecurityHeaders(response);
}

function startsWithAny(pathname: string, prefixes: readonly string[]) {
  return prefixes.some((prefix) => pathname.startsWith(prefix));
}

function adminViewModeForPath(pathname: string, mode: AdminViewMode | null) {
  return (
    mode ??
    (pathname.startsWith(TEACHER_ROUTE_PREFIX)
      ? adminViewModeForWorkspaceRole("teacher")
      : pathname.startsWith(STUDENT_ROUTE_PREFIX)
        ? adminViewModeForWorkspaceRole("student")
        : null)
  );
}

function nextWithAdminViewMode(request: NextRequest, mode: AdminViewMode | null) {
  const requestHeaders = new Headers(request.headers);
  if (mode) {
    requestHeaders.set(ADMIN_VIEW_MODE_HEADER, mode);
  } else {
    requestHeaders.delete(ADMIN_VIEW_MODE_HEADER);
  }
  return NextResponse.next({ request: { headers: requestHeaders } });
}

function syncAdminViewModeCookie(response: NextResponse, pathname: string, mode: AdminViewMode | null) {
  if (pathname.startsWith(ADMIN_ROUTE_PREFIX)) {
    response.cookies.delete(ADMIN_VIEW_MODE_COOKIE);
    return;
  }
  if (!mode) return;
  response.cookies.set(ADMIN_VIEW_MODE_COOKIE, mode, {
    maxAge: 60 * 60,
    path: "/",
    sameSite: "lax",
  });
}

function withSecurityHeaders(response: NextResponse) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https:",
      "frame-src https://www.youtube.com https://player.vimeo.com",
      "connect-src 'self' https://api.cloudflare.com https://*.r2.cloudflarestorage.com",
      "form-action 'self'",
    ].join("; "),
  );
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
