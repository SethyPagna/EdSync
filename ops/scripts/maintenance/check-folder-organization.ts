import path from "node:path";
import { listTrackedFiles } from "../shared/git";

type FolderRule = {
  allowedChildren: Set<string>;
  root: string;
};

const folderRules: FolderRule[] = [
  {
    allowedChildren: new Set(["workflows"]),
    root: ".github",
  },
  {
    allowedChildren: new Set(["env", "eslint", "tailwind", "test"]),
    root: "config",
  },
  {
    allowedChildren: new Set(["cloudflare", "database", "local"]),
    root: "infra",
  },
  {
    allowedChildren: new Set(["plans", "scripts"]),
    root: "ops",
  },
  {
    allowedChildren: new Set(["_headers", "favicon.svg", "manifest.webmanifest", "showcase"]),
    root: "public",
  },
  {
    allowedChildren: new Set(["app", "components", "lib", "proxy.test.ts", "proxy.ts", "styles", "test", "types"]),
    root: "src",
  },
];

const opsScriptCategories = new Set(["admin", "database", "deploy", "maintenance", "shared"]);

function normalizeForGit(file: string) {
  return file.split(path.sep).join("/");
}

function findFolderRule(root: string) {
  return folderRules.find((rule) => rule.root === root);
}

function findUnexpectedOwnerFolders(files: string[]) {
  const unexpected: string[] = [];

  for (const file of files) {
    const [root, child, scriptCategory] = file.split("/");
    if (!root || !child) continue;

    const rule = findFolderRule(root);
    if (!rule) continue;

    if (!rule.allowedChildren.has(child)) {
      unexpected.push(file);
      continue;
    }

    if (root === "ops" && child === "scripts" && scriptCategory && !opsScriptCategories.has(scriptCategory)) {
      unexpected.push(file);
    }
  }

  return unexpected.sort();
}

const unexpectedFiles = findUnexpectedOwnerFolders(listTrackedFiles().map(normalizeForGit));

if (unexpectedFiles.length > 0) {
  console.error("Tracked files are outside the expected owner folders:");
  for (const file of unexpectedFiles) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log("Tracked folders match the expected owner layout.");
console.log("Config: config/env, config/eslint, config/tailwind, config/test.");
console.log("Infra: infra/cloudflare, infra/database, infra/local.");
console.log("Ops scripts: admin, database, deploy, maintenance, shared.");
