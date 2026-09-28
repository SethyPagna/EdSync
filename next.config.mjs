import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

const rootDirectory = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: {
    root: rootDirectory,
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

/**
 * `next dev` gets the Cloudflare bindings from wrangler.app.jsonc through a local Miniflare proxy, so
 * getCloudflareContext() returns a hermetic local EDSYNC_DB (persisted in .wrangler/state, shared with
 * `npm run db:migrate:local` / `db:seed:local`). Remote bindings are off: dev never touches production D1.
 * Set EDSYNC_LOCAL_D1=0 to skip this and fall back to the Cloudflare D1 REST credentials in .env.local.
 * `next build` and production never run this branch.
 *
 * @param {string} phase
 */
export default async function config(phase) {
  if (phase === PHASE_DEVELOPMENT_SERVER && process.env.EDSYNC_LOCAL_D1 !== "0") {
    const { initOpenNextCloudflareForDev } = await import("@opennextjs/cloudflare");
    // Awaited so the binding exists before the first request calls getCloudflareContext() synchronously.
    await initOpenNextCloudflareForDev({
      configPath: join(rootDirectory, "infra/cloudflare/wrangler.app.jsonc"),
      persist: { path: join(rootDirectory, ".wrangler/state/v3") },
      remoteBindings: false,
    });
  }
  return nextConfig;
}
