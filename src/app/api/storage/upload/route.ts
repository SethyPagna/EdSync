import { NextResponse } from "next/server";
import { putR2Object } from "@/lib/storage/r2";
import { d1Query } from "@/lib/db/d1";
import { getSessionUser } from "@/lib/auth/session";
import { scanUploadBuffer } from "@/lib/security/malware";
import { enforceRateLimit, logSecurityEvent } from "@/lib/security/rate-limit";
import { sanitizeObjectPath, validateUploadFile } from "@/lib/security/upload";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { message: "Authentication required." } },
      { status: 401 },
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  const path = String(form.get("path") ?? "");
  const bucketAlias = String(form.get("bucket") ?? "uploads");

  if (!(file instanceof File) || !path) {
    return NextResponse.json(
      { data: null, error: { message: "File and path are required." } },
      { status: 400 },
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
  const safeBucketAlias = sanitizeObjectPath(bucketAlias) || "uploads";
  const safePath = sanitizeObjectPath(path) || safeFile.fileName;
  const objectKey = `${env}/users/${user.id}/${safeBucketAlias}/${safePath}`.replace(/\/+/g, "/");
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

  const storageObjectId = crypto.randomUUID();
  await d1Query(
    `INSERT OR REPLACE INTO storage_objects
       (id, owner_id, bucket, object_key, public_url, content_type, size_bytes, purpose, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      storageObjectId,
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

  await d1Query(
    `INSERT INTO media_assets (
       id, owner_id, storage_object_id, asset_type, title, public_url, source, metadata, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, 'upload', ?, datetime('now'))`,
    [
      crypto.randomUUID(),
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

  return NextResponse.json({
    data: {
      path: uploaded.key,
      publicUrl: uploaded.publicUrl,
      assetType: safeFile.assetType,
      scanStatus: malwareScan.status,
    },
    error: null,
  });
}
