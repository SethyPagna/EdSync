import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { applyPublicBuildVars } from "./cloudflare-build";

type CloudflareAppConfig = { vars?: Record<string, unknown> };

test("Cloudflare public variables are present at Next build time", () => {
  const config = JSON.parse(readFileSync("infra/cloudflare/wrangler.app.jsonc", "utf8")) as CloudflareAppConfig;
  const env: NodeJS.ProcessEnv = { NODE_ENV: "test", NEXT_PUBLIC_THEME_DEFAULT: "dark" };

  applyPublicBuildVars(config.vars ?? {}, env);

  assert.equal(env.NEXT_PUBLIC_THEME_DEFAULT, "dark");
  assert.equal(env.NEXT_PUBLIC_PWA_ENABLED, "true");
  assert.equal(env.NEXT_PUBLIC_APP_URL, "https://edsync.learn-app.workers.dev");
  assert.equal(env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL, config.vars?.NEXT_PUBLIC_R2_PUBLIC_BASE_URL);
  assert.equal(env.R2_BUCKET, undefined);
  assert.equal(env.APP_ENCRYPTION_KEY, undefined);
  assert.equal(env.SESSION_SECRET, undefined);
});
