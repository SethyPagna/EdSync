# EdSync Deployment Guide

EdSync uses Cloudflare for database, object storage, edge security, AI routing,
background jobs, and domain services, with Vercel as the default hosted Next.js
runtime.

## Cloudflare Resources

Create EdSync-specific resources so AllChess and LEARN remain isolated:

- D1 databases:
  - `edsync-dev-d1` (`54bbff25-6efb-4210-8c3a-e9ac0e2a0a98`)
  - `edsync-preview-d1` (`6ae1887c-2efb-4199-89c2-2d68ef7b3ce2`)
  - `edsync-prod-d1` (`cfa252cc-750f-4aaa-8e3a-624cbe56e6bd`)
- R2 buckets:
  - `edsync-assets-dev` (`https://pub-648d4acbbaac4a3e96a5dea072706010.r2.dev`)
  - `edsync-assets-preview` (`https://pub-83c176f255cf44ada09ff54097705245.r2.dev`)
  - `edsync-assets-prod` (`https://pub-fd59bf7992c64c6f94c13d2aedc47a83.r2.dev`)
- Queues: `edsync-automation-dev`, `edsync-automation-preview`, `edsync-automation-prod`
- Vectorize indexes: `edsync-learning-dev`, `edsync-learning-preview`, `edsync-learning-prod`
- AI Gateways: `edsync-dev`, `edsync-preview`, `edsync-prod`
- Turnstile site: `EdSync app`
- Workers:
  - `edsync-learning-os`
  - `edsync-learning-os-preview`
  - `edsync-learning-os-production`

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

Optional security integrations:

- `MALWARE_SCAN_ENDPOINT`
- `MALWARE_SCAN_TOKEN`
- `MALWARE_SCAN_FAIL_CLOSED=false|true`

EdSync always runs local upload signature checks. When `MALWARE_SCAN_ENDPOINT`
is configured, uploads and content extraction also call the scanner before files
are stored or parsed.

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
the automation worker with the environment that matches the target:

```powershell
npx wrangler deploy --env=""
npx wrangler deploy --env preview
npx wrangler deploy --env production
```

## Cloudflare Edge Security

Configure a dedicated EdSync hostname before applying WAF and rate limiting
rules. The deployer requires both values so rules are scoped to EdSync and do not
affect AllChess, LEARN, or any other app in the account:

```powershell
$env:CLOUDFLARE_ZONE_ID="your-zone-id"
$env:CLOUDFLARE_DOMAIN="edsync.example.com"
npm.cmd run security:cloudflare
```

The script manages only rules with `edsync-edge-*` refs and preserves unrelated
zone rules. It installs hostname-scoped blocks for secret/legacy probes,
executable path probes, unexpected HTTP methods, high-threat API challenges, and
edge rate limits for auth, uploads/extraction, AI routes, and the data API.

## Deployment Matrix

| Target | Runtime | Database | Storage | Edge/Domain |
| --- | --- | --- | --- | --- |
| Local | Next.js dev | EdSync D1 dev | EdSync R2 dev | localhost |
| Vercel | Vercel Next.js | EdSync D1 preview/prod | EdSync R2 | Cloudflare DNS to Vercel |
| Cloudflare | Pages/Workers profile | D1 binding | R2 binding | Cloudflare native |
| Docker | Self-hosted Next.js | D1 REST | R2 | Cloudflare Tunnel/domain |
