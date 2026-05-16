# EdSync Learning OS

EdSync is a role-based learning workspace for teachers and students. It uses
Next.js, Cloudflare D1 for relational data, Cloudflare R2 for object storage,
Cloudflare AI Gateway for AI provider routing, and Cloudflare Workers/Queues for
background automation.

## Platform

- Next.js 14 App Router and TypeScript
- Custom D1-backed authentication and role-aware routing
- Cloudflare D1, R2, AI Gateway, Queues, Workers, Vectorize, Turnstile
- Vercel deployment for the hosted Next.js runtime
- Docker/local profile for self-deployment behind Cloudflare

## Local Setup

1. Install dependencies:
   ```powershell
   npm.cmd install
   ```
2. Copy `.env.example` to `.env.local` and fill in EdSync-specific Cloudflare
   resources. Do not reuse AllChess or LEARN D1/R2 resources.
3. Run D1 migrations:
   ```powershell
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

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```
