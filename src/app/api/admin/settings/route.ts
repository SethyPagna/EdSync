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
