import { NextResponse, type NextRequest } from "next/server";
import { ROLE_COOKIE, SESSION_COOKIE } from "@/lib/auth/constants";
import { homeForRole } from "@/lib/auth/redirects";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/teacher") ||
    pathname.startsWith("/student") ||
    pathname.startsWith("/studio") ||
    pathname.startsWith("/notes") ||
    pathname.startsWith("/docs") ||
    pathname.startsWith("/sheets") ||
    pathname.startsWith("/slides") ||
    pathname.startsWith("/ai") ||
    pathname.startsWith("/practice") ||
    pathname.startsWith("/quizzes") ||
    pathname.startsWith("/games");
  const isAuthPage =
    pathname.startsWith("/auth/login") || pathname.startsWith("/auth/signup");
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const role = request.cookies.get(ROLE_COOKIE)?.value;

  if (!hasSession && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return withSecurityHeaders(NextResponse.redirect(url));
  }

  if (hasSession && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = homeForRole(role);
    return withSecurityHeaders(NextResponse.redirect(url));
  }

  if (hasSession && role !== "admin" && pathname.startsWith("/admin")) {
    const url = request.nextUrl.clone();
    url.pathname = role === "teacher" ? "/teacher/dashboard" : "/student/dashboard";
    return withSecurityHeaders(NextResponse.redirect(url));
  }

  if (hasSession && role === "admin" && (pathname.startsWith("/teacher") || pathname.startsWith("/student"))) {
    return withSecurityHeaders(NextResponse.next());
  }

  if (hasSession && role === "teacher" && pathname.startsWith("/student")) {
    const url = request.nextUrl.clone();
    url.pathname = "/teacher/dashboard";
    return withSecurityHeaders(NextResponse.redirect(url));
  }

  if (hasSession && role === "student" && pathname.startsWith("/teacher")) {
    const url = request.nextUrl.clone();
    url.pathname = "/student/dashboard";
    return withSecurityHeaders(NextResponse.redirect(url));
  }

  return withSecurityHeaders(NextResponse.next());
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
