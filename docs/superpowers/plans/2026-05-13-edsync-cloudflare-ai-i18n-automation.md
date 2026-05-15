# EdSync Cloudflare Migration And Redesign Implementation Plan

> Implementation status: this repo now targets Cloudflare D1, R2, Workers/Queues,
> AI Gateway, Vectorize, Vercel, GitHub, local development, and Docker
> self-deployment. EdSync resources must stay separate from AllChess and LEARN.

## Architecture

- Runtime: Next.js App Router on Vercel by default, with Cloudflare and Docker
  deployment profiles.
- Database: dedicated Cloudflare D1 databases named by environment, for example
  `edsync-dev-d1`, `edsync-preview-d1`, and `edsync-prod-d1`.
- Storage: dedicated Cloudflare R2 buckets named by environment, for example
  `edsync-assets-dev`, `edsync-assets-preview`, and `edsync-assets-prod`.
- Auth: custom D1-backed users, password hashes, sessions, role cookies, and
  protected teacher/student routing.
- AI: encrypted D1 provider configs for Groq, Google AI, Mistral AI, Cerebras,
  and Cohere embeddings, with smart fallback and audit rows in `ai_runs`.
- Automation: Cloudflare Queue/Worker profile for long-running learning jobs.
- Resource strategy: critical authoring and navigation loops should debounce
  noisy browser writes, memoize repeated permission/navigation work, avoid
  nested client-side recomputation in large screens, and prefer queued work for
  AI/automation jobs that do not need to block the UI.

## Implementation Checklist

- [x] Remove app dependency on Supabase SDKs and Supabase storage/client files.
- [x] Add D1-compatible schema under `database/migrations`.
- [x] Add custom auth API routes for signup, login, logout, and session lookup.
- [x] Add D1 REST-backed data API used by the browser client.
- [x] Add R2 upload route and storage metadata rows.
- [x] Add Cloudflare worker/queue scaffold and `wrangler.toml`.
- [x] Update Vercel deployment script and required env keys.
- [x] Update README and deployment docs for Cloudflare-only data/storage.
- [x] Switch the visual system to EdSync naming, light default, and dark toggle.
- [x] Add the workflow efficiency pass: debounced lesson draft persistence,
  memoized navigation permission checks, hoisted authoring tool definitions, and
  viewport bounds QA for the lesson authoring route.
- [ ] Create real Cloudflare D1/R2/Queue/Vectorize/Turnstile resources in the
  Cloudflare account and paste IDs into environment variables.
- [ ] Relink Vercel with `npx vercel link --project EdSync`.
- [ ] Deploy preview, verify flows, then deploy production.

## Verification

- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`
- `npm.cmd run db:migrate`
- Signup, login, logout, role redirects, lesson CRUD, class join/assign,
  lesson-taking, AI routes, R2 upload, and report generation must be tested
  against a real EdSync D1/R2 environment before production cutover.

## Commit Rule

Commit every edited or newly created file separately unless the change is a
generated lockfile or package-manager artifact that belongs with `package.json`.
