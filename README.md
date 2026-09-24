# EdSync Learning OS

EdSync is a role-based learning workspace for teachers and students. It uses
Next.js, Cloudflare D1 for relational data, Cloudflare R2 for object storage,
Cloudflare AI Gateway for AI provider routing, and one Cloudflare Worker with
EdSync-owned data bindings.

## Platform

- Node.js 22.22.2+, 24.15.0+, or 26+ (required by the current DOM test runtime)
- Next.js 16 App Router, React 19, TypeScript 6, and Tailwind CSS 4
- Custom D1-backed authentication and role-aware routing
- Cloudflare D1, R2, AI Gateway, Queues, Workers, Vectorize, Turnstile
- Cloudflare Worker deployment for the hosted Next.js runtime
- Docker/local profile for self-deployment behind Cloudflare

## Local Setup

1. Install dependencies:
   ```powershell
   npm.cmd install
   ```
2. Copy `config/env/.env.example` to `.env.local` and fill in EdSync-specific
   Cloudflare resources. Do not reuse AllChess or LEARN D1/R2 resources.
3. Run D1 migrations:
   ```powershell
   npm.cmd run db:migrate:dry-run
   npm.cmd run db:migrate
   ```
4. Start the app:
   ```powershell
   npm.cmd run dev
   ```
5. Open `http://localhost:3000`.

## Deployment

- Cloudflare app Worker link: `https://edsync.learn-app.workers.dev`
- Cloudflare app Worker name: `edsync`
- Cloudflare D1 database: `edsync-prod-d1`
- Cloudflare R2 bucket: `edsync-assets-prod`
- Cloudflare Queue: `edsync-automation-prod`
- Cloudflare Vectorize index: `edsync-learning-prod`
- Real secrets belong in `.env.local`, Vercel environment variables, Cloudflare
  secrets, or CI secrets. They must not be committed.

## Verification

GitHub Actions runs the same checks on `main` and pull requests:

```powershell
npm.cmd run verify
```

`verify` runs the repository hygiene gates, typecheck, ESLint, the Vitest suite,
a moderate dependency audit, and a production Next.js build.

To guard the compact root layout, run:

```powershell
npm.cmd run check:root
```

To guard folder ownership inside the compact root layout, run:

```powershell
npm.cmd run check:folders
```

To guard against tracked generated output or local secret files, run:

```powershell
npm.cmd run check:artifacts
```

To guard the TypeScript-first source policy, run:

```powershell
npm.cmd run check:typescript
```

To guard runtime source import boundaries, run:

```powershell
npm.cmd run check:boundaries
```

To guard package script references after moving files, run:

```powershell
npm.cmd run check:scripts
```

To guard GitHub Actions workflow commands, run:

```powershell
npm.cmd run check:ci
```

To guard EdSync-specific Cloudflare resources, run:

```powershell
npm.cmd run check:cloudflare
```

To guard referenced public images and PWA assets, run:

```powershell
npm.cmd run check:assets
```

To guard dependency freshness with documented compatibility holds, run:

```powershell
npm.cmd run check:deps
```

To guard README command and path references, run:

```powershell
npm.cmd run check:docs
```

Current dependency note: ESLint stays on 9.x until the plugin chain bundled by
`eslint-config-next` declares ESLint 10 support. A direct ESLint 10 upgrade
currently fails while loading React rules such as `react/display-name` and
`react/no-direct-mutation-state`, and npm reports invalid peers for the bundled
React, import, and jsx-a11y plugins.

TypeScript remains on 6.x because the parser bundled with `eslint-config-next`
explicitly rejects TypeScript 7.0. This compatibility hold is enforced by the
dependency check; lint and build error checks remain enabled. The `pptxgenjs`
image-size dependency is overridden to patched 2.x to remove parser denial-of-service
advisories; PowerPoint text and image export has been smoke-tested.

## Repository Layout

- `src/` contains the TypeScript application, API routes, shared libraries, and
  tests.
- `ops/scripts/` contains TypeScript commands grouped by purpose: maintenance,
  deployment, database, admin, and shared helpers.
- `config/` contains tool configuration that can be addressed by explicit
  paths, including ESLint, Tailwind, Vitest, and environment examples.
- `infra/` contains local, Cloudflare, and D1 database infrastructure files.
- `infra/cloudflare/` owns the single Worker, Wrangler, and OpenNext
  configuration for EdSync-specific Cloudflare resources.
- Framework-required root entry points remain at the root so Next.js, npm,
  Vercel, TypeScript, and Codex can discover them without custom bootstrapping.
  This intentionally includes `package.json`, `package-lock.json`,
  `next.config.mjs`, `next-env.d.ts`, `tsconfig.json`, `vercel.json`,
  `README.md`, and `AGENTS.md`.
