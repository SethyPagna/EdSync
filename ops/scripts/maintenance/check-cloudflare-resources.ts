import { readFileSync } from "node:fs";

const cloudflareConfigFiles = [
  "infra/cloudflare/wrangler.app.jsonc",
  "infra/cloudflare/wrangler.automation.jsonc",
  "infra/cloudflare/wrangler.demo.jsonc",
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
]);

const forbiddenResourcePattern = /\b(?:allchess|learn-(?:assets|automation|d1|learning|prod|preview|dev))\b/i;

type ResourceValue = {
  file: string;
  key: string;
  value: string;
};

type CloudflareAppEnv = {
  vars?: Record<string, string>;
  d1_databases?: Array<{ database_name?: string; database_id?: string }>;
  r2_buckets?: Array<{ bucket_name?: string }>;
  queues?: { producers?: Array<{ queue?: string }>; consumers?: Array<{ queue?: string }> };
  vectorize?: Array<{ index_name?: string }>;
};

type CloudflareAppConfig = CloudflareAppEnv & {
  name?: string;
  services?: Array<{ service?: string }>;
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

function readCloudflareAutomationConfig() {
  return JSON.parse(readFileSync("infra/cloudflare/wrangler.automation.jsonc", "utf8")) as CloudflareAppConfig;
}

function readCloudflareDemoConfig() {
  return JSON.parse(readFileSync("infra/cloudflare/wrangler.demo.jsonc", "utf8")) as CloudflareAppConfig;
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
      compareResource(name, "D1 database ID", vars.CLOUDFLARE_D1_DATABASE_ID, env.d1_databases?.[0]?.database_id),
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
const appConfig = readCloudflareAppConfig();
const automationConfig = readCloudflareAutomationConfig();
const demoConfig = readCloudflareDemoConfig();
const demoResourceMismatches = collectAppResourceMismatches(demoConfig);
const automationResourceMismatches = [
  compareResource("automation", "D1 database", appConfig.d1_databases?.[0]?.database_name, automationConfig.d1_databases?.[0]?.database_name),
  compareResource("automation", "Queue consumer", appConfig.queues?.producers?.[0]?.queue, automationConfig.queues?.consumers?.[0]?.queue),
].filter((check): check is ResourceMismatch => Boolean(check));
const workerNameMismatch = appConfig.name === "edsync" ? null : appConfig.name;
const automationWorkerNameMismatch = automationConfig.name === "edsync-automation" ? null : automationConfig.name;
const demoWorkerNameMismatch = demoConfig.name === "edsync-demo" ? null : demoConfig.name ?? "(missing)";
const serviceMismatches =
  appConfig.services
    ?.map((service) => service.service)
    .filter((service): service is string => Boolean(service) && service !== "edsync") ?? [];
const demoServiceMismatches =
  demoConfig.services
    ?.map((service) => service.service)
    .filter((service): service is string => Boolean(service) && service !== "edsync-demo") ?? [];
const demoIsolationIssues: string[] = [];
const demoVars = demoConfig.vars ?? {};
const prodD1 = appConfig.d1_databases?.[0];
const demoD1 = demoConfig.d1_databases?.[0];
if (demoConfig.env && Object.keys(demoConfig.env).length > 0) {
  demoIsolationIssues.push("Demo uses a single explicit Worker config; named environments are not allowed.");
}
if (demoConfig.d1_databases?.length !== 1 || demoD1?.database_name !== "edsync-demo-d1" || !demoD1?.database_id) {
  demoIsolationIssues.push("Demo must bind exactly one edsync-demo-d1 database with its own ID.");
}
if (demoD1?.database_id && demoD1.database_id === prodD1?.database_id) {
  demoIsolationIssues.push("Demo D1 ID must differ from production D1.");
}
if (demoConfig.r2_buckets?.length || demoConfig.queues?.producers?.length || demoConfig.queues?.consumers?.length || demoConfig.vectorize?.length) {
  demoIsolationIssues.push("Demo must not bind R2, Queue, or Vectorize resources.");
}
if (demoVars.R2_BUCKET || demoVars.CLOUDFLARE_QUEUE_NAME || demoVars.CLOUDFLARE_VECTORIZE_INDEX) {
  demoIsolationIssues.push("Demo must not name R2, Queue, or Vectorize resources.");
}
if (demoVars.EDSYNC_DEMO_MODE !== "1" || demoVars.NEXT_PUBLIC_DEMO_MODE !== "true") {
  demoIsolationIssues.push("Demo mode flags must be enabled.");
}
if (demoVars.EDSYNC_DEMO_HOSTNAME !== "edsync-demo.pagna.workers.dev" || demoVars.NEXT_PUBLIC_APP_URL !== "https://edsync-demo.pagna.workers.dev") {
  demoIsolationIssues.push("Demo host and public URL must point at edsync-demo.pagna.workers.dev.");
}
if (demoConfig.services?.length !== 1 || demoConfig.services[0]?.service !== "edsync-demo") {
  demoIsolationIssues.push("Demo must self-reference only the edsync-demo Worker.");
}
for (const resource of [prodD1?.database_name, prodD1?.database_id, appConfig.r2_buckets?.[0]?.bucket_name, appConfig.queues?.producers?.[0]?.queue, appConfig.vectorize?.[0]?.index_name]) {
  if (resource && JSON.stringify(demoConfig).includes(resource)) {
    demoIsolationIssues.push(`Demo config must not reference production resource ${resource}.`);
  }
}

if (
  invalidResources.length > 0 ||
  forbiddenResources.length > 0 ||
  appResourceMismatches.length > 0 ||
  automationResourceMismatches.length > 0 ||
  demoResourceMismatches.length > 0 ||
  workerNameMismatch ||
  automationWorkerNameMismatch ||
  demoWorkerNameMismatch ||
  serviceMismatches.length > 0 ||
  demoServiceMismatches.length > 0 ||
  demoIsolationIssues.length > 0
) {
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
  if (appResourceMismatches.length > 0 || automationResourceMismatches.length > 0 || demoResourceMismatches.length > 0) {
    console.error("Cloudflare resource names must match Wrangler bindings:");
    for (const mismatch of [...appResourceMismatches, ...automationResourceMismatches, ...demoResourceMismatches]) {
      console.error(`- ${mismatch.env} ${mismatch.label}: var=${mismatch.expected ?? "(missing)"} binding=${mismatch.actual ?? "(missing)"}`);
    }
  }
  if (workerNameMismatch) {
    console.error(`Cloudflare app Worker must stay named edsync, found ${workerNameMismatch}.`);
  }
  if (automationWorkerNameMismatch) {
    console.error(`Cloudflare automation Worker must stay named edsync-automation, found ${automationWorkerNameMismatch}.`);
  }
  if (demoWorkerNameMismatch) {
    console.error(`Cloudflare demo Worker must stay named edsync-demo, found ${demoWorkerNameMismatch}.`);
  }
  if (serviceMismatches.length > 0) {
    console.error("Cloudflare service bindings must point at the single edsync Worker:");
    for (const service of serviceMismatches) {
      console.error(`- service=${service}`);
    }
  }
  if (demoServiceMismatches.length > 0) {
    console.error("Cloudflare demo self-reference must point at edsync-demo:");
    for (const service of demoServiceMismatches) console.error(`- service=${service}`);
  }
  for (const issue of demoIsolationIssues) console.error(issue);
  process.exit(1);
}

console.log("Cloudflare app, demo, and automation Worker bindings are EdSync-specific and isolated.");
