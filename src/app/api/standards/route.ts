import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import { deserializeRow } from "@/lib/db/schema";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { parseStandardsManifest } from "@/lib/standards";
import {
  normalizeStandardsLaunchPath,
  normalizeStandardsStatus,
  validateStandardsFileName,
  validateStandardsManifestText,
  validateStandardsTitle,
} from "@/lib/validation/standards";
import { linkTenantObject, resolveTenantContext } from "@/lib/tenancy";

const STANDARDS_PACKAGE_TABLE = "standards_packages";
const STORAGE_OBJECT_TABLE = "storage_objects";

async function canUseStorageObject(input: {
  tenantId: string;
  userId: string;
  storageObjectId?: string | null;
}) {
  if (!input.storageObjectId) return true;
  const [row] = await d1Query<{ id: string }>(
    `SELECT so.id
       FROM storage_objects so
       JOIN tenant_object_links tol
         ON tol.object_table = ?
        AND tol.object_id = so.id
        AND tol.tenant_id = ?
      WHERE so.id = ?
        AND so.owner_id = ?
      LIMIT 1`,
    [STORAGE_OBJECT_TABLE, input.tenantId, input.storageObjectId, input.userId],
  );
  return Boolean(row);
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);
  const rows = await d1Query("SELECT * FROM standards_packages WHERE tenant_id = ? ORDER BY updated_at DESC", [context.tenant.id]);
  const packages = rows.map((row) => deserializeRow("standards_packages", row));
  return NextResponse.json({ data: { packages, context }, error: null });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);
  try {
    await requirePermission(user, context, PERMISSIONS.coursesAuthor);
  } catch {
    return NextResponse.json({ data: null, error: "Missing authoring permission." }, { status: 403 });
  }
  const body = (await request.json()) as {
    action?: "parse" | "update" | "delete";
    id?: string;
    title?: string;
    status?: "uploaded" | "parsed" | "error" | "archived";
    launchPath?: string | null;
    fileName?: string;
    manifestText?: string;
    storageObjectId?: string | null;
  };

  if (body.action === "delete") {
    if (!body.id) return NextResponse.json({ data: null, error: "Package is required." }, { status: 400 });
    await d1Query("DELETE FROM tenant_object_links WHERE tenant_id = ? AND object_table = ? AND object_id = ?", [
      context.tenant.id,
      STANDARDS_PACKAGE_TABLE,
      body.id,
    ]);
    await d1Query("DELETE FROM standards_packages WHERE tenant_id = ? AND id = ?", [context.tenant.id, body.id]);
    return NextResponse.json({ data: { id: body.id }, error: null });
  }

  if (body.action === "update") {
    if (!body.id) return NextResponse.json({ data: null, error: "Package is required." }, { status: 400 });
    let title: string;
    let launchPath: string | null;
    try {
      title = validateStandardsTitle(body.title);
      launchPath = normalizeStandardsLaunchPath(body.launchPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Standards package is invalid.";
      return NextResponse.json({ data: null, error: message }, { status: 400 });
    }
    const status = normalizeStandardsStatus(body.status);
    await d1Query(
      "UPDATE standards_packages SET title = ?, launch_path = ?, status = ?, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?",
      [title, launchPath, status, context.tenant.id, body.id],
    );
    return NextResponse.json({ data: { id: body.id }, error: null });
  }

  let fileName: string;
  let manifestText: string;
  try {
    fileName = validateStandardsFileName(body.fileName);
    manifestText = validateStandardsManifestText(body.manifestText);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Standards manifest is invalid.";
    return NextResponse.json({ data: null, error: message }, { status: 400 });
  }
  const parsed = parseStandardsManifest({ fileName, manifestText });
  if (
    !(await canUseStorageObject({
      tenantId: context.tenant.id,
      userId: user.id,
      storageObjectId: body.storageObjectId,
    }))
  ) {
    return NextResponse.json({ data: null, error: "Storage object not found." }, { status: 404 });
  }
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
  await linkTenantObject({ tenantId: context.tenant.id, portalId: context.portal?.id, table: STANDARDS_PACKAGE_TABLE, objectId: id });
  return NextResponse.json({ data: { id, parsed }, error: null });
}
