import { loadEnvFile, run } from "../shared/ops";

const APP_WORKER_CONFIG_PATH = "infra/cloudflare/wrangler.app.jsonc";
const AUTOMATION_WORKER_CONFIG_PATH = "infra/cloudflare/wrangler.automation.jsonc";
const OPEN_NEXT_CONFIG_PATH = "infra/cloudflare/open-next.config.ts";

function putWorkerSecret(key: string, config: string) {
  const value = process.env[key];
  if (!value) return;

  run("npx", ["wrangler", "secret", "put", key, "--config", config], { input: `${value}\n` });
}

function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID is required. Wrangler can authenticate through its OAuth login or an API token.");
  }

  run("npx", [
    "opennextjs-cloudflare",
    "build",
    "--config",
    APP_WORKER_CONFIG_PATH,
    "--openNextConfigPath",
    OPEN_NEXT_CONFIG_PATH,
  ]);

  run("npx", ["wrangler", "deploy", "--config", AUTOMATION_WORKER_CONFIG_PATH]);

  run("npx", [
    "opennextjs-cloudflare",
    "deploy",
    "--config",
    APP_WORKER_CONFIG_PATH,
    "--",
    "--keep-vars",
  ]);

  if (process.env.CLOUDFLARE_SKIP_SECRET_SYNC === "1") {
    console.log("Skipping Worker secret sync because CLOUDFLARE_SKIP_SECRET_SYNC=1.");
  } else {
    for (const key of [
      "APP_ENCRYPTION_KEY",
      "CLOUDFLARE_ACCOUNT_ID",
      "CLOUDFLARE_API_TOKEN",
      "CLOUDFLARE_AI_GATEWAY_URL",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "SESSION_SECRET",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "TURNSTILE_SECRET_KEY",
      "TURNSTILE_SITE_KEY",
    ]) {
      putWorkerSecret(key, APP_WORKER_CONFIG_PATH);
    }
  }

  console.log("Cloudflare Worker deployed for edsync.");
}

try {
  main();
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
