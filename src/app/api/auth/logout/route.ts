import { NextResponse } from "next/server";
import { clearSessionCookies, revokeSession } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();
  await revokeSession(cookieStore.get(SESSION_COOKIE)?.value);
  const response = NextResponse.json({ error: null });
  clearSessionCookies(response);
  return response;
}
