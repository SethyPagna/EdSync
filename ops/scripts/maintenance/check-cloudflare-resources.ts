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

type CloudflareAppEnv = {
  vars?: Record<string, string>;
  d1_databases?: Array<{ database_name?: string }>;
  r2_buckets?: Array<{ bucket_name?: string }>;
  queues?: { producers?: Array<{ queue?: string }> };
  vectorize?: Array<{ index_name?: string }>;
};

type CloudflareAppConfig = CloudflareAppEnv & {
  env?: Record<string, CloudflareAppEnv>;
};

type ResourceMismatch = {
  env: string;
  expected: string | undefined;
  actual: string | undefined;
  label: string;
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

function readCloudflareAppConfig() {
  return JSON.parse(readFileSync("infra/cloudflare/wrangler.app.jsonc", "utf8")) as CloudflareAppConfig;
}

function collectAppEnvironments(config: CloudflareAppConfig) {
  return [
    { name: "default", env: config },
    ...Object.entries(config.env ?? {}).map(([name, env]) => ({ name, env })),
  ];
}

function compareResource(envName: string, label: string, expected: string | undefined, actual: string | undefined) {
  return expected === actual ? null : { env: envName, label, expected, actual };
}

function collectAppResourceMismatches(config: CloudflareAppConfig) {
  const mismatches: ResourceMismatch[] = [];

  for (const { name, env } of collectAppEnvironments(config)) {
    const vars = env.vars ?? {};
    const checks = [
      compareResource(name, "D1 database", vars.CLOUDFLARE_D1_DATABASE_NAME, env.d1_databases?.[0]?.database_name),
      compareResource(name, "R2 bucket", vars.R2_BUCKET, env.r2_buckets?.[0]?.bucket_name),
      compareResource(name, "Queue", vars.CLOUDFLARE_QUEUE_NAME, env.queues?.producers?.[0]?.queue),
      compareResource(name, "Vectorize index", vars.CLOUDFLARE_VECTORIZE_INDEX, env.vectorize?.[0]?.index_name),
    ];

    mismatches.push(...checks.filter((check): check is ResourceMismatch => Boolean(check)));
  }

  return mismatches.sort((left, right) => `${left.env}:${left.label}`.localeCompare(`${right.env}:${right.label}`));
}

const resources = cloudflareConfigFiles.flatMap(collectResourceValues);
const invalidResources = resources
  .filter((resource) => !resource.value.toLowerCase().startsWith("edsync"))
  .sort((left, right) => `${left.file}:${left.key}`.localeCompare(`${right.file}:${right.key}`));

const forbiddenResources = resources
  .filter((resource) => forbiddenResourcePattern.test(resource.value))
  .sort((left, right) => `${left.file}:${left.key}`.localeCompare(`${right.file}:${right.key}`));
const appResourceMismatches = collectAppResourceMismatches(readCloudflareAppConfig());

if (invalidResources.length > 0 || forbiddenResources.length > 0 || appResourceMismatches.length > 0) {
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
  if (appResourceMismatches.length > 0) {
    console.error("Cloudflare app vars must match Wrangler bindings:");
    for (const mismatch of appResourceMismatches) {
      console.error(`- ${mismatch.env} ${mismatch.label}: var=${mismatch.expected ?? "(missing)"} binding=${mismatch.actual ?? "(missing)"}`);
    }
  }
  process.exit(1);
}

console.log("Cloudflare resource names and app bindings are EdSync-specific.");
