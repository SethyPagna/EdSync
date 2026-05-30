import { spawnSync } from "node:child_process";
import path from "node:path";
import { commandForPlatform } from "../shared/ops";

const allowedRuntimeConfigFiles = new Set([
  "config/eslint/eslint.config.mjs",
  "next.config.mjs",
]);

const legacyJavaScriptPattern = /\.(?:cjs|js|jsx|mjs)$/;

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
  return result.stdout.split(/\r?\n/).filter(Boolean);
}

function normalizeForGit(file: string) {
  return file.split(path.sep).join("/");
}

function main() {
  const unexpectedJavaScript = listGitTrackedFiles()
    .map(normalizeForGit)
    .filter((file) => legacyJavaScriptPattern.test(file))
    .filter((file) => !allowedRuntimeConfigFiles.has(file))
    .sort();

  if (unexpectedJavaScript.length > 0) {
    console.error(`Unexpected tracked JavaScript files: ${unexpectedJavaScript.join(", ")}`);
    process.exit(1);
  }

  console.log("Tracked source files are TypeScript-first.");
  console.log(`Allowed runtime JavaScript configs: ${[...allowedRuntimeConfigFiles].sort().join(", ")}`);
}

main();
