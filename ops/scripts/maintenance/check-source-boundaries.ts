import { readFileSync } from "node:fs";
import path from "node:path";
import { listTrackedFiles } from "../shared/git";

type BoundaryIssue = {
  file: string;
  importPath: string;
  reason: string;
};

const sourceFilePattern = /^src\/.*\.(?:ts|tsx)$/;
const importPattern =
  /(?:import|export)\s+(?:type\s+)?(?:[^"'()]*?\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|require\(\s*["']([^"']+)["']\s*\)/g;

const blockedRuntimeRoots = new Set(["config", "infra", "ops", "public"]);

function normalizeForGit(file: string) {
  return file.split(path.sep).join("/");
}

function readSourceFile(file: string) {
  return readFileSync(file, "utf8");
}

function collectImportSpecifiers(content: string) {
  return [...content.matchAll(importPattern)]
    .map((match) => match[1] ?? match[2] ?? match[3])
    .filter((importPath): importPath is string => Boolean(importPath));
}

function isRelativeImport(importPath: string) {
  return importPath.startsWith("./") || importPath.startsWith("../");
}

function isSourceAliasImport(importPath: string) {
  return importPath === "@" || importPath.startsWith("@/");
}

function resolveRelativeImport(file: string, importPath: string) {
  const directory = path.posix.dirname(file);
  return path.posix.normalize(path.posix.join(directory, importPath));
}

function firstPathSegment(importPath: string) {
  return importPath.split("/")[0] ?? "";
}

function inspectImport(file: string, importPath: string): BoundaryIssue | null {
  if (isSourceAliasImport(importPath)) return null;

  if (blockedRuntimeRoots.has(firstPathSegment(importPath))) {
    return {
      file,
      importPath,
      reason: "imports a non-runtime owner folder directly",
    };
  }

  if (!isRelativeImport(importPath)) return null;

  const resolvedPath = resolveRelativeImport(file, importPath);
  if (!resolvedPath.startsWith("src/") && resolvedPath !== "src") {
    return {
      file,
      importPath,
      reason: `resolves outside src to ${resolvedPath}`,
    };
  }

  return null;
}

const issues: BoundaryIssue[] = [];

for (const file of listTrackedFiles().map(normalizeForGit).filter((trackedFile) => sourceFilePattern.test(trackedFile))) {
  const content = readSourceFile(file);
  for (const importPath of collectImportSpecifiers(content)) {
    const issue = inspectImport(file, importPath);
    if (issue) {
      issues.push(issue);
    }
  }
}

if (issues.length > 0) {
  console.error("Source files cross runtime owner boundaries:");
  for (const issue of issues.sort((left, right) => `${left.file}:${left.importPath}`.localeCompare(`${right.file}:${right.importPath}`))) {
    console.error(`- ${issue.file}: ${issue.importPath} (${issue.reason})`);
  }
  process.exit(1);
}

console.log("Source imports stay inside runtime source boundaries.");
