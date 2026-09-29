import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "../shared/ops";

export const APP_WORKER_CONFIG_PATH = "infra/cloudflare/wrangler.app.jsonc";
const OPEN_NEXT_CONFIG_PATH = "infra/cloudflare/open-next.config.ts";

type CloudflareAppConfig = {
  vars?: Record<string, unknown>;
};

export function applyPublicBuildVars(vars: Record<string, unknown>, targetEnv: NodeJS.ProcessEnv) {
  for (const [key, value] of Object.entries(vars)) {
    if (key.startsWith("NEXT_PUBLIC_") && typeof value === "string" && targetEnv[key] === undefined) {
      targetEnv[key] = value;
    }
  }
}

export function buildCloudflareApp() {
  const config = JSON.parse(readFileSync(APP_WORKER_CONFIG_PATH, "utf8")) as CloudflareAppConfig;
  applyPublicBuildVars(config.vars ?? {}, process.env);
  run("npx", [
    "opennextjs-cloudflare",
    "build",
    "--config",
    APP_WORKER_CONFIG_PATH,
    "--openNextConfigPath",
    OPEN_NEXT_CONFIG_PATH,
  ]);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildCloudflareApp();
}
