import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { commandForPlatform } from "../shared/ops";

const allowedTrackedRootFiles = new Set([
  ".gitignore",
  "AGENTS.md",
  "README.md",
  "next-env.d.ts",
  "next.config.mjs",
  "package-lock.json",
  "package.json",
  "tsconfig.json",
  "vercel.json",
]);

const allowedTrackedRootDirs = new Set([
  ".github",
  "config",
  "infra",
  "ops",
  "public",
  "src",
]);

const allowedIgnoredRootEntries = new Set([
  ".env.local",
  ".next",
  ".open-next",
  ".vercel",
  ".wrangler",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "tsconfig.tsbuildinfo",
]);

function listGitTrackedFiles() {
  const result = spawnSync(commandForPlatform("git"), ["ls-files"], {
    encoding: "utf8",
  });
  if (result.error) {
    throw new Error(`Failed to inspect tracked files: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || `git ls-files exited with status ${result.status ?? 1}`);
  }
  const output = result.stdout;
  return output.split(/\r?\n/).filter(Boolean).map((file) => file.replaceAll("/", path.sep));
}

function findUnexpectedTrackedRootEntries(files: string[]) {
  const rootFiles = new Set<string>();
  const rootDirs = new Set<string>();

  for (const file of files) {
    const [rootEntry, ...rest] = file.split(path.sep);
    if (!rootEntry) continue;
    if (rest.length === 0) {
      rootFiles.add(rootEntry);
    } else {
      rootDirs.add(rootEntry);
    }
  }

  return {
    files: [...rootFiles].filter((file) => !allowedTrackedRootFiles.has(file)).sort(),
    dirs: [...rootDirs].filter((dir) => !allowedTrackedRootDirs.has(dir)).sort(),
  };
}

async function listAllowedIgnoredRootEntries() {
  const entries = await readdir(process.cwd(), { withFileTypes: true });
  return entries
    .map((entry) => entry.name)
    .filter((name) => allowedIgnoredRootEntries.has(name))
    .sort();
}

async function main() {
  const trackedFiles = listGitTrackedFiles();
  const unexpected = findUnexpectedTrackedRootEntries(trackedFiles);

  if (unexpected.files.length > 0 || unexpected.dirs.length > 0) {
    if (unexpected.files.length > 0) {
      console.error(`Unexpected tracked root files: ${unexpected.files.join(", ")}`);
    }
    if (unexpected.dirs.length > 0) {
      console.error(`Unexpected tracked root folders: ${unexpected.dirs.join(", ")}`);
    }
    process.exit(1);
  }

  const ignoredEntries = await listAllowedIgnoredRootEntries();
  console.log("Tracked root layout is compact.");
  console.log(`Allowed tracked root files: ${[...allowedTrackedRootFiles].sort().join(", ")}`);
  console.log(`Allowed tracked root folders: ${[...allowedTrackedRootDirs].sort().join(", ")}`);
  if (ignoredEntries.length > 0) {
    console.log(`Ignored local root artifacts present: ${ignoredEntries.join(", ")}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
