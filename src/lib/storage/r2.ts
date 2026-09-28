import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { R2Bucket } from "@cloudflare/workers-types";

let client: S3Client | null = null;

function getR2Binding(): R2Bucket | null {
  try {
    return (getCloudflareContext().env as CloudflareEnv & { EDSYNC_ASSETS?: R2Bucket }).EDSYNC_ASSETS ?? null;
  } catch {
    return null;
  }
}

function getR2Client() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing R2 env vars: CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY");
  }

  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  return client;
}

export async function putR2Object(input: {
  key: string;
  body: Buffer;
  contentType?: string;
}) {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error("R2_BUCKET is not set");

  const binding = getR2Binding();
  if (binding) {
    await binding.put(input.key, new Uint8Array(input.body), {
      httpMetadata: input.contentType ? { contentType: input.contentType } : undefined,
    });
  } else {
    await getR2Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
  }

  const baseUrl = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");
  return {
    bucket,
    key: input.key,
    publicUrl: baseUrl ? `${baseUrl}/${input.key}` : input.key,
  };
}
