import { NextResponse } from "next/server";
import { putR2Object } from "@/lib/storage/r2";
import { d1Query } from "@/lib/db/d1";
import { getSessionUser } from "@/lib/auth/session";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { message: "Authentication required." } });
  }

  const form = await request.formData();
  const file = form.get("file");
  const path = String(form.get("path") ?? "");
  const bucketAlias = String(form.get("bucket") ?? "uploads");

  if (!(file instanceof File) || !path) {
    return NextResponse.json({ data: null, error: { message: "File and path are required." } });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ data: null, error: { message: "Files must be 10MB or smaller." } });
  }

  const env = process.env.DEPLOYMENT_TARGET || "local";
  const objectKey = `${env}/users/${user.id}/${bucketAlias}/${path}`.replace(/\/+/g, "/");
  const uploaded = await putR2Object({
    key: objectKey,
    body: Buffer.from(await file.arrayBuffer()),
    contentType: file.type || "application/octet-stream",
  });

  await d1Query(
    `INSERT OR REPLACE INTO storage_objects
       (id, owner_id, bucket, object_key, public_url, content_type, size_bytes, purpose, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      crypto.randomUUID(),
      user.id,
      uploaded.bucket,
      uploaded.key,
      uploaded.publicUrl,
      file.type || "application/octet-stream",
      file.size,
      bucketAlias,
    ],
  );

  return NextResponse.json({
    data: { path: uploaded.key, publicUrl: uploaded.publicUrl },
    error: null,
  });
}
