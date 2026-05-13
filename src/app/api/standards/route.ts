import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { parseStandardsManifest } from "@/lib/standards";
import { linkTenantObject, resolveTenantContext } from "@/lib/tenancy";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);
  const packages = await d1Query("SELECT * FROM standards_packages WHERE tenant_id = ? ORDER BY updated_at DESC", [context.tenant.id]);
  return NextResponse.json({ data: { packages, context }, error: null });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);
  await requirePermission(user, context, PERMISSIONS.coursesAuthor);
  const body = (await request.json()) as { fileName?: string; manifestText?: string; storageObjectId?: string | null };
  if (!body.fileName || !body.manifestText) {
    return NextResponse.json({ data: null, error: "File name and manifest text are required." }, { status: 400 });
  }
  const parsed = parseStandardsManifest({ fileName: body.fileName, manifestText: body.manifestText });
  const id = crypto.randomUUID();
  await d1Query(
    `INSERT INTO standards_packages (
       id, tenant_id, owner_id, package_type, title, storage_object_id, manifest, launch_path,
       status, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'parsed', datetime('now'), datetime('now'))`,
    [
      id,
      context.tenant.id,
      user.id,
      parsed.packageType,
      parsed.title,
      body.storageObjectId ?? null,
      JSON.stringify(parsed.manifest),
      parsed.launchPath,
    ],
  );
  await linkTenantObject({ tenantId: context.tenant.id, portalId: context.portal?.id, table: "standards_packages", objectId: id });
  return NextResponse.json({ data: { id, parsed }, error: null });
}
