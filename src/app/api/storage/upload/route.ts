import { NextResponse } from "next/server";
import { putR2Object } from "@/lib/storage/r2";
import { d1Query } from "@/lib/db/d1";
import { getSessionUser } from "@/lib/auth/session";

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

  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json(
      { data: null, error: { message: "Files must be 25MB or smaller." } },
      { status: 413 },
    );
  }

  const env = process.env.DEPLOYMENT_TARGET || "local";
  const objectKey = `${env}/users/${user.id}/${bucketAlias}/${path}`.replace(/\/+/g, "/");
  const assetType = file.type.startsWith("image/")
    ? "image"
    : file.type.startsWith("video/")
      ? "video"
      : file.type.startsWith("audio/")
        ? "audio"
        : file.type.includes("pdf") || file.type.includes("document") || file.type.startsWith("text/")
          ? "document"
          : "other";
  const uploaded = await putR2Object({
    key: objectKey,
    body: Buffer.from(await file.arrayBuffer()),
    contentType: file.type || "application/octet-stream",
  });

  const storageObjectId = crypto.randomUUID();
  await d1Query(
    `INSERT OR REPLACE INTO storage_objects
       (id, owner_id, bucket, object_key, public_url, content_type, size_bytes, purpose, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      storageObjectId,
      user.id,
      uploaded.bucket,
      uploaded.key,
      uploaded.publicUrl,
      file.type || "application/octet-stream",
      file.size,
      bucketAlias,
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
      assetType,
      file.name,
      uploaded.publicUrl,
      JSON.stringify({ bucketAlias, objectKey: uploaded.key, contentType: file.type, sizeBytes: file.size }),
    ],
  );

  return NextResponse.json({
    data: { path: uploaded.key, publicUrl: uploaded.publicUrl, assetType },
    error: null,
  });
}
