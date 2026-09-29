import { NextResponse } from "next/server";
import { putR2Object } from "@/lib/storage/r2";
import { d1Query } from "@/lib/db/d1";
import { getSessionUser } from "@/lib/auth/session";
import { scanUploadBuffer } from "@/lib/security/malware";
import { enforceRateLimit, logSecurityEvent } from "@/lib/security/rate-limit";
import { validateObjectPath, validateUploadFile } from "@/lib/security/upload";
import { linkTenantObject, resolveTenantContext } from "@/lib/tenancy";
import { isTenantOutsider } from "@/lib/tenancy/ownership";

const MEDIA_ASSET_TABLE = "media_assets";
const STORAGE_OBJECT_TABLE = "storage_objects";
// 25MB file limit plus room for multipart boundaries and form fields.
const MAX_REQUEST_BYTES = 26 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { message: "Authentication required." } },
      { status: 401 },
    );
  }
  const context = await resolveTenantContext(user);
  if (isTenantOutsider(user, context)) {
    return NextResponse.json(
      { data: null, error: { message: "Organization membership required." } },
      { status: 403 },
    );
  }

  const rate = await enforceRateLimit({
    request,
    scope: "storage_upload",
    limit: 40,
    windowSeconds: 600,
    userId: user.id,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { data: null, error: { message: "Too many uploads. Try again shortly." } },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return NextResponse.json(
      { data: null, error: { message: "Files must be 25MB or smaller." } },
      { status: 413 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { data: null, error: { message: "Upload must be multipart form data." } },
      { status: 400 },
    );
  }
  const file = form.get("file");
  const path = String(form.get("path") ?? "");
  const bucketAlias = String(form.get("bucket") ?? "uploads");

  if (!(file instanceof File) || !path) {
    return NextResponse.json(
      { data: null, error: { message: "File and path are required." } },
      { status: 400 },
    );
  }

  let safeFile;
  try {
    safeFile = await validateUploadFile(file);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload blocked.";
    await logSecurityEvent({
      request,
      userId: user.id,
      eventType: "upload_blocked",
      severity: "warning",
      message,
      metadata: { fileName: file.name, contentType: file.type, size: file.size },
    });
    return NextResponse.json(
      { data: null, error: { message } },
      { status: message.includes("25MB") ? 413 : 415 },
    );
  }

  const env = process.env.DEPLOYMENT_TARGET || "local";
  let safeBucketAlias: string;
  let safePath: string;
  try {
    safeBucketAlias = validateObjectPath(bucketAlias || "uploads", "Bucket alias");
    safePath = validateObjectPath(path || safeFile.fileName, "Upload path");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload path is invalid.";
    return NextResponse.json(
      { data: null, error: { message } },
      { status: 400 },
    );
  }
  const objectKey = `${env}/tenants/${context.tenant.id}/users/${user.id}/${safeBucketAlias}/${safePath}`.replace(/\/+/g, "/");
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const malwareScan = await scanUploadBuffer({
    buffer: fileBuffer,
    fileName: safeFile.fileName,
    contentType: safeFile.contentType,
  });

  if (malwareScan.status === "failed") {
    await logSecurityEvent({
      request,
      userId: user.id,
      eventType: "malware_upload_blocked",
      severity: "critical",
      message: "Upload blocked by malware scan.",
      metadata: {
        fileName: safeFile.fileName,
        contentType: safeFile.contentType,
        size: file.size,
        scan: malwareScan,
      },
    });
    return NextResponse.json(
      { data: null, error: { message: "Upload blocked because the file looks unsafe." } },
      { status: 422 },
    );
  }

  const uploaded = await putR2Object({
    key: objectKey,
    body: fileBuffer,
    contentType: safeFile.contentType,
  });

  // Re-uploading the same path keeps the existing row so media assets and tenant links stay attached.
  const [storageObject] = await d1Query<{ id: string }>(
    `INSERT INTO storage_objects
       (id, owner_id, bucket, object_key, public_url, content_type, size_bytes, purpose, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(bucket, object_key) DO UPDATE SET
       owner_id = excluded.owner_id,
       public_url = excluded.public_url,
       content_type = excluded.content_type,
       size_bytes = excluded.size_bytes,
       purpose = excluded.purpose,
       metadata = excluded.metadata
     RETURNING id`,
    [
      crypto.randomUUID(),
      user.id,
      uploaded.bucket,
      uploaded.key,
      uploaded.publicUrl,
      safeFile.contentType,
      file.size,
      safeBucketAlias,
      JSON.stringify({ malwareScan }),
    ],
  );
  const storageObjectId = storageObject.id;
  await linkTenantObject({
    tenantId: context.tenant.id,
    portalId: context.portal?.id,
    table: STORAGE_OBJECT_TABLE,
    objectId: storageObjectId,
  });

  const mediaAssetId = crypto.randomUUID();
  await d1Query(
    `INSERT INTO media_assets (
       id, owner_id, storage_object_id, asset_type, title, public_url, source, metadata, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, 'upload', ?, datetime('now'))`,
    [
      mediaAssetId,
      user.id,
      storageObjectId,
      safeFile.assetType,
      safeFile.fileName,
      uploaded.publicUrl,
      JSON.stringify({
        bucketAlias: safeBucketAlias,
        objectKey: uploaded.key,
        contentType: safeFile.contentType,
        sizeBytes: file.size,
        malwareScan,
      }),
    ],
  );
  await linkTenantObject({
    tenantId: context.tenant.id,
    portalId: context.portal?.id,
    table: MEDIA_ASSET_TABLE,
    objectId: mediaAssetId,
  });

  return NextResponse.json({
    data: {
      id: mediaAssetId,
      storageObjectId,
      path: uploaded.key,
      publicUrl: uploaded.publicUrl,
      assetType: safeFile.assetType,
      scanStatus: malwareScan.status,
    },
    error: null,
  });
}
