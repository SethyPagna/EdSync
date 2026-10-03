import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import test, { type TestContext } from "node:test";
import {
  APP_WORKER_CONFIG_PATH,
  DEMO_WORKER_CONFIG_PATH,
  applyDeploymentBuildVars,
  applyPublicBuildVars,
  assertSafeOpenNextBuild,
  withPrivateEnvFilesHidden,
  workerConfigPathFromArgs,
} from "./cloudflare-build";

type CloudflareAppConfig = { vars?: Record<string, unknown> };

test("Cloudflare public variables are present at Next build time", () => {
  const config = JSON.parse(readFileSync("infra/cloudflare/wrangler.app.jsonc", "utf8")) as CloudflareAppConfig;
  const env: NodeJS.ProcessEnv = { NODE_ENV: "test", NEXT_PUBLIC_THEME_DEFAULT: "dark" };

  applyPublicBuildVars(config.vars ?? {}, env);

  assert.equal(env.NEXT_PUBLIC_THEME_DEFAULT, "dark");
  assert.equal(env.NEXT_PUBLIC_PWA_ENABLED, "true");
  assert.equal(env.NEXT_PUBLIC_APP_URL, "https://edsync.pagna.workers.dev");
  assert.equal(env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL, config.vars?.NEXT_PUBLIC_R2_PUBLIC_BASE_URL);
  assert.equal(env.R2_BUCKET, undefined);
  assert.equal(env.APP_ENCRYPTION_KEY, undefined);
  assert.equal(env.SESSION_SECRET, undefined);
});

test("demo build selects its own D1 and clears inherited production resource values", () => {
  const config = JSON.parse(readFileSync(DEMO_WORKER_CONFIG_PATH, "utf8")) as CloudflareAppConfig;
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: "test",
    NEXT_PUBLIC_APP_URL: "https://edsync.pagna.workers.dev",
    NEXT_PUBLIC_R2_PUBLIC_BASE_URL: "https://production-assets.example.com",
    CLOUDFLARE_D1_DATABASE_ID: "production-database-id",
    R2_BUCKET: "edsync-assets-prod",
    CLOUDFLARE_QUEUE_NAME: "edsync-automation-prod",
    CLOUDFLARE_VECTORIZE_INDEX: "edsync-learning-prod",
  };

  applyDeploymentBuildVars(config.vars ?? {}, env);

  assert.equal(workerConfigPathFromArgs(["--config", DEMO_WORKER_CONFIG_PATH]), DEMO_WORKER_CONFIG_PATH);
  assert.equal(env.NEXT_PUBLIC_APP_URL, "https://edsync-demo.pagna.workers.dev");
  assert.equal(env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL, "");
  assert.equal(env.CLOUDFLARE_D1_DATABASE_ID, config.vars?.CLOUDFLARE_D1_DATABASE_ID);
  assert.equal(env.EDSYNC_DEMO_MODE, "1");
  assert.equal(env.R2_BUCKET, undefined);
  assert.equal(env.CLOUDFLARE_QUEUE_NAME, undefined);
  assert.equal(env.CLOUDFLARE_VECTORIZE_INDEX, undefined);
});

test("production build clears inherited demo mode", () => {
  const config = JSON.parse(readFileSync(APP_WORKER_CONFIG_PATH, "utf8")) as CloudflareAppConfig;
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: "test",
    EDSYNC_DEMO_MODE: "1",
    EDSYNC_DEMO_HOSTNAME: "edsync-demo.pagna.workers.dev",
    NEXT_PUBLIC_DEMO_MODE: "true",
  };

  applyDeploymentBuildVars(config.vars ?? {}, env);

  assert.equal(workerConfigPathFromArgs([]), APP_WORKER_CONFIG_PATH);
  assert.equal(env.EDSYNC_DEMO_MODE, undefined);
  assert.equal(env.EDSYNC_DEMO_HOSTNAME, undefined);
  assert.equal(env.NEXT_PUBLIC_DEMO_MODE, undefined);
  assert.equal(env.CLOUDFLARE_D1_DATABASE_ID, config.vars?.CLOUDFLARE_D1_DATABASE_ID);
  assert.throws(() => workerConfigPathFromArgs(["--config", "infra/cloudflare/wrangler.automation.jsonc"]), /Use --config/);
});

function temporaryRoot(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), "edsync-cloudflare-build-"));
  t.after(() => {
    if (!resolve(root).startsWith(`${resolve(tmpdir())}${sep}`)) throw new Error("Refusing to clean outside the temporary directory.");
    rmSync(root, { recursive: true, force: true });
  });
  return root;
}

test("private env files are hidden during the build and restored afterward", (t) => {
  const root = temporaryRoot(t);
  const source = join(root, ".env.local");
  const content = "APP_ENCRYPTION_KEY=sample-private-key-value\n";
  writeFileSync(source, content);

  withPrivateEnvFilesHidden(root, (values) => {
    assert.equal(existsSync(source), false);
    assert.equal(existsSync(join(root, ".wrangler", "edsync-open-next-env-hold", ".env.local")), true);
    assert.equal(values.get("APP_ENCRYPTION_KEY"), "sample-private-key-value");
  });

  assert.equal(readFileSync(source, "utf8"), content);
  assert.equal(existsSync(join(root, ".wrangler", "edsync-open-next-env-hold", ".env.local")), false);
  assert.equal(existsSync(join(root, ".wrangler", "edsync-open-next-env-hold", "build.lock")), false);
});

test("private env files are restored when the build fails", (t) => {
  const root = temporaryRoot(t);
  const source = join(root, ".env.production.local");
  writeFileSync(source, "SESSION_SECRET=sample-session-secret\n");

  assert.throws(() => withPrivateEnvFilesHidden(root, () => {
    assert.equal(existsSync(source), false);
    throw new Error("simulated build failure");
  }), /simulated build failure/);

  assert.equal(readFileSync(source, "utf8"), "SESSION_SECRET=sample-session-secret\n");
});

test("rejects secret-bearing or stale OpenNext output without exposing values", (t) => {
  const root = temporaryRoot(t);
  const output = join(root, ".open-next");
  const cloudflare = join(output, "cloudflare");
  mkdirSync(cloudflare, { recursive: true });
  const envModule = join(cloudflare, "next-env.mjs");
  const worker = join(output, "worker.js");
  const emptyModes = "export const production = {};\nexport const development = {};\nexport const test = {};\n";
  const secret = "sample-secret-value-123";
  const values = new Map([["SESSION_SECRET", secret]]);
  writeFileSync(envModule, emptyModes);
  writeFileSync(worker, "export default {};");
  assert.doesNotThrow(() => assertSafeOpenNextBuild(output, values));

  writeFileSync(worker, `export const leaked = ${JSON.stringify(secret)};`);
  assert.throws(() => assertSafeOpenNextBuild(output, values), (error: unknown) => {
    assert.equal(String(error).includes(secret), false);
    return /private value from SESSION_SECRET/.test(String(error));
  });

  writeFileSync(worker, "export default {};");
  writeFileSync(envModule, `${emptyModes}export const production = {};\n`);
  assert.throws(() => assertSafeOpenNextBuild(output, values), /stale or malformed/);

  writeFileSync(envModule, "export const production = {\"SESSION_SECRET\":\"hidden\"};\nexport const development = {};\nexport const test = {};\n");
  assert.throws(() => assertSafeOpenNextBuild(output, values), /embedded an environment file/);
});
