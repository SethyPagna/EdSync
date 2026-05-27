import { loadAvailableEnvKeys, run } from "./lib/ops";

const requiredEnv = [
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_D1_DATABASE_ID",
  "CLOUDFLARE_API_TOKEN",
  "SESSION_SECRET",
  "APP_ENCRYPTION_KEY",
];

const prod = process.argv.includes("--prod");
const skipBuild = process.argv.includes("--skip-build");
const prebuilt = process.argv.includes("--prebuilt");
const envKeys = loadAvailableEnvKeys([".env.local"]);
const missing = requiredEnv.filter((key) => !envKeys.has(key));

if (missing.length > 0) {
  console.error(
    `Missing required env keys: ${missing.join(", ")}. Add them to .env.local and Vercel Project Settings.`,
  );
  process.exit(1);
}

if (!skipBuild) {
  run("npm", ["run", "typecheck"]);
  run("npm", ["run", "build"]);
}

const token = process.env.VERCEL_TOKEN;
const tokenArgs = token ? ["--token", token] : [];
const environment = prod ? "production" : "preview";

run("npx", ["vercel", "pull", "--yes", `--environment=${environment}`, ...tokenArgs]);
if (prebuilt) {
  run("npx", ["vercel", "build", ...(prod ? ["--prod"] : []), ...tokenArgs]);
  run("npx", ["vercel", "deploy", "--prebuilt", ...(prod ? ["--prod"] : []), ...tokenArgs]);
} else {
  run("npx", ["vercel", "deploy", "--yes", ...(prod ? ["--prod"] : []), ...tokenArgs]);
}
