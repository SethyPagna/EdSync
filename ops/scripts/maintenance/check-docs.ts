import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

type PackageJson = {
  scripts?: Record<string, string>;
};

type MissingPath = {
  path: string;
  reason: "missing" | "expected directory" | "expected file";
};

const trackedDocumentationFiles = ["README.md"] as const;
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as PackageJson;
const scripts = new Set(Object.keys(packageJson.scripts ?? {}));

const commandPattern = /\bnpm\.cmd\s+run\s+([a-z0-9:_-]+)/gi;
const trackedPathPattern =
  /`((?:\.github|config|infra|ops|public|src)\/[^`]+|(?:AGENTS|README)\.md|next-env\.d\.ts|next\.config\.mjs|package(?:-lock)?\.json|tsconfig\.json|vercel\.json)`/g;

function normalizeDocumentPath(reference: string) {
  return reference
    .replace(/[.,;:]$/g, "")
    .replace(/\\/g, "/");
}

function resolveDocumentPath(reference: string) {
  return path.resolve(process.cwd(), reference.replaceAll("/", path.sep));
}

function collectReferencedScripts(content: string) {
  return [...content.matchAll(commandPattern)]
    .map((match) => match[1])
    .filter((script): script is string => Boolean(script));
}

function collectReferencedPaths(content: string) {
  return [...content.matchAll(trackedPathPattern)]
    .map((match) => match[1])
    .filter((reference): reference is string => Boolean(reference))
    .map(normalizeDocumentPath);
}

function findMissingPath(reference: string): MissingPath | null {
  const absolutePath = resolveDocumentPath(reference);

  if (!existsSync(absolutePath)) {
    return { path: reference, reason: "missing" };
  }

  const stats = statSync(absolutePath);
  if (reference.endsWith("/") && !stats.isDirectory()) {
    return { path: reference, reason: "expected directory" };
  }
  if (!reference.endsWith("/") && !stats.isFile() && !stats.isDirectory()) {
    return { path: reference, reason: "expected file" };
  }

  return null;
}

const missingScripts = new Set<string>();
const missingPaths: MissingPath[] = [];

for (const documentationFile of trackedDocumentationFiles) {
  const content = readFileSync(documentationFile, "utf8");

  for (const script of collectReferencedScripts(content)) {
    if (!scripts.has(script)) {
      missingScripts.add(script);
    }
  }

  for (const reference of collectReferencedPaths(content)) {
    const missing = findMissingPath(reference);
    if (missing) {
      missingPaths.push(missing);
    }
  }
}

if (missingScripts.size > 0 || missingPaths.length > 0) {
  if (missingScripts.size > 0) {
    console.error("Documentation references missing package scripts:");
    for (const script of [...missingScripts].sort()) {
      console.error(`- npm.cmd run ${script}`);
    }
  }

  if (missingPaths.length > 0) {
    console.error("Documentation references missing local paths:");
    for (const missingPath of missingPaths.sort((left, right) => left.path.localeCompare(right.path))) {
      console.error(`- ${missingPath.path} (${missingPath.reason})`);
    }
  }

  process.exit(1);
}

console.log("Documentation command and path references are current.");
