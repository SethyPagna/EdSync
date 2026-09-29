import { spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, unlinkSync, writeSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { commandForPlatform } from "../shared/ops";

export const APP_WORKER_CONFIG_PATH = "infra/cloudflare/wrangler.app.jsonc";
const OPEN_NEXT_CONFIG_PATH = "infra/cloudflare/open-next.config.ts";
const PRIVATE_ENV_FILES = [
  ".env",
  ".env.local",
  ".env.production",
  ".env.production.local",
  ".env.development",
  ".env.development.local",
  ".env.test",
  ".env.test.local",
];
const SECRET_NAME = /(?:SECRET|PASSWORD|TOKEN|API_KEY|PRIVATE_KEY|CREDENTIAL)/i;

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

function activeProcess(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

export function withPrivateEnvFilesHidden<T>(root: string, action: (privateValues: ReadonlyMap<string, string>) => T): T {
  const holdDir = join(root, ".wrangler", "edsync-open-next-env-hold");
  const lockPath = join(holdDir, "build.lock");
  mkdirSync(holdDir, { recursive: true });

  if (existsSync(lockPath)) {
    const previousPid = Number(readFileSync(lockPath, "utf8"));
    if (!Number.isSafeInteger(previousPid) || activeProcess(previousPid)) {
      throw new Error(`Another Cloudflare build may be active. Check ${lockPath} before retrying.`);
    }
    unlinkSync(lockPath);
  }

  const lock = openSync(lockPath, "wx");
  const hidden: Array<{ original: string; held: string }> = [];
  try {
    writeSync(lock, String(process.pid));
    for (const name of PRIVATE_ENV_FILES) {
      const original = join(root, name);
      const held = join(holdDir, name);
      if (existsSync(held)) {
        if (existsSync(original)) {
          throw new Error(`Both ${original} and its build hold exist. Resolve them before building.`);
        }
        renameSync(held, original);
      }
    }

    const values = privateBuildValues(root, process.env);
    for (const name of PRIVATE_ENV_FILES) {
      const original = join(root, name);
      if (!existsSync(original)) continue;
      const held = join(holdDir, name);
      renameSync(original, held);
      hidden.push({ original, held });
    }

    return action(values);
  } finally {
    try {
      for (const { original, held } of hidden.reverse()) {
        if (existsSync(original)) {
          throw new Error(`Cannot restore ${original}: a new file appeared during the build.`);
        }
        renameSync(held, original);
      }
    } finally {
      closeSync(lock);
      unlinkSync(lockPath);
    }
  }
}

function privateBuildValues(root: string, environment: NodeJS.ProcessEnv) {
  const values = new Map<string, string>();
  for (const name of PRIVATE_ENV_FILES) {
    const path = join(root, name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match || match[1].startsWith("NEXT_PUBLIC_")) continue;
      const key = match[1];
      const raw = match[2].trim();
      const value = raw.length >= 2 && ((raw[0] === '"' && raw.at(-1) === '"') || (raw[0] === "'" && raw.at(-1) === "'"))
        ? raw.slice(1, -1)
        : raw;
      if (value && (value.length >= 8 || SECRET_NAME.test(key))) values.set(key, value);
    }
  }
  for (const [key, value] of Object.entries(environment)) {
    if (!value || !SECRET_NAME.test(key)) continue;
    if (values.has(key) && values.get(key) !== value) {
      values.set(`${key} (process environment)`, value);
    } else {
      values.set(key, value);
    }
  }
  return values;
}

export function assertSafeOpenNextBuild(outputDir: string, privateValues: ReadonlyMap<string, string>) {
  const envModule = join(outputDir, "cloudflare", "next-env.mjs");
  const worker = join(outputDir, "worker.js");
  if (!existsSync(envModule) || !existsSync(worker)) {
    throw new Error("OpenNext build is incomplete; refusing to deploy.");
  }

  const lines = readFileSync(envModule, "utf8").trim().split(/\r?\n/);
  const modes = new Set(["production", "development", "test"]);
  if (lines.length !== modes.size) throw new Error("OpenNext environment module is stale or malformed; refusing to deploy.");
  for (const line of lines) {
    const match = line.match(/^export const (production|development|test) = (\{.*\});$/);
    let parsed: unknown;
    try {
      parsed = match ? JSON.parse(match[2]) : null;
    } catch {
      throw new Error("OpenNext environment module is malformed; refusing to deploy.");
    }
    if (!match || !modes.delete(match[1]) || !parsed || typeof parsed !== "object" || Array.isArray(parsed) || Object.keys(parsed).length !== 0) {
      throw new Error("OpenNext embedded an environment file in the Worker; refusing to deploy.");
    }
  }

  const candidates = [...privateValues].map(([key, value]) => [key, Buffer.from(value)] as const);
  const scan = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Unexpected symbolic link in ${relative(outputDir, path)}.`);
      if (entry.isDirectory()) {
        scan(path);
        continue;
      }
      if (!entry.isFile()) continue;
      const content = readFileSync(path);
      for (const [key, value] of candidates) {
        if (content.includes(value)) {
          throw new Error(`OpenNext output ${relative(outputDir, path)} contains a private value from ${key}; refusing to deploy.`);
        }
      }
    }
  };
  scan(outputDir);
}

function buildChildEnvironment() {
  if (process.platform !== "win32") return process.env;
  const env = { ...process.env };
  const windowsRoot = env.SystemRoot || "C:\\Windows";
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === "path") || "Path";
  env.ComSpec ||= `${windowsRoot}\\System32\\cmd.exe`;
  env[pathKey] = `${windowsRoot}\\System32;${env[pathKey] || ""}`;
  env.PATH = env[pathKey];
  return env;
}

function runOpenNextBuild() {
  const args = ["opennextjs-cloudflare", "build", "--config", APP_WORKER_CONFIG_PATH, "--openNextConfigPath", OPEN_NEXT_CONFIG_PATH];
  const result = spawnSync(commandForPlatform("npx"), args, {
    env: buildChildEnvironment(),
    shell: process.platform === "win32",
    stdio: "inherit",
  });
  if (result.error) throw new Error(`Could not start OpenNext build: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`OpenNext build exited with status ${result.status ?? "unknown"}.`);
}

export function buildCloudflareApp() {
  const config = JSON.parse(readFileSync(APP_WORKER_CONFIG_PATH, "utf8")) as CloudflareAppConfig;
  applyPublicBuildVars(config.vars ?? {}, process.env);
  const root = resolve(".");
  withPrivateEnvFilesHidden(root, (values) => {
    runOpenNextBuild();
    assertSafeOpenNextBuild(join(root, ".open-next"), values);
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildCloudflareApp();
}