- `npm.cmd run check:root` fails if tracked config, docs, scripts, or source
  files drift back into the root instead of their owning folders.
- `npm.cmd run check:folders` fails if tracked files drift outside the expected
  owner folders under `config/`, `infra/`, `ops/scripts/`, `public/`, or `src/`.
- `npm.cmd run check:artifacts` fails if generated output, dependency folders,
  build caches, logs, or local secret-like files are tracked.
- `npm.cmd run check:typescript` fails if tracked JavaScript, JSX, or CJS files
  are added. The only tracked `.mjs` exceptions are runtime config files that
  must stay directly loadable by Node or the framework.
- `npm.cmd run check:boundaries` fails if files under `src/` import runtime
  code from non-app owner folders such as `config/`, `infra/`, `ops/`, or
  `public/`.
- `npm.cmd run check:scripts` fails if `package.json` commands point at missing
  local files after scripts, configs, or infra files move.
- `npm.cmd run check:ci` fails if GitHub Actions stops installing with
  `npm ci`, stops running `verify`, references missing package scripts, or uses
  a Node major below the package engine.
- `npm.cmd run check:cloudflare` fails if Wrangler resource names stop using
  the single EdSync Worker and EdSync-owned D1, R2, Queue, or Vectorize names.
- `npm.cmd run check:assets` fails if referenced public assets are missing,
  image extensions do not match file content, or showcase screenshots are
  replaced with tiny placeholder files.
- `npm.cmd run check:deps` fails if dependencies become outdated outside of
  documented compatibility holds such as the current ESLint 10 migration block.
- `npm.cmd run check:docs` fails if README command examples or local path
  references stop matching the current project layout.

## Local Cleanup

Generated build output can become large during Cloudflare and Next.js deploy
testing. Use the safe local cleanup command before archiving or when disk space
gets tight:

```powershell
npm.cmd run clean:local
```

This removes rebuildable folders such as `.next`, `.open-next`,
`.vercel/output`, `.wrangler`, `coverage`, `dist`, and TypeScript build info
while keeping `node_modules` so the app can still run. To also remove installed
dependencies, use:

```powershell
npm.cmd run clean:all
npm.cmd install
```

## Portal addresses and future domains

Portals work before buying a domain. Open **Admin → Portals**, create a portal, and use its tenant-qualified link (`/org/main?tenant=your-organization`). Public, customer, and partner catalogs can be shared; internal or disabled catalogs are not published by that link. Matching portal slugs in different organizations cannot resolve to the wrong organization.

When you own a domain:

1. Add it to Cloudflare and provision proxied wildcard DNS, TLS, and a wildcard Worker route to the **edsync** Worker. Cloudflare Worker Custom Domains do not accept wildcard hostnames; use a Worker Route for the wildcard. See [Cloudflare routes](https://developers.cloudflare.com/workers/configuration/routing/routes/) and [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).
2. Set `PORTAL_BASE_DOMAIN` to the bare domain in the deployment environment, for example `example.com`, and redeploy. Leave it blank until routing is ready. Existing portal addresses then resolve as `organization--portal.example.com`. The combined subdomain must fit in 63 characters; longer names keep working through the path link.
3. Test a public portal, an internal portal, an unknown subdomain, and an account without organization membership. Hostnames select a workspace; they do not grant membership. Sessions remain host-only, so sign-in on each hostname is independent.
4. For a separate custom domain, save its hostname in the portal. The UI shows a pending state and a unique `_edsync-verification.<hostname>` TXT record. An operator must verify that exact token using authoritative DNS, provision HTTPS and the Worker route (or Cloudflare for SaaS for customer-owned zones), then mark that exact `tenant_domains` row active through the trusted deployment/database workflow. Merely entering a hostname never activates it. Saving unrelated portal settings preserves verification.

No DNS records, domain purchases, or live Cloudflare changes are performed by the portal editor. Automatic DNS/TLS provisioning and cross-domain SSO are not implemented.

## Workspace revamp

The shared workspace has compact navigation, collapsible secondary sections, keyboard page search (`Ctrl/Cmd K`), a mobile navigation dialog, and light/dark themes. Learner home separates Today, My courses, and Progress. The catalog puts search and filters ahead of repeated promotional content. Shared help panels expand on demand; error and missing-page views provide recovery actions.

Personal catalog enrollments load through a session-scoped endpoint, including entitlement start and expiry checks, and appear alongside assigned courses in the learner library. Portal/domain changes are saved in D1 batches; class rejoining preserves the original enrollment identity.

For constrained local machines, the complete test suite can run with `npm.cmd test -- --maxWorkers=2`.
