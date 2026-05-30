import path from "node:path";
import { listTrackedFiles } from "../shared/git";

const allowedSecretLikeFiles = new Set(["config/env/.env.example"]);

const generatedPathSegments = new Set([
  ".next",
  ".open-next",
  ".vercel",
  ".wrangler",
  "coverage",
  "dist",
  "node_modules",
  "out",
]);

const generatedFilePatterns = [
  /\.tsbuildinfo$/i,
  /(?:^|\/)npm-debug\.log/i,
  /(?:^|\/)pnpm-debug\.log/i,
  /(?:^|\/)yarn-debug\.log/i,
  /(?:^|\/)yarn-error\.log/i,
] as const;

const secretFilePatterns = [
  /(?:^|\/)\.env(?:\..*)?$/i,
  /(?:^|\/).+\.local$/i,
] as const;

function normalizeForGit(file: string) {
  return file.split(path.sep).join("/");
}

function hasGeneratedPathSegment(file: string) {
  return file.split("/").some((segment) => generatedPathSegments.has(segment));
}

function matchesAnyPattern(file: string, patterns: readonly RegExp[]) {
  return patterns.some((pattern) => pattern.test(file));
}

function isAllowedSecretLikeFile(file: string) {
  return allowedSecretLikeFiles.has(file);
}

const trackedFiles = listTrackedFiles().map(normalizeForGit);
const generatedArtifacts = trackedFiles
  .filter((file) => hasGeneratedPathSegment(file) || matchesAnyPattern(file, generatedFilePatterns))
  .sort();

const secretLikeFiles = trackedFiles
  .filter((file) => matchesAnyPattern(file, secretFilePatterns))
  .filter((file) => !isAllowedSecretLikeFile(file))
  .sort();

if (generatedArtifacts.length > 0 || secretLikeFiles.length > 0) {
  if (generatedArtifacts.length > 0) {
    console.error("Generated artifacts should not be tracked:");
    for (const file of generatedArtifacts) {
      console.error(`- ${file}`);
    }
  }

  if (secretLikeFiles.length > 0) {
    console.error("Secret-like local files should not be tracked:");
    for (const file of secretLikeFiles) {
      console.error(`- ${file}`);
    }
  }

  process.exit(1);
}

console.log("Tracked files exclude generated artifacts and local secrets.");
