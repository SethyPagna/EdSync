import { mkdtempSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadEnvFile, run } from "./lib/ops.mjs";

const API_BASE = "https://api.cloudflare.com/client/v4";

async function cf(method, path, body) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const email = process.env.CLOUDFLARE_EMAIL;
  const globalKey = process.env.CLOUDFLARE_GLOBAL_API_KEY || process.env.CLOUDFLARE_API_KEY;
  const authHeaders = token
    ? { Authorization: `Bearer ${token}` }
    : email && globalKey
      ? { "X-Auth-Email": email, "X-Auth-Key": globalKey }
      : {};
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...authHeaders,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    if (token && email && globalKey && payload.errors?.some((error) => /auth/i.test(error.message))) {
      const retryResponse = await fetch(`${API_BASE}${path}`, {
        method,
        headers: {
          "X-Auth-Email": email,
          "X-Auth-Key": globalKey,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const retryPayload = await retryResponse.json().catch(() => ({}));
      if (retryResponse.ok && retryPayload.success !== false) return retryPayload.result;
      const retryMessage =
        retryPayload.errors?.map((error) => error.message).join("; ") || retryResponse.statusText;
      throw new Error(retryMessage);
    }
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

function putWorkerSecret(key, config, environment) {
  const value = process.env[key];
  if (!value) return;
  const args = ["wrangler", "secret", "put", key];
  if (config) args.push("--config", config);
  if (environment) args.push("--env", environment);
  run("npx", args, { input: `${value}\n` });
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const hasCloudflareAuth =
  process.env.CLOUDFLARE_API_TOKEN ||
  (process.env.CLOUDFLARE_EMAIL && (process.env.CLOUDFLARE_GLOBAL_API_KEY || process.env.CLOUDFLARE_API_KEY));
if (!accountId || !hasCloudflareAuth) {
  throw new Error("CLOUDFLARE_ACCOUNT_ID and either CLOUDFLARE_API_TOKEN or Cloudflare email/global key are required.");
}

const environment = process.argv.includes("--preview") ? "preview" : "production";
const pagesProject = process.env.CLOUDFLARE_PAGES_PROJECT || "edsync";
const envArgs = environment === "production" ? ["--env", "production"] : ["--env", "preview"];

await ensurePagesProject(pagesProject);

for (const key of [
  "APP_ENCRYPTION_KEY",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_AI_GATEWAY_URL",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "SESSION_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "TURNSTILE_SECRET_KEY",
  "TURNSTILE_SITE_KEY",
]) {
  putWorkerSecret(key, "wrangler.app.jsonc", environment);
}

run("npx", ["opennextjs-cloudflare", "build", "--config", "wrangler.app.jsonc", ...envArgs]);
const pagesDeployCwd = mkdtempSync(join(tmpdir(), "edsync-pages-"));
const pagesIndexPath = resolve(".open-next/assets/index.html");
const appUrl =
  environment === "production"
    ? "https://edsync.learn-app.workers.dev"
    : "https://edsync-preview.learn-app.workers.dev";
writeFileSync(
  pagesIndexPath,
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=${appUrl}"><title>EdSync</title></head><body><a href="${appUrl}">Open EdSync</a></body></html>`,
);
const pagesDeployEnv = { ...process.env };
if (pagesDeployEnv.CLOUDFLARE_GLOBAL_API_KEY || pagesDeployEnv.CLOUDFLARE_API_KEY) {
  delete pagesDeployEnv.CLOUDFLARE_API_TOKEN;
  pagesDeployEnv.CLOUDFLARE_API_KEY = pagesDeployEnv.CLOUDFLARE_GLOBAL_API_KEY || pagesDeployEnv.CLOUDFLARE_API_KEY;
}
run("npx", [
  "wrangler",
  "pages",
  "deploy",
  resolve(".open-next/assets"),
  "--project-name",
  pagesProject,
  "--branch",
  environment === "production" ? "main" : "preview",
], { cwd: pagesDeployCwd, env: pagesDeployEnv });
unlinkSync(pagesIndexPath);
run("npx", ["opennextjs-cloudflare", "deploy", "--config", "wrangler.app.jsonc", ...envArgs, "--", "--keep-vars"]);
const automationDeployCwd = mkdtempSync(join(tmpdir(), "edsync-worker-"));
run("npx", ["wrangler", "deploy", "--config", resolve("wrangler.toml"), ...envArgs], {
  cwd: automationDeployCwd,
});

console.log(`Cloudflare Pages and Worker deployed for ${pagesProject} (${environment}).`);
