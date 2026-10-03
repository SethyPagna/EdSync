import { loadEnvFile, run } from "../shared/ops";
import { APP_WORKER_CONFIG_PATH, buildCloudflareApp } from "./cloudflare-build";

function putWorkerSecret(key: string, config: string) {
  const value = process.env[key];
  if (!value) return;

  run("npx", ["wrangler", "secret", "put", key, "--config", config], { input: `${value}\n` });
}

function main() {
  if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID is required in the process environment. Wrangler can authenticate through its OAuth login or an API token.");
  }

  buildCloudflareApp();

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
    loadEnvFile(".env.local");
    loadEnvFile(".env");
    for (const key of [
      "APP_ENCRYPTION_KEY",
      "CLOUDFLARE_ACCOUNT_ID",
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
