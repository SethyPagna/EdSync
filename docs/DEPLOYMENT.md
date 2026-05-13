# EdSync Deployment Guide

EdSync uses Cloudflare for database, object storage, edge security, AI routing,
background jobs, and domain services, with Vercel as the default hosted Next.js
runtime.

## Cloudflare Resources

Create EdSync-specific resources so AllChess and LEARN remain isolated:

- D1 databases: `edsync-dev-d1`, `edsync-preview-d1`, `edsync-prod-d1`
- R2 buckets: `edsync-assets-dev`, `edsync-assets-preview`, `edsync-assets-prod`
- Queue: `edsync-automation-*`
- Vectorize index: `edsync-learning-*`
- AI Gateway route dedicated to EdSync
- Turnstile site dedicated to EdSync auth and high-volume actions

Object keys must still include environment and owner scope, for example
`prod/users/{userId}/lesson-assets/{fileName}`.

## Environment Variables

Required values:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_THEME_DEFAULT=light`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_D1_DATABASE_ID`
- `CLOUDFLARE_D1_DATABASE_NAME`
- `R2_BUCKET`
- `R2_PUBLIC_BASE_URL`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `CLOUDFLARE_AI_GATEWAY_URL`
- `CLOUDFLARE_VECTORIZE_INDEX`
- `CLOUDFLARE_QUEUE_NAME`
- `SESSION_SECRET`
- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `OPENROUTER_API_KEY`
- `DEPLOYMENT_TARGET=local|vercel|cloudflare|docker`

Keep real token values in `.env.local`, Vercel env, Cloudflare secrets, or CI
secrets only.

## D1 Migration

```powershell
npm.cmd run db:migrate
npm.cmd run db:seed
```

The schema lives in `database/migrations`. It is SQLite/D1-compatible and avoids
Postgres-only features.

## Vercel

Relink the project after deleting the old deployment:

```powershell
npx vercel link --project EdSync
npm.cmd run deploy:vercel
npm.cmd run deploy:vercel -- --prod
```

The script validates required env keys, runs typecheck/build unless
`--skip-build` is provided, pulls Vercel environment settings, builds, and
deploys the prebuilt output.

## Cloudflare Worker And Queue

`wrangler.toml` defines the EdSync D1, R2, Queue, and Vectorize bindings. Deploy
the automation worker after filling real IDs:

```powershell
npx wrangler deploy cloudflare/workers/automation.ts
```

## Deployment Matrix

| Target | Runtime | Database | Storage | Edge/Domain |
| --- | --- | --- | --- | --- |
| Local | Next.js dev | EdSync D1 dev | EdSync R2 dev | localhost |
| Vercel | Vercel Next.js | EdSync D1 preview/prod | EdSync R2 | Cloudflare DNS to Vercel |
| Cloudflare | Pages/Workers profile | D1 binding | R2 binding | Cloudflare native |
| Docker | Self-hosted Next.js | D1 REST | R2 | Cloudflare Tunnel/domain |
