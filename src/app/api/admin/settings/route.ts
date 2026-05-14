import { NextResponse } from "next/server";
import { requireAdmin, auditAdminAction } from "@/lib/admin";
import { d1Query } from "@/lib/db/d1";

const DEFAULT_FLAGS = [
  ["work_items", "Work items", "Tasks, tests, quizzes, discussions, and activities."],
  ["gradebook", "Gradebook", "Weighted class gradebook and score review."],
  ["student_notes", "Student notes", "Teacher notes visible to students when selected."],
  ["ai_provider_fallback", "Smart AI fallback", "Use provider priority, cooldowns, and health for AI routing."],
  ["email_outbox", "Email outbox", "Free compose/outbox workflow for class messages."],
];

async function seedDefaults() {
  await Promise.all(
    DEFAULT_FLAGS.map(([key, label, description]) =>
      d1Query(
        `INSERT OR IGNORE INTO feature_flags (id, flag_key, label, description, enabled, audience, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, 'all', '{}', datetime('now'), datetime('now'))`,
        [crypto.randomUUID(), key, label, description],
      ),
    ),
  );
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  await seedDefaults();
  const flags = await d1Query("SELECT * FROM feature_flags ORDER BY flag_key ASC");
  return NextResponse.json({ data: { flags, emailMode: process.env.EMAIL_MODE || "outbox" }, error: null });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const body = (await request.json()) as { flagKey?: string; enabled?: boolean };
  if (!body.flagKey) return NextResponse.json({ data: null, error: "Flag key is required." }, { status: 400 });

  await seedDefaults();
  await d1Query("UPDATE feature_flags SET enabled = ?, updated_at = datetime('now') WHERE flag_key = ?", [
    body.enabled ? 1 : 0,
    body.flagKey,
  ]);
  await auditAdminAction({
    adminId: auth.user.id,
    action: "toggle_flag",
    entityType: "feature_flag",
    entityId: body.flagKey,
    metadata: { enabled: Boolean(body.enabled) },
  });
  return NextResponse.json({ data: { updated: true }, error: null });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const body = (await request.json()) as {
    action?: "create_flag" | "update_flag" | "delete_flag";
    id?: string;
    flagKey?: string;
    label?: string;
    description?: string | null;
    enabled?: boolean;
    audience?: "all" | "admin" | "teacher" | "student";
  };

  await seedDefaults();

  if (body.action === "delete_flag") {
    if (!body.id) return NextResponse.json({ data: null, error: "Flag is required." }, { status: 400 });
    await d1Query("DELETE FROM feature_flags WHERE id = ?", [body.id]);
    await auditAdminAction({
      adminId: auth.user.id,
      action: "delete_flag",
      entityType: "feature_flag",
      entityId: body.id,
      metadata: {},
    });
    return NextResponse.json({ data: { id: body.id }, error: null });
  }

  if (!body.flagKey?.trim() || !body.label?.trim()) {
    return NextResponse.json({ data: null, error: "Flag key and label are required." }, { status: 400 });
  }

  const flagKey = body.flagKey.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
  const audience = ["all", "admin", "teacher", "student"].includes(body.audience || "") ? body.audience : "all";

  if (body.action === "update_flag") {
    if (!body.id) return NextResponse.json({ data: null, error: "Flag is required." }, { status: 400 });
    await d1Query(
      "UPDATE feature_flags SET flag_key = ?, label = ?, description = ?, enabled = ?, audience = ?, updated_at = datetime('now') WHERE id = ?",
      [flagKey, body.label.trim(), body.description ?? null, body.enabled ? 1 : 0, audience, body.id],
    );
    await auditAdminAction({
      adminId: auth.user.id,
      action: "update_flag",
      entityType: "feature_flag",
      entityId: body.id,
      metadata: { flagKey, enabled: Boolean(body.enabled), audience },
    });
    return NextResponse.json({ data: { id: body.id }, error: null });
  }

  const id = crypto.randomUUID();
  await d1Query(
    `INSERT INTO feature_flags (id, flag_key, label, description, enabled, audience, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, '{}', datetime('now'), datetime('now'))`,
    [id, flagKey, body.label.trim(), body.description ?? null, body.enabled ? 1 : 0, audience],
  );
  await auditAdminAction({
    adminId: auth.user.id,
    action: "create_flag",
    entityType: "feature_flag",
    entityId: id,
    metadata: { flagKey, enabled: Boolean(body.enabled), audience },
  });
  return NextResponse.json({ data: { id }, error: null });
}
