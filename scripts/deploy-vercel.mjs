import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const requiredEnv = [
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_D1_DATABASE_ID",
  "CLOUDFLARE_API_TOKEN",
  "SESSION_SECRET",
  "APP_ENCRYPTION_KEY",
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

function commandForPlatform(command) {
  if (process.platform !== "win32") return command;
  if (command === "npm") return "npm.cmd";
  if (command === "npx") return "npx.cmd";
  return command;
}

function run(command, args) {
  const env = { ...process.env };
  if (process.platform === "win32") {
    const windowsRoot = env.SystemRoot || "C:\\Windows";
    const pathKey = Object.keys(env).find((key) => key.toLowerCase() === "path") || "Path";
    env.ComSpec = env.ComSpec || `${windowsRoot}\\System32\\cmd.exe`;
    env[pathKey] = `${windowsRoot}\\System32;${env[pathKey] || ""}`;
    env.PATH = env[pathKey];
  }

  const result = spawnSync(command, args, {
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) {
    console.error(`Failed to run ${command} ${args.join(" ")}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`${command} ${args.join(" ")} exited with status ${result.status ?? 1}.`);
    process.exit(result.status ?? 1);
  }
}

const prod = process.argv.includes("--prod");
const skipBuild = process.argv.includes("--skip-build");
const prebuilt = process.argv.includes("--prebuilt");
const envKeys = loadLocalEnvKeys();
const missing = requiredEnv.filter((key) => !envKeys.has(key));

if (missing.length > 0) {
  console.error(
    `Missing required env keys: ${missing.join(", ")}. Add them to .env.local and Vercel Project Settings.`,
  );
  process.exit(1);
}

if (!skipBuild) {
  run(commandForPlatform("npm"), ["run", "typecheck"]);
  run(commandForPlatform("npm"), ["run", "build"]);
}

const token = process.env.VERCEL_TOKEN;
const tokenArgs = token ? ["--token", token] : [];
const environment = prod ? "production" : "preview";

run(commandForPlatform("npx"), ["vercel", "pull", "--yes", `--environment=${environment}`, ...tokenArgs]);
if (prebuilt) {
  run(commandForPlatform("npx"), ["vercel", "build", ...(prod ? ["--prod"] : []), ...tokenArgs]);
  run(commandForPlatform("npx"), ["vercel", "deploy", "--prebuilt", ...(prod ? ["--prod"] : []), ...tokenArgs]);
} else {
  run(commandForPlatform("npx"), ["vercel", "deploy", "--yes", ...(prod ? ["--prod"] : []), ...tokenArgs]);
}
