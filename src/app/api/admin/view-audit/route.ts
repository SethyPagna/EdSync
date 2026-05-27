import { NextResponse } from "next/server";
import { auditAdminAction, requireAdmin } from "@/lib/admin";
import { normalizeAdminViewMode } from "@/lib/admin-view";

type ViewAuditBody = {
  mode?: unknown;
  path?: unknown;
};

function cleanPath(value: unknown) {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/")) return null;
  return value.slice(0, 240);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  let body: ViewAuditBody;
  try {
    body = (await request.json()) as ViewAuditBody;
  } catch {
    return NextResponse.json({ data: null, error: "Valid JSON is required." }, { status: 400 });
  }

  const mode = normalizeAdminViewMode(body.mode);
  if (!mode) {
    return NextResponse.json({ data: null, error: "Choose a supported owner view mode." }, { status: 400 });
  }

  await auditAdminAction({
    adminId: auth.user.id,
    action: "open_view_mode",
    entityType: "workspace_view",
    entityId: mode,
    metadata: {
      path: cleanPath(body.path),
    },
  });

  return NextResponse.json({ data: { audited: true }, error: null });
}
