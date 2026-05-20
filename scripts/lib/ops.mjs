import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

export function commandForPlatform(command) {
  if (process.platform !== "win32") return command;
  if (command === "npm") return "npm.cmd";
  if (command === "npx") return "npx.cmd";
  return command;
}

export function loadEnvFile(path = ".env.local") {
  if (!existsSync(path)) return {};

  const loaded = {};
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [rawKey, ...rawValue] = trimmed.split("=");
    const key = rawKey?.trim();
    if (!key) continue;
    const value = rawValue.join("=").trim().replace(/^["']|["']$/g, "");
    loaded[key] = value;
    if (!process.env[key]) process.env[key] = value;
  }
  return loaded;
}

export function loadAvailableEnvKeys(paths = [".env.local"]) {
  const keys = new Set(Object.keys(process.env));
  paths.forEach((path) => {
    Object.keys(loadEnvFile(path)).forEach((key) => keys.add(key));
  });
  return keys;
}

function windowsSafeEnv(baseEnv) {
  if (process.platform !== "win32") return baseEnv;

  const env = { ...baseEnv };
  const windowsRoot = env.SystemRoot || "C:\\Windows";
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === "path") || "Path";
  env.ComSpec = env.ComSpec || `${windowsRoot}\\System32\\cmd.exe`;
  env[pathKey] = `${windowsRoot}\\System32;${env[pathKey] || ""}`;
  env.PATH = env[pathKey];
  return env;
}

export function run(command, args, options = {}) {
  const result = spawnSync(commandForPlatform(command), args, {
    cwd: options.cwd,
    env: windowsSafeEnv(options.env ?? process.env),
    input: options.input,
    stdio: options.input ? ["pipe", "inherit", "inherit"] : "inherit",
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
