import { readFileSync } from "node:fs";

const cloudflareConfigFiles = [
  "infra/cloudflare/wrangler.app.jsonc",
  "infra/cloudflare/wrangler.toml",
];

const resourceKeys = new Set([
  "name",
  "service",
  "database_name",
  "bucket_name",
  "queue",
  "index_name",
  "CLOUDFLARE_D1_DATABASE_NAME",
  "R2_BUCKET",
  "CLOUDFLARE_QUEUE_NAME",
  "CLOUDFLARE_VECTORIZE_INDEX",
  "CLOUDFLARE_PAGES_PROJECT",
]);

const forbiddenResourcePattern = /\b(?:allchess|learn-(?:assets|automation|d1|learning|prod|preview|dev))\b/i;

type ResourceValue = {
  file: string;
  key: string;
  value: string;
};

function collectResourceValues(file: string): ResourceValue[] {
  const text = readFileSync(file, "utf8");
  const values: ResourceValue[] = [];
  const quotedAssignmentPattern = /["']?([A-Z0-9_.$-]+)["']?\s*[:=]\s*"([^"]+)"/gi;

  for (const match of text.matchAll(quotedAssignmentPattern)) {
    const key = match[1];
    const value = match[2];
    if (!key || !value || !resourceKeys.has(key)) continue;
    values.push({ file, key, value });
  }

  return values;
}

const resources = cloudflareConfigFiles.flatMap(collectResourceValues);
const invalidResources = resources
  .filter((resource) => !resource.value.toLowerCase().startsWith("edsync"))
  .sort((left, right) => `${left.file}:${left.key}`.localeCompare(`${right.file}:${right.key}`));

const forbiddenResources = resources
  .filter((resource) => forbiddenResourcePattern.test(resource.value))
  .sort((left, right) => `${left.file}:${left.key}`.localeCompare(`${right.file}:${right.key}`));

if (invalidResources.length > 0 || forbiddenResources.length > 0) {
  if (invalidResources.length > 0) {
    console.error("Cloudflare resource names must stay EdSync-specific:");
    for (const resource of invalidResources) {
      console.error(`- ${resource.file} ${resource.key}=${resource.value}`);
    }
  }
  if (forbiddenResources.length > 0) {
    console.error("Cloudflare resource names must not reuse AllChess or LEARN resources:");
    for (const resource of forbiddenResources) {
      console.error(`- ${resource.file} ${resource.key}=${resource.value}`);
    }
  }
  process.exit(1);
}

console.log("Cloudflare resource names are EdSync-specific.");
