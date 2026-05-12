# EdSync Deployment Guide

EdSync is a Next.js app deployed from GitHub to Vercel, backed by Supabase/Postgres for relational data and Cloudflare for domain, edge security, AI gateway, automation, and object storage. The repo also includes a portable Docker/Postgres path for future full self-hosting.

## Local Setup

1. Copy `.env.example` to `.env.local`.
2. Fill in Supabase and OpenRouter values. Never commit `.env.local`.
3. Install and run:

```powershell
npm.cmd install
npm.cmd run dev
```

Use `http://localhost:3000` for the app.

## Supabase Setup

Run the SQL files in this order:

1. `supabase/migrations/001_edsync_core.sql`
2. `supabase/seed.sql` for demo data only

Required Supabase Auth setting:

- Keep email confirmation on for production.
- For demo/local speed, you may disable email confirmation in Supabase Auth settings.

The app creates/updates profile rows during signup, so the schema avoids hard-coding a dependency on a local `auth.users` table. This keeps the same data model usable when migrating to owned Postgres later.

## Cloudflare Services

Use Cloudflare as the production platform layer around the app:

- DNS/domain: point the production domain to Vercel or Cloudflare Pages, depending on the active deployment target.
- WAF and bot protection: protect auth, AI, upload, and report export routes.
- Turnstile: add challenge protection for signup, invite redemption, and high-volume AI actions.
- R2 object storage: store uploads, generated lesson assets, student exports, report PDFs, screenshots, and locale/vocabulary bundles.
- AI Gateway: route OpenRouter and future Workers AI calls through a monitored gateway with provider failover and usage analytics.
- Vectorize: store embeddings for curriculum search, student memory, lesson recommendations, and multilingual glossary lookup.
- Queues/Workers: run background jobs for file extraction, translation pack generation, AI lesson design, progress summaries, parent reports, and notification fanout.
- Cache Rules: cache public assets, generated previews, locale bundles, and read-only learning resources.

Required Cloudflare values are documented in `.env.example`. Keep the real token values in Vercel env, Cloudflare secrets, local `.env.local`, or CI secrets only.

## Local Postgres Path

Start the portable Postgres database:

```powershell
npm.cmd run db:local
```

Stop it:

```powershell
npm.cmd run db:local:down
```

This path is for migration rehearsals and future self-hosting. Hosted Supabase remains the default production auth/data provider for the Vercel app until the self-hosted profile is enabled.

## Full Self-Deployment Profile

The self-deployment target should run the same app without vendor lock-in:

- GitHub remains the source of truth and CI entrypoint.
- Docker runs the Next.js app, Postgres, migrations, and optional worker processes.
- Cloudflare provides DNS, TLS, WAF, Turnstile, R2 object storage, AI Gateway, Queues, and optional Tunnel.
- A custom domain points to the chosen runtime, either a Docker host behind Cloudflare Tunnel or Cloudflare Pages/Workers.
- Environment variables switch drivers with `DEPLOYMENT_TARGET`, `OBJECT_STORAGE_DRIVER`, `AI_GATEWAY_DRIVER`, and `DATABASE_URL`.
- Migrations in `supabase/migrations` remain portable SQL and must apply cleanly to hosted Supabase and local Postgres.

## Vercel Environment Variables

Add these to Vercel Project Settings for Production, Preview, and Development as needed:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENROUTER_API_KEY`
- `OPENROUTER_DEFAULT_MODEL`
- `OPENROUTER_LESSON_MODEL`
- `OPENROUTER_TUTOR_MODEL`
- `OPENROUTER_ANALYTICS_MODEL`
- `OPENROUTER_TRANSLATION_MODEL`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_ZONE_ID`
- `CLOUDFLARE_AI_GATEWAY_URL`
- `CLOUDFLARE_VECTORIZE_INDEX`
- `CLOUDFLARE_QUEUE_NAME`
- `CLOUDFLARE_TURNSTILE_SITE_KEY`
- `CLOUDFLARE_TURNSTILE_SECRET_KEY`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_PUBLIC_BASE_URL`

Keep `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` in local or CI secrets only.

## One-Step Deploy

Preview deployment:

```powershell
npm.cmd run deploy:vercel
```

Production deployment:

```powershell
npm.cmd run deploy:vercel -- --prod
```

The script validates required env keys, runs typecheck/build, pulls Vercel settings, runs `vercel build`, and deploys the prebuilt output.

## GitHub-Triggered Deploy

Connect `https://github.com/SethyPagna/EdSync-education_app` to Vercel. After the project is connected, pushes to `main` can trigger production deployments and pull-request branches can create preview deployments.

## Deployment Matrix

| Target | Runtime | Database | Storage | Edge/Domain | Use case |
| --- | --- | --- | --- | --- | --- |
| Local dev | Next.js dev server | Docker Postgres or Supabase | Local/R2 dev bucket | localhost | Development and migration rehearsal |
| Vercel production | Vercel Next.js | Supabase Postgres/Auth | Cloudflare R2 | Cloudflare DNS to Vercel | Default hosted production |
| Cloudflare production | Cloudflare Pages/Workers adapter | Supabase or owned Postgres via Hyperdrive | Cloudflare R2 | Cloudflare native | Edge-first variant |
| Self-hosted | Docker host | Docker Postgres | Cloudflare R2 or S3-compatible storage | Cloudflare Tunnel/custom domain | Full owned infrastructure |
