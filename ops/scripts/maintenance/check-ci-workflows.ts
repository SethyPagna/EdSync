import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

type PackageJson = {
  engines?: {
    node?: string;
  };
  scripts?: Record<string, string>;
};

type WorkflowIssue = {
  file: string;
  message: string;
};

const workflowsDir = path.resolve(process.cwd(), ".github", "workflows");
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as PackageJson;
const scripts = new Set(Object.keys(packageJson.scripts ?? {}));
const requiredNodeMajor = parseRequiredNodeMajor(packageJson.engines?.node);

function parseRequiredNodeMajor(engineRange: string | undefined) {
  if (!engineRange) return null;
  const match = engineRange.match(/(\d+)/);
  return match?.[1] ? Number.parseInt(match[1], 10) : null;
}

function parseNodeVersionMajor(rawVersion: string) {
  const cleanVersion = rawVersion.trim().replace(/^["']|["']$/g, "");
  const match = cleanVersion.match(/^(\d+)/);
  return match?.[1] ? Number.parseInt(match[1], 10) : null;
}

function collectWorkflowFiles() {
  return readdirSync(workflowsDir)
    .filter((file) => /\.ya?ml$/i.test(file))
    .map((file) => path.join(workflowsDir, file))
    .sort();
}

function relativeWorkflowPath(file: string) {
  return path.relative(process.cwd(), file).replaceAll(path.sep, "/");
}

function collectNpmRunScripts(content: string) {
  return [...content.matchAll(/\bnpm\s+run\s+([a-z0-9:_-]+)/gi)]
    .map((match) => match[1])
    .filter((script): script is string => Boolean(script));
}

function collectNodeVersions(content: string) {
  return [...content.matchAll(/node-version:\s*([^\n#]+)/gi)]
    .map((match) => match[1])
    .filter((version): version is string => Boolean(version));
}

const issues: WorkflowIssue[] = [];
const workflowFiles = collectWorkflowFiles();

if (workflowFiles.length === 0) {
  issues.push({ file: ".github/workflows", message: "No GitHub Actions workflows found." });
}

for (const workflowFile of workflowFiles) {
  const content = readFileSync(workflowFile, "utf8");
  const file = relativeWorkflowPath(workflowFile);
  const workflowScripts = collectNpmRunScripts(content);

  if (!content.includes("npm ci")) {
    issues.push({ file, message: "Workflow should install dependencies with npm ci." });
  }

  if (!workflowScripts.includes("verify")) {
    issues.push({ file, message: "Workflow should run npm run verify." });
  }

  for (const script of workflowScripts) {
    if (!scripts.has(script)) {
      issues.push({ file, message: `Workflow references missing package script: ${script}.` });
    }
  }

  for (const version of collectNodeVersions(content)) {
    const actualMajor = parseNodeVersionMajor(version);
    if (requiredNodeMajor !== null && actualMajor !== null && actualMajor < requiredNodeMajor) {
      issues.push({
        file,
        message: `Workflow Node version ${version.trim()} is older than package engine ${packageJson.engines?.node}.`,
      });
    }
  }
}

if (issues.length > 0) {
  console.error("CI workflow checks failed:");
  for (const issue of issues) {
    console.error(`- ${issue.file}: ${issue.message}`);
  }
  process.exit(1);
}

console.log("CI workflows reference current scripts and Node requirements.");
