import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const requiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "OPENROUTER_API_KEY",
];

function loadLocalEnvKeys() {
  const keys = new Set(Object.keys(process.env));
  if (!existsSync(".env.local")) return keys;

  const lines = readFileSync(".env.local", "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    keys.add(trimmed.split("=")[0]?.trim());
  }
  return keys;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const prod = process.argv.includes("--prod");
const skipBuild = process.argv.includes("--skip-build");
const envKeys = loadLocalEnvKeys();
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

const vercelArgs = ["vercel"];
const token = process.env.VERCEL_TOKEN;
const tokenArgs = token ? ["--token", token] : [];
const environment = prod ? "production" : "preview";

run("npx", [
  ...vercelArgs,
  "pull",
  "--yes",
  `--environment=${environment}`,
  ...tokenArgs,
]);

run("npx", [...vercelArgs, "build", ...(prod ? ["--prod"] : []), ...tokenArgs]);

run("npx", [
  ...vercelArgs,
  "deploy",
  "--prebuilt",
  ...(prod ? ["--prod"] : []),
  ...tokenArgs,
]);
