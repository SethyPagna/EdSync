import path from "node:path";
import { listTrackedFiles } from "../shared/git";

const allowedRuntimeConfigFiles = new Set([
  "config/eslint/eslint.config.mjs",
  "next.config.mjs",
]);

const legacyJavaScriptPattern = /\.(?:cjs|js|jsx|mjs)$/;

function normalizeForGit(file: string) {
  return file.split(path.sep).join("/");
}

function main() {
  const unexpectedJavaScript = listTrackedFiles()
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
