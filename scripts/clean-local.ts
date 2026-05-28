import { rm, stat } from "node:fs/promises";
import path from "node:path";

const workspaceRoot = process.cwd();
const includeNodeModules = process.argv.includes("--include-node-modules");
const dryRun = process.argv.includes("--dry-run");

const generatedTargets = [
  ".next",
  ".open-next",
  ".vercel/output",
  ".wrangler",
  ".turbo",
  ".cache",
  "coverage",
  "dist",
  "out",
  "tsconfig.tsbuildinfo",
];

const targets = includeNodeModules ? [...generatedTargets, "node_modules"] : generatedTargets;

function resolveInsideWorkspace(target: string) {
  const resolved = path.resolve(workspaceRoot, target);
  const relative = path.relative(workspaceRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to clean outside workspace: ${target}`);
  }
  return resolved;
}

async function exists(target: string) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

let removedCount = 0;
async function main() {
  for (const target of targets) {
    const resolved = resolveInsideWorkspace(target);
    if (!(await exists(resolved))) continue;
    removedCount += 1;
    console.log(`${dryRun ? "Would remove" : "Removing"} ${target}`);
    if (!dryRun) {
      await rm(resolved, { recursive: true, force: true });
    }
  }

  if (removedCount === 0) {
    console.log("No generated local artifacts found.");
  }

  if (!includeNodeModules) {
    console.log("Kept node_modules. Run npm.cmd run clean:all to remove dependencies too.");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
