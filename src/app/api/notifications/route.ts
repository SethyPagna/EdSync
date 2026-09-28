import { NextResponse } from "next/server";
import { d1Query } from "@/lib/db/d1";
import { getSessionUser } from "@/lib/auth/session";
import { createNotification } from "@/lib/engagement/server";
import { normalizeNotificationInput, validateNotificationRecordId } from "@/lib/engagement/notification-validation";
import { deserializeRow } from "@/lib/db/schema";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { BadRequestError, ForbiddenError, UnauthorizedError, readJson, withRoute } from "@/lib/security/http-errors";
import { resolveTenantContext } from "@/lib/tenancy";
import { canContactUser } from "@/lib/tenancy/ownership";
import type { Notification } from "@/types";

function validated<T>(parse: () => T, fallback: string): T {
  try {
    return parse();
  } catch (error) {
    throw new BadRequestError(error instanceof Error ? error.message : fallback);
  }
}

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

export const POST = withRoute(async (request) => {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();

  const body = await readJson<{
    userId?: string;
    type?: string;
    title?: string;
    message?: string;
    actionUrl?: string | null;
    priority?: "low" | "normal" | "high";
    metadata?: Record<string, unknown>;
  }>(request);

  const { userId, notification } = validated(
    () => ({ userId: validateNotificationRecordId(body.userId, "User"), notification: normalizeNotificationInput(body) }),
    "Notification payload is invalid.",
  );

  if (userId !== user.id) {
    const context = await resolveTenantContext(user);
    await requirePermission(user, context, PERMISSIONS.coursesAuthor).catch(() => {
      throw new ForbiddenError("Missing notification permission.");
    });
    if (!(await canContactUser({ sender: user, context, recipientId: userId }))) {
      throw new ForbiddenError("You can only notify members of your organization or classes.");
    }
  }

  const id = await createNotification({
    userId,
    actorId: user.id,
    ...notification,
  });

  return NextResponse.json({ data: { id }, error: null });
});

export const PATCH = withRoute(async (request) => {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();

  const body = await readJson<{ id?: string; all?: boolean }>(request);
  if (body.all === true) {
    await d1Query("UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL", [
      user.id,
    ]);
    return NextResponse.json({ data: { updated: true }, error: null });
  }

  const id = validated(() => validateNotificationRecordId(body.id, "Notification"), "Missing notification id.");
  await d1Query("UPDATE notifications SET read_at = datetime('now') WHERE id = ? AND user_id = ?", [
    id,
    user.id,
  ]);
  return NextResponse.json({ data: { updated: true }, error: null });
});

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
