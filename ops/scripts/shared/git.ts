import { spawnSync } from "node:child_process";
import { commandForPlatform } from "./ops";

export function listTrackedFiles() {
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
