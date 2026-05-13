import { NextResponse } from "next/server";
import { d1Query } from "@/lib/db/d1";
import { getSessionUser } from "@/lib/auth/session";
import { createNotification } from "@/lib/engagement/server";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: [], error: "Unauthorized" }, { status: 401 });

  const rows = await d1Query(
    `SELECT *
       FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 30`,
    [user.id],
  );

  return NextResponse.json({ data: rows, error: null });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    userId?: string;
    type?: string;
    title?: string;
    message?: string;
    actionUrl?: string | null;
    priority?: "low" | "normal" | "high";
    metadata?: Record<string, unknown>;
  };

  if (!body.userId || !body.title || !body.message) {
    return NextResponse.json({ data: null, error: "Missing notification fields." }, { status: 400 });
  }

  const id = await createNotification({
    userId: body.userId,
    actorId: user.id,
    type: body.type ?? "manual",
    title: body.title,
    message: body.message,
    actionUrl: body.actionUrl ?? null,
    priority: body.priority ?? "normal",
    metadata: body.metadata ?? {},
  });

  return NextResponse.json({ data: { id }, error: null });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { id?: string; all?: boolean };
  if (body.all) {
    await d1Query("UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL", [
      user.id,
    ]);
    return NextResponse.json({ data: { updated: true }, error: null });
  }

  if (!body.id) return NextResponse.json({ data: null, error: "Missing notification id." }, { status: 400 });

  await d1Query("UPDATE notifications SET read_at = datetime('now') WHERE id = ? AND user_id = ?", [
    body.id,
    user.id,
  ]);
  return NextResponse.json({ data: { updated: true }, error: null });
}
