import { NextResponse } from "next/server";
import { d1Query } from "@/lib/db/d1";
import { getSessionUser } from "@/lib/auth/session";
import { createNotification } from "@/lib/engagement/server";
import { normalizeNotificationInput, validateNotificationRecordId } from "@/lib/engagement/notification-validation";
import { deserializeRow } from "@/lib/db/schema";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { resolveTenantContext } from "@/lib/tenancy";
import type { Notification } from "@/types";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: [], error: "Unauthorized" }, { status: 401 });

  const rows = await d1Query<Record<string, unknown>>(
    `SELECT *
       FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 30`,
    [user.id],
  );

  return NextResponse.json({ data: rows.map((row) => deserializeRow<Notification>("notifications", row)), error: null });
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

  let notification: ReturnType<typeof normalizeNotificationInput>;
  let userId: string;
  try {
    userId = validateNotificationRecordId(body.userId, "User");
    notification = normalizeNotificationInput(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notification payload is invalid.";
    return NextResponse.json({ data: null, error: message }, { status: 400 });
  }

  if (userId !== user.id) {
    const context = await resolveTenantContext(user);
    try {
      await requirePermission(user, context, PERMISSIONS.coursesAuthor);
    } catch {
      return NextResponse.json({ data: null, error: "Missing notification permission." }, { status: 403 });
    }
  }

  const id = await createNotification({
    userId,
    actorId: user.id,
    ...notification,
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

  let id: string;
  try {
    id = validateNotificationRecordId(body.id, "Notification");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Missing notification id.";
    return NextResponse.json({ data: null, error: message }, { status: 400 });
  }

  await d1Query("UPDATE notifications SET read_at = datetime('now') WHERE id = ? AND user_id = ?", [
    id,
    user.id,
  ]);
  return NextResponse.json({ data: { updated: true }, error: null });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  let id: string;
  try {
    id = validateNotificationRecordId(searchParams.get("id"), "Notification");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Missing notification id.";
    return NextResponse.json({ data: null, error: message }, { status: 400 });
  }

  await d1Query("DELETE FROM notifications WHERE id = ? AND user_id = ?", [id, user.id]);
  return NextResponse.json({ data: { deleted: true }, error: null });
}
