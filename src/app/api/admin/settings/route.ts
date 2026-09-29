import { NextResponse } from "next/server";
import { auditAdminAction, requireAdmin } from "@/lib/admin";
import { d1Query } from "@/lib/db/d1";
import { isSupportedFeatureFlag, SUPPORTED_FEATURE_FLAGS } from "@/lib/feature-flags";
import { normalizeFeatureFlagEnabled, normalizeFeatureFlagKey, validateFeatureFlagId } from "@/lib/validation/admin-settings";

type FlagRow = {
  id: string;
  flag_key: string;
  label: string;
  description: string | null;
  enabled: number;
  audience: string;
};

function badRequest(message: string) {
  return NextResponse.json({ data: null, error: message }, { status: 400 });
}

async function seedDefaults() {
  await Promise.all(
    Object.entries(SUPPORTED_FEATURE_FLAGS).map(([key, { label, description }]) =>
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
  const rows = await d1Query<FlagRow>("SELECT * FROM feature_flags ORDER BY flag_key ASC");
  const flags = rows.map((row) => isSupportedFeatureFlag(row.flag_key)
    ? { ...row, ...SUPPORTED_FEATURE_FLAGS[row.flag_key], audience: "all", connected: true }
    : { ...row, connected: false });
  return NextResponse.json({ data: { flags, emailMode: process.env.EMAIL_MODE || "outbox", scope: "platform" }, error: null });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  let flagKey: string;
  let enabled: boolean;
  try {
    const body = (await request.json()) as { flagKey?: string; enabled?: boolean };
    flagKey = normalizeFeatureFlagKey(body.flagKey);
    enabled = normalizeFeatureFlagEnabled(body.enabled);
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Invalid feature flag.");
  }
  if (!isSupportedFeatureFlag(flagKey)) return badRequest("This flag is not connected to a feature.");

  await seedDefaults();
  await d1Query("UPDATE feature_flags SET enabled = ?, audience = 'all', updated_at = datetime('now') WHERE flag_key = ?", [
    enabled ? 1 : 0,
    flagKey,
  ]);
  await auditAdminAction({
    adminId: auth.user.id,
    action: "toggle_flag",
    entityType: "feature_flag",
    entityId: flagKey,
    metadata: { enabled, scope: "platform" },
  });
  return NextResponse.json({ data: { updated: true }, error: null });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  let action: unknown;
  let id: string;
  try {
    const body = (await request.json()) as { action?: unknown; id?: unknown };
    action = body.action;
    id = validateFeatureFlagId(body.id);
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Invalid feature flag.");
  }
  if (action !== "delete_flag") return badRequest("Only disconnected legacy flags can be removed.");

  const [flag] = await d1Query<{ flag_key: string }>("SELECT flag_key FROM feature_flags WHERE id = ? LIMIT 1", [id]);
  if (!flag) return badRequest("Flag not found.");
  if (isSupportedFeatureFlag(flag.flag_key)) return badRequest("Connected flags cannot be deleted. Turn them off instead.");

  await d1Query("DELETE FROM feature_flags WHERE id = ?", [id]);
  await auditAdminAction({
    adminId: auth.user.id,
    action: "delete_flag",
    entityType: "feature_flag",
    entityId: id,
    metadata: { flagKey: flag.flag_key },
  });
  return NextResponse.json({ data: { id }, error: null });
}
