import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const API_BASE = "https://api.cloudflare.com/client/v4";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    if (!process.env[key]) process.env[key] = rest.join("=").trim().replace(/^["']|["']$/g, "");
  }
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function cf(method, path, body) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    const message = payload.errors?.map((error) => error.message).join("; ") || response.statusText;
    throw new Error(message);
  }
  return payload.result;
}

async function ensurePagesProject(projectName) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const projects = await cf("GET", `/accounts/${accountId}/pages/projects`);
  const existing = projects.find((project) => project.name.toLowerCase() === projectName.toLowerCase());
  if (existing) return existing;

  try {
    return await cf("POST", `/accounts/${accountId}/pages/projects`, {
      name: projectName,
      production_branch: "main",
    });
  } catch (error) {
    const retryProjects = await cf("GET", `/accounts/${accountId}/pages/projects`);
    const retryExisting = retryProjects.find((project) => project.name.toLowerCase() === projectName.toLowerCase());
    if (retryExisting) return retryExisting;
    throw error;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!accountId || !token) throw new Error("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required.");

const environment = process.argv.includes("--preview") ? "preview" : "production";
const pagesProject = process.env.CLOUDFLARE_PAGES_PROJECT || "edsync";
const workerEnvArgs = environment === "production" ? ["deploy", "--env", "production"] : ["deploy", "--env", "preview"];

await ensurePagesProject(pagesProject);

run("npx", ["vercel", "build"]);
run("npx", ["wrangler", "pages", "deploy", ".vercel/output/static", "--project-name", pagesProject, "--branch", environment === "production" ? "main" : "preview"]);
run("npx", ["wrangler", ...workerEnvArgs]);

console.log(`Cloudflare Pages and Worker deployed for ${pagesProject} (${environment}).`);
