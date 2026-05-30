import { NextResponse } from "next/server";
import { requireAdmin, auditAdminAction } from "@/lib/admin";
import {
  normalizeFeatureFlagEnabled,
  normalizeFeatureFlagInput,
  normalizeFeatureFlagKey,
  validateFeatureFlagId,
} from "@/lib/validation/admin-settings";
import { d1Query } from "@/lib/db/d1";

const DEFAULT_FLAGS = [
  ["work_items", "Work items", "Tasks, tests, quizzes, discussions, and activities."],
  ["gradebook", "Progress feedback", "Weighted progress review and feedback."],
  ["student_notes", "Learner notes", "Creator notes visible to learners when selected."],
  ["ai_provider_fallback", "Smart AI fallback", "Use provider priority, cooldowns, and health for AI routing."],
  ["email_outbox", "Email outbox", "Free compose/outbox workflow for course messages."],
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
  let flagKey: string;
  let enabled: boolean;
  try {
    flagKey = normalizeFeatureFlagKey(body.flagKey);
    enabled = normalizeFeatureFlagEnabled(body.enabled);
  } catch (error) {
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Invalid feature flag." },
      { status: 400 },
    );
  }

  await seedDefaults();
  await d1Query("UPDATE feature_flags SET enabled = ?, updated_at = datetime('now') WHERE flag_key = ?", [
    enabled ? 1 : 0,
    flagKey,
  ]);
  await auditAdminAction({
    adminId: auth.user.id,
    action: "toggle_flag",
    entityType: "feature_flag",
    entityId: flagKey,
    metadata: { enabled },
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
    let id: string;
    try {
      id = validateFeatureFlagId(body.id);
    } catch (error) {
      return NextResponse.json(
        { data: null, error: error instanceof Error ? error.message : "Invalid feature flag." },
        { status: 400 },
      );
    }
    await d1Query("DELETE FROM feature_flags WHERE id = ?", [id]);
    await auditAdminAction({
      adminId: auth.user.id,
      action: "delete_flag",
      entityType: "feature_flag",
      entityId: id,
      metadata: {},
    });
    return NextResponse.json({ data: { id }, error: null });
  }

  let flag;
  try {
    flag = normalizeFeatureFlagInput(body);
  } catch (error) {
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Invalid feature flag." },
      { status: 400 },
    );
  }

  if (body.action === "update_flag") {
    let id: string;
    try {
      id = validateFeatureFlagId(body.id);
    } catch (error) {
      return NextResponse.json(
        { data: null, error: error instanceof Error ? error.message : "Invalid feature flag." },
        { status: 400 },
      );
    }
    await d1Query(
      "UPDATE feature_flags SET flag_key = ?, label = ?, description = ?, enabled = ?, audience = ?, updated_at = datetime('now') WHERE id = ?",
      [flag.flagKey, flag.label, flag.description, flag.enabled ? 1 : 0, flag.audience, id],
    );
    await auditAdminAction({
      adminId: auth.user.id,
      action: "update_flag",
      entityType: "feature_flag",
      entityId: id,
      metadata: { flagKey: flag.flagKey, enabled: flag.enabled, audience: flag.audience },
    });
    return NextResponse.json({ data: { id }, error: null });
  }

  const id = crypto.randomUUID();
  await d1Query(
    `INSERT INTO feature_flags (id, flag_key, label, description, enabled, audience, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, '{}', datetime('now'), datetime('now'))`,
    [id, flag.flagKey, flag.label, flag.description, flag.enabled ? 1 : 0, flag.audience],
  );
  await auditAdminAction({
    adminId: auth.user.id,
    action: "create_flag",
    entityType: "feature_flag",
    entityId: id,
    metadata: { flagKey: flag.flagKey, enabled: flag.enabled, audience: flag.audience },
  });
  return NextResponse.json({ data: { id }, error: null });
}
