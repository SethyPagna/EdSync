# EdSync Learning OS

EdSync is a role-based learning workspace for teachers and students. It uses
Next.js, Cloudflare D1 for relational data, Cloudflare R2 for object storage,
Cloudflare AI Gateway for AI provider routing, an app Worker, and a separate
automation Worker with EdSync-owned data bindings.

## Platform

- Node.js 22.22.2+, 24.15.0+, or 26+ (required by the current DOM test runtime)
- Next.js 16 App Router, React 19, TypeScript 6, and Tailwind CSS 4
- Custom D1-backed authentication and role-aware routing
- Cloudflare D1, R2, AI Gateway, Queues, Workers, Vectorize, Turnstile
- Cloudflare Workers for the hosted Next.js runtime and background automation
- Docker/local profile for self-deployment behind Cloudflare

## Local Setup

1. Install dependencies:
   ```powershell
   npm.cmd install
   ```
2. Copy `config/env/.env.example` to `.env.local` and fill in EdSync-specific
   Cloudflare resources. Do not reuse AllChess or LEARN D1/R2 resources.
3. Run D1 migrations against the hosted Cloudflare database (local development
   uses its own database; see Local development below):
   ```powershell
   npm.cmd run db:migrate:dry-run
   npm.cmd run db:migrate
   ```
4. Start the app on the local database (see Local development; needs
   `LOCAL_SEED_PASSWORD` in `.env.local`):
   ```powershell
   npm.cmd run dev:local
   ```
   To run `npm.cmd run dev` against the hosted database migrated in step 3
   instead, set `EDSYNC_LOCAL_D1=0` in `.env.local`.
5. Open `http://localhost:3000`.

## Local development

`npm.cmd run dev` binds `EDSYNC_DB` to a local, file-backed D1 database
(Miniflare, stored under `.wrangler/state`) using
`infra/cloudflare/wrangler.app.jsonc` with remote bindings disabled, so local
work never touches the production database.

1. Put local-only values in `.env.local`: `LOCAL_SEED_PASSWORD` (8+ characters,
   required by the seed), `APP_ENCRYPTION_KEY` (64 hex characters), and
   `SESSION_SECRET`.
2. Apply every migration in `infra/database/migrations`. Applied files are
   recorded in a `d1_migrations` table, so reruns only apply new files:
   ```powershell
   npm.cmd run db:migrate:local
   ```
3. Load sample data with `ops/scripts/database/seed-local.ts`. It is idempotent
   and safe to rerun:
   ```powershell
   npm.cmd run db:seed:local
   ```
4. Start the app with `npm.cmd run dev`, or migrate, seed, and start in one step:
   ```powershell
   npm.cmd run dev:local
   ```

The seed signs in as `admin@edsync.test` (admin), `teacher@edsync.test`, and
`student@edsync.test`, all with `LOCAL_SEED_PASSWORD`. It adds three classes with
a roster, six published lessons (sections, quizzes, glossary) and a draft,
assessments with submissions and grades in every state, planner events,
announcements, notes, notifications, catalog products, and Studio designs.

- Set `EDSYNC_LOCAL_D1=0` to make `next dev` use the Cloudflare D1 REST
  credentials instead of the local database.
- To start over, stop the dev server, delete `.wrangler/state/v3/d1`, and rerun
  the migrate and seed commands.
- Vectorize has no local emulator; the Wrangler warning at startup is expected.
  R2 uploads still use the `R2_*` S3 credentials.

## Deployment

- Cloudflare app Worker link: `https://edsync.pagna.workers.dev`
- Cloudflare app Worker name: `edsync`
- The former background Worker `edsync-automation` was removed by the owner.
  Normal app deployments do not recreate it. Queue processing and scheduled
  background sweeps require a separately enabled consumer.
- Cloudflare D1 database: `edsync-prod-d1`
- Cloudflare R2 bucket: `edsync-assets-prod`
- Cloudflare Queue: `edsync-automation-prod`
- Cloudflare Vectorize index: `edsync-learning-prod`
- EdSync deploys only to the `Apps` account owned by `jamesung.kh@gmail.com`
  (`d105a82bc26b6913575355352c2d1bb1`). All three Wrangler configs pin that
  account. Use its isolated OAuth profile via `XDG_CONFIG_HOME`; the laptop's
  default Wrangler profile belongs to BusinessOS and must not be used here.
- Vercel Git deployments remain disabled in `vercel.json`; the Vercel deploy
  command has been removed. Cloudflare is the supported release target.
- `npm.cmd run deploy:cloudflare` builds the app with the public values in the
  app Wrangler config, then deploys only the `edsync` app Worker. Set `CLOUDFLARE_ACCOUNT_ID` in
  the process environment and sign Wrangler into the EdSync account first.
  The command syncs local Worker secrets afterward unless
  `CLOUDFLARE_SKIP_SECRET_SYNC=1` is set.
