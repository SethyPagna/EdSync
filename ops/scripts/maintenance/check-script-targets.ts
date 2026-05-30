import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type PackageJson = {
  scripts?: Record<string, string>;
};

type ScriptReference = {
  script: string;
  path: string;
};

const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as PackageJson;
const scripts = packageJson.scripts ?? {};

const referencePatterns = [
  /\btsx\s+([^\s&|]+\.ts)\b/g,
  /--config\s+([^\s&|]+)/g,
  /--openNextConfigPath\s+([^\s&|]+)/g,
  /\bdocker\s+compose\s+-f\s+([^\s&|]+)/g,
] as const;

function cleanReference(rawPath: string) {
  return rawPath.replace(/^["']|["']$/g, "");
}

function isLocalReference(scriptPath: string) {
  return /^(?:\.\/|\.\.\/|config\/|infra\/|ops\/|src\/)/.test(scriptPath);
}

function collectScriptReferences() {
  const references: ScriptReference[] = [];

  for (const [script, command] of Object.entries(scripts)) {
    for (const pattern of referencePatterns) {
      for (const match of command.matchAll(pattern)) {
        const rawPath = match[1];
        if (!rawPath) continue;
        const scriptPath = cleanReference(rawPath);
        if (!isLocalReference(scriptPath)) continue;
        references.push({ script, path: scriptPath });
      }
    }
  }

  return references;
}

function resolveReference(scriptPath: string) {
  return path.resolve(process.cwd(), scriptPath);
}

const missing = collectScriptReferences()
  .filter((reference) => !existsSync(resolveReference(reference.path)))
  .sort((left, right) => `${left.script}:${left.path}`.localeCompare(`${right.script}:${right.path}`));

if (missing.length > 0) {
  console.error("Package scripts reference missing local files:");
  for (const reference of missing) {
    console.error(`- ${reference.script}: ${reference.path}`);
  }
  process.exit(1);
}

console.log("Package script file targets exist.");
