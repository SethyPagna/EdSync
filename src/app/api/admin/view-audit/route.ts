import { NextResponse } from "next/server";
import { auditAdminAction, requireAdmin } from "@/lib/admin";

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

  if (body.mode !== "teacher" && body.mode !== "student") {
    return NextResponse.json({ data: null, error: "View mode must be teacher or student." }, { status: 400 });
  }

  await auditAdminAction({
    adminId: auth.user.id,
    action: "open_view_mode",
    entityType: "workspace_view",
    entityId: body.mode,
    metadata: {
      path: cleanPath(body.path),
    },
  });

  return NextResponse.json({ data: { audited: true }, error: null });
}
