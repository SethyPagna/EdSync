# EdSync Deployment Guide

EdSync is a Next.js app deployed on Vercel with Supabase as the hosted database/auth provider. The repo also includes a portable Postgres path for future self-hosting.

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

## Local Postgres Path

Start the portable Postgres database:

```powershell
npm.cmd run db:local
```

Stop it:

```powershell
npm.cmd run db:local:down
```

This path is for migration rehearsals and future self-hosting. Hosted Supabase remains the production auth/data provider for the Vercel app.

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
