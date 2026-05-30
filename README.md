# EdSync Learning OS

EdSync is a role-based learning workspace for teachers and students. It uses
Next.js, Cloudflare D1 for relational data, Cloudflare R2 for object storage,
Cloudflare AI Gateway for AI provider routing, and Cloudflare Workers/Queues for
background automation.

## Platform

- Node.js 20.19 or newer
- Next.js 16 App Router, React 19, TypeScript 6, and Tailwind CSS 4
- Custom D1-backed authentication and role-aware routing
- Cloudflare D1, R2, AI Gateway, Queues, Workers, Vectorize, Turnstile
- Vercel deployment for the hosted Next.js runtime
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

- Vercel project name: `EdSync`
- Cloudflare app Worker link: `https://edsync.learn-app.workers.dev`
- Cloudflare Pages redirect link: `https://edsync.pages.dev`
- Cloudflare D1 database names should follow `edsync-dev-d1`,
  `edsync-preview-d1`, and `edsync-prod-d1`.
- Cloudflare R2 bucket names should follow `edsync-assets-dev`,
  `edsync-assets-preview`, and `edsync-assets-prod`.
- Real secrets belong in `.env.local`, Vercel environment variables, Cloudflare
  secrets, or CI secrets. They must not be committed.

## Verification

GitHub Actions runs the same checks on `main` and pull requests:

```powershell
npm.cmd run verify
```

`verify` runs typecheck, ESLint, the Vitest suite, a moderate dependency audit,
and a production Next.js build.

To guard the compact root layout, run:

```powershell
npm.cmd run check:root
```

To guard the TypeScript-first source policy, run:

```powershell
npm.cmd run check:typescript
```

To guard package script references after moving files, run:

```powershell
npm.cmd run check:scripts
```

To guard EdSync-specific Cloudflare resources, run:

```powershell
npm.cmd run check:cloudflare
```

Current dependency note: ESLint stays on 9.x until the plugin chain bundled by
`eslint-config-next` declares ESLint 10 support. A direct ESLint 10 upgrade
currently fails while loading React rules such as `react/display-name` and
`react/no-direct-mutation-state`, and npm reports invalid peers for the bundled
React, import, and jsx-a11y plugins.

## Repository Layout

- `src/` contains the TypeScript application, API routes, shared libraries, and
  tests.
- `ops/scripts/` contains TypeScript commands grouped by purpose: maintenance,
  deployment, database, admin, and shared helpers.
- `config/` contains tool configuration that can be addressed by explicit
  paths, including ESLint, Tailwind, Vitest, and environment examples.
- `infra/` contains local, Cloudflare, and D1 database infrastructure files.
- `infra/cloudflare/` owns Worker, Wrangler, OpenNext, and automation Worker
  configuration for EdSync-specific Cloudflare resources.
- Framework-required root entry points remain at the root so Next.js, npm,
  Vercel, TypeScript, and Codex can discover them without custom bootstrapping.
  This intentionally includes `package.json`, `package-lock.json`,
  `next.config.mjs`, `next-env.d.ts`, `tsconfig.json`, `vercel.json`,
  `README.md`, and `AGENTS.md`.
- `npm.cmd run check:root` fails if tracked config, docs, scripts, or source
  files drift back into the root instead of their owning folders.
- `npm.cmd run check:typescript` fails if tracked JavaScript, JSX, or CJS files
  are added. The only tracked `.mjs` exceptions are runtime config files that
  must stay directly loadable by Node or the framework.
- `npm.cmd run check:scripts` fails if `package.json` commands point at missing
  local files after scripts, configs, or infra files move.
- `npm.cmd run check:cloudflare` fails if Wrangler resource names stop using
  EdSync-owned D1, R2, Queue, Vectorize, Worker, or Pages names.

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
