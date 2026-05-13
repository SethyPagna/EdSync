import { NextResponse, type NextRequest } from "next/server";
import { ROLE_COOKIE, SESSION_COOKIE } from "@/lib/auth/constants";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected =
    pathname.startsWith("/teacher") || pathname.startsWith("/student");
  const isAuthPage =
    pathname.startsWith("/auth/login") || pathname.startsWith("/auth/signup");
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const role = request.cookies.get(ROLE_COOKIE)?.value;

  if (!hasSession && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (hasSession && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = role === "teacher" ? "/teacher/dashboard" : "/student/dashboard";
    return NextResponse.redirect(url);
  }

  if (hasSession && role === "teacher" && pathname.startsWith("/student")) {
    const url = request.nextUrl.clone();
    url.pathname = "/teacher/dashboard";
    return NextResponse.redirect(url);
  }

  if (hasSession && role === "student" && pathname.startsWith("/teacher")) {
    const url = request.nextUrl.clone();
    url.pathname = "/student/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
