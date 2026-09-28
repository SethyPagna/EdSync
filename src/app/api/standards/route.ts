import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import { deserializeRow } from "@/lib/db/schema";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  readJson,
  withRoute,
} from "@/lib/security/http-errors";
import { parseStandardsManifest } from "@/lib/standards";
import {
  normalizeStandardsLaunchPath,
  normalizeStandardsStatus,
  validateStandardsFileName,
  validateStandardsManifestText,
  validateStandardsTitle,
} from "@/lib/validation/standards";
import { linkTenantObject, resolveTenantContext } from "@/lib/tenancy";
import { ownerScope } from "@/lib/tenancy/ownership";

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

export const GET = withRoute(async () => {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  const context = await resolveTenantContext(user);
  const owner = ownerScope(user, context, "owner_id");
  const rows = await d1Query(
    `SELECT * FROM standards_packages WHERE tenant_id = ?${owner.sql} ORDER BY updated_at DESC`,
    [context.tenant.id, ...owner.params],
  );
  const packages = rows.map((row) => deserializeRow("standards_packages", row));
  return NextResponse.json({ data: { packages, context }, error: null });
});

export const POST = withRoute(async (request) => {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  const context = await resolveTenantContext(user);
  await requirePermission(user, context, PERMISSIONS.coursesAuthor).catch(() => {
    throw new ForbiddenError("Missing authoring permission.");
  });
  const body = await readJson<{
    action?: "parse" | "update" | "delete";
    id?: string;
    title?: string;
    status?: "uploaded" | "parsed" | "error" | "archived";
    launchPath?: string | null;
    fileName?: string;
    manifestText?: string;
    storageObjectId?: string | null;
  }>(request);
  const owner = ownerScope(user, context, "owner_id");

  if (body.action === "delete") {
    if (!body.id) throw new BadRequestError("Package is required.");
    const [deleted] = await d1Query<{ id: string }>(
      `DELETE FROM standards_packages WHERE tenant_id = ? AND id = ?${owner.sql} RETURNING id`,
      [context.tenant.id, body.id, ...owner.params],
    );
    if (!deleted) throw new NotFoundError("Package not found.");
    await d1Query("DELETE FROM tenant_object_links WHERE tenant_id = ? AND object_table = ? AND object_id = ?", [
      context.tenant.id,
      STANDARDS_PACKAGE_TABLE,
      body.id,
    ]);
    return NextResponse.json({ data: { id: body.id }, error: null });
  }

  if (body.action === "update") {
    if (!body.id) throw new BadRequestError("Package is required.");
    let title: string;
    let launchPath: string | null;
    try {
      title = validateStandardsTitle(body.title);
      launchPath = normalizeStandardsLaunchPath(body.launchPath);
    } catch (error) {
      throw new BadRequestError(error instanceof Error ? error.message : "Standards package is invalid.");
    }
    const status = normalizeStandardsStatus(body.status);
    const [updated] = await d1Query<{ id: string }>(
      `UPDATE standards_packages
          SET title = ?, launch_path = ?, status = ?, updated_at = datetime('now')
        WHERE tenant_id = ? AND id = ?${owner.sql}
        RETURNING id`,
      [title, launchPath, status, context.tenant.id, body.id, ...owner.params],
    );
    if (!updated) throw new NotFoundError("Package not found.");
    return NextResponse.json({ data: { id: body.id }, error: null });
  }

  let fileName: string;
  let manifestText: string;
  try {
    fileName = validateStandardsFileName(body.fileName);
    manifestText = validateStandardsManifestText(body.manifestText);
  } catch (error) {
    throw new BadRequestError(error instanceof Error ? error.message : "Standards manifest is invalid.");
  }
  const parsed = parseStandardsManifest({ fileName, manifestText });
  if (
    !(await canUseStorageObject({
      tenantId: context.tenant.id,
      userId: user.id,
      storageObjectId: body.storageObjectId,
    }))
  ) {
    throw new NotFoundError("Storage object not found.");
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
});
