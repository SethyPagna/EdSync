import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { queueEmail } from "@/lib/engagement/server";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    to?: string;
    subject?: string;
    text?: string;
    html?: string | null;
    metadata?: Record<string, unknown>;
  };

  if (!body.to || !body.subject || !body.text) {
    return NextResponse.json({ data: null, error: "To, subject, and text are required." }, { status: 400 });
  }

  const result = await queueEmail({
    recipientEmail: body.to,
    subject: body.subject,
    bodyText: body.text,
    bodyHtml: body.html ?? null,
    metadata: { sentBy: user.id, ...(body.metadata ?? {}) },
  });

  return NextResponse.json({ data: result, error: null });
}