- Keep the original production `APP_ENCRYPTION_KEY` when moving existing AI
  provider records. A different key cannot decrypt their stored credentials.
  If that key is unavailable, skip secret sync and use the enabled Cloudflare
  Workers AI fallback until the original key or provider credentials are restored.
- Real secrets belong in `.env.local`, Cloudflare secrets, or CI secrets.
  They must not be committed.
- `npm.cmd run db:local` starts the production-mode Docker self-hosting profile
  (`infra/local/docker-compose.yml`: `next build` + `next start` plus a
  cloudflared tunnel) with the root `.env.local`. It does not use the local D1;
  it reads and writes the hosted D1 through the `CLOUDFLARE_*` REST credentials.

## Verification

GitHub Actions runs the same checks on `main` and pull requests:

```powershell
npm.cmd run verify
```

`verify` runs the repository hygiene gates, typecheck, ESLint, the Vitest suite,
a moderate dependency audit, and a production Next.js build.

The Vitest suite (`config/test/vitest.config.ts`) runs `src/lib` tests in a
Node environment and component, route, middleware, and `src/lib/ui` tests in
jsdom. A library test that needs the DOM can opt in with a
`// @vitest-environment jsdom` comment at the top of the file.

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

Dependency freshness uses a 72-hour release window in CI, matching the local npm
release cutoff. An explicit `npm_config_before` is respected. Newly published
versions become eligible after that window; this does not delay the separate
security audit, which always checks current advisories.

## Repository Layout

- `src/` contains the TypeScript application, API routes, shared libraries, and
  tests.
- `ops/scripts/` contains TypeScript commands grouped by purpose: maintenance,
  deployment, database, admin, and shared helpers.
- `config/` contains tool configuration that can be addressed by explicit
  paths, including ESLint, Tailwind, Vitest, and environment examples.
- `infra/` contains local, Cloudflare, and D1 database infrastructure files.
- `infra/cloudflare/` owns the app and automation Workers, Wrangler, and OpenNext
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
- `npm.cmd run check:cloudflare` fails if the official and demo Workers reuse
  each other's D1 or other resources, or reference non-EdSync resources.
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

## Public sample workspace

The [EdSync demo](https://edsync-demo.pagna.workers.dev) runs as a separate Cloudflare Worker with its own D1 database. Visitors can browse four free sample courses and switch between fictional learner and teacher workspaces without credentials. The shared workspaces are read-only; they illustrate lessons, classes, assessments, progress, and Studio without changing the official EdSync tenant. The empty official catalog links to this populated demo.

Build and deploy the demo with its own Wrangler config, never the production app or automation deploy command:

```powershell
npm.cmd run build:cloudflare -- --config infra/cloudflare/wrangler.demo.jsonc
npx wrangler deploy --config infra/cloudflare/wrangler.demo.jsonc --keep-vars
```

For a **fresh, isolated** `edsync-demo-d1`, apply `infra/database/migrations/0001_edsync_core.sql` through `0010_grading_integrity.sql` in order, then export and import the fictional sample dataset:

```powershell
npx tsx ops/scripts/database/seed-local.ts --export-demo-sql .wrangler/demo-seed.sql
npx wrangler d1 execute edsync-demo-d1 --remote --file .wrangler/demo-seed.sql
```

The generated SQL stays in ignored `.wrangler`; demo account passwords are random and discarded. Do not import the sample data into `edsync-prod-d1`.

## Workspace revamp

The shared workspace has compact navigation, collapsible secondary sections, keyboard page search (`Ctrl/Cmd K`), a mobile navigation dialog, and light/dark themes. Learner home separates Today, My courses, and Progress. The catalog puts search and filters ahead of repeated promotional content. Shared help panels expand on demand; error and missing-page views provide recovery actions.

Personal catalog enrollments load through a session-scoped endpoint, including entitlement start and expiry checks, and appear alongside assigned courses in the learner library. Portal/domain changes are saved in D1 batches; class rejoining preserves the original enrollment identity.

Teachers can author choice, true/false, short-answer, and long-answer questions directly in an assignment or test. Learners answer each question in the work sheet, while teachers review structured responses; answer keys stay out of learner responses, and questions lock after a submission. Discussion work opens its thread for learner replies, with teacher-only and private posts filtered on the server.

Organization owners manage separate private learner and teacher invitation codes in **Admin → Portals**. A code only grants its matching role; owners can rotate either code or pause invitations. A public workspace slug cannot be used to join. New organization creation is for teachers; learners can join with a learner code or create an individual account.

For constrained local machines, the complete test suite can run with `npm.cmd test -- --maxWorkers=2`.
