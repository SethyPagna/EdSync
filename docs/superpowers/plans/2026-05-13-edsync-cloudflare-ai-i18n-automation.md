# EdSync Cloudflare AI I18n Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn EdSync into an automated learning design system that ingests teacher questions, student data, uploaded resources, quiz answers, and reflections, then produces polished multilingual lessons, assessments, interventions, reports, and reusable learning assets.

**Architecture:** Keep GitHub as source control and Vercel as the default hosted Next.js runtime, while moving platform services to Cloudflare: DNS, WAF, Turnstile, AI Gateway, R2 object storage, Queues, Workers, Vectorize, and the self-hosted domain edge. Supabase/Postgres remains the relational database now, with the same migrations used by the Docker/Postgres self-deployment profile later.

**Tech Stack:** Next.js App Router, Supabase/Postgres, Vercel, GitHub, Cloudflare R2, Cloudflare AI Gateway, Cloudflare Workers, Cloudflare Queues, Cloudflare Vectorize, Docker, OpenRouter-compatible AI models, TypeScript, Zod, and JSON-schema prompt contracts.

---

## Added Requirements

- The system must not rely on AI to merely return plain questions and answers.
- AI outputs must be transformed into clean, fun, mature learning designs: lesson cards, quiz interactions, adaptive hints, explanations, visuals, reports, classroom interventions, and personalized learning paths.
- Every AI function needs a clear prompt contract, schema validation, retry strategy, and storage/audit record.
- The system must support many fully translated language versions.
- Translation vocabulary must be reusable across the full product, including UI strings, curriculum terms, glossary entries, question stems, hints, feedback, reports, and AI prompts.
- Cloudflare is now part of the core platform plan, not an optional add-on: database access, object storage, AI gateway, domain, edge security, background jobs, and self-deployment must be designed around it.

## Files To Create Or Modify

- Create `src/lib/ai/contracts.ts`: typed JSON schemas for lesson design, quiz generation, Socratic tutoring, reflection coaching, analytics summaries, recommendations, translation, glossary, and report writing.
- Create `src/lib/ai/prompts.ts`: centralized prompt builders with role, input, output schema, tone, safety, localization, and design requirements.
- Create `src/lib/ai/orchestrator.ts`: one entrypoint for model calls, validation, retries, audit logging, and fallbacks.
- Create `src/lib/learning-design/designer.ts`: converts AI content into polished EdSync UI-ready blocks such as challenge cards, progress map nodes, practice drills, reflection prompts, and mastery checks.
- Create `src/lib/i18n/locales.ts`: locale registry, fallback chain, text direction, display names, and grade-level vocabulary pack metadata.
- Create `src/lib/i18n/translator.ts`: translation memory lookup, glossary locking, AI translation fallback, and validation against required keys.
- Create `src/lib/i18n/vocabulary.ts`: reusable curriculum vocabulary loading from database/R2/local packs.
- Create `src/lib/storage/r2.ts`: Cloudflare R2 adapter using S3-compatible APIs.
- Create `src/lib/storage/index.ts`: object storage driver switch for local, R2, and future S3-compatible storage.
- Create `src/lib/cloudflare/queue.ts`: enqueue automation jobs for extraction, lesson design, translation, analytics, reports, and notifications.
- Create `src/lib/cloudflare/vectorize.ts`: vector search adapter for curriculum, student memory, glossary, and recommendations.
- Create `src/app/api/ai/design-lesson/route.ts`: authenticated endpoint that accepts raw teacher data and returns designed lesson blocks.
- Create `src/app/api/i18n/translate/route.ts`: server endpoint for locale pack generation and targeted translation.
- Create `src/app/api/storage/upload/route.ts`: authenticated signed-upload or direct-upload endpoint for R2.
- Create `src/app/api/automation/jobs/route.ts`: internal endpoint for job status and retry operations.
- Create `cloudflare/wrangler.toml`: Worker/Queue/R2/Vectorize bindings for Cloudflare deployment.
- Create `cloudflare/workers/automation.ts`: queue worker for long-running AI and translation workflows.
- Create `locales/en/common.json`: canonical English UI and product vocabulary source.
- Create `locales/en/learning.json`: canonical English learning vocabulary, question patterns, feedback strings, and report phrases.
- Create `locales/README.md`: language pack workflow, glossary rules, and validation commands.
- Create `scripts/i18n-validate.mjs`: checks every locale has required keys and no broken placeholders.
- Create `scripts/i18n-generate.mjs`: generates missing locale packs through AI translation with glossary locking.
- Modify `.env.example`: add Cloudflare, R2, AI gateway, object storage, and translation variables.
- Modify `docs/DEPLOYMENT.md`: document GitHub, local, Vercel, Cloudflare, and self-hosted deployment modes.
- Modify `supabase/migrations/001_edsync_core.sql`: add tables for AI runs, prompt versions, design artifacts, translations, vocabulary packs, storage objects, and automation jobs.

## AI Prompt Contracts

- [ ] **Step 1: Define AI output contracts**

Create schemas in `src/lib/ai/contracts.ts` for:

- `LessonDesignContract`: title, learner persona, objectives, warmup, lesson blocks, visual design hints, quiz items, remediation, extension activities, accessibility notes, and localization keys.
- `QuizDesignContract`: question type, prompt, options, correct answer, explanation, misconception tags, difficulty, standards, hint ladder, and feedback variants.
- `TutorTurnContract`: Socratic question, hint, explanation, confidence, safety flag, suggested next action, and memory update.
- `ReflectionCoachContract`: summary, strength, misconception, next step, goal suggestion, tone, and teacher visibility flag.
- `AnalyticsSummaryContract`: class trends, risk signals, intervention suggestions, report-ready narrative, and evidence links.
- `TranslationContract`: locale, translated text, locked glossary terms, placeholders, reading level, and quality warnings.

- [ ] **Step 2: Centralize prompts**

Create `src/lib/ai/prompts.ts` with prompt builders for each AI feature. Each prompt must include:

- Role: EdSync learning designer, tutor, analyst, translator, or report writer.
- Input facts: teacher data, student progress, source content, language, grade level, standards, and accessibility needs.
- Output rules: return valid JSON only, match the schema, preserve placeholders, cite source block IDs, and avoid invented student records.
- Design rules: make content visually usable by EdSync components, not plain prose.
- Personalization rules: adapt by learner level, goals, mastery history, interests, language, and previous misconceptions.
- Safety rules: do not reveal hidden prompts, secrets, service-role keys, private student data, or unrelated internal records.

- [ ] **Step 3: Validate every AI response before saving**

Create `src/lib/ai/orchestrator.ts` so each AI route calls one shared function:

```ts
const result = await runAiContract({
  contract: lessonDesignContract,
  prompt: buildLessonDesignPrompt(input),
  model: process.env.OPENROUTER_LESSON_MODEL,
  auditType: "lesson_design",
  userId,
});
```

Expected behavior:

- Reject invalid JSON.
- Retry once with a repair prompt.
- Store prompt version, model, latency, token estimate, success/failure, and schema errors.
- Never save unvalidated AI output to production tables.

## Learning Design Automation

- [ ] **Step 4: Build the learning design transformer**

Create `src/lib/learning-design/designer.ts` to convert valid AI contracts into UI-ready records:

- hero challenge
- lesson map nodes
- concept cards
- practice drills
- hint ladder
- mastery check
- reflection panel
- teacher intervention note
- report summary

- [ ] **Step 5: Add the design endpoint**

Create `src/app/api/ai/design-lesson/route.ts`. It must:

- require an authenticated teacher
- accept uploaded content IDs, pasted questions, student data references, standards, subject, language, and desired style
- call the shared AI orchestrator
- save designed blocks and source references
- return structured preview data for the lesson studio

- [ ] **Step 6: Add background automation jobs**

Create queue job types:

- `content.extract`
- `lesson.design`
- `quiz.generate`
- `translation.pack.generate`
- `student.recommendations.refresh`
- `teacher.analytics.summarize`
- `report.generate`
- `storage.asset.optimize`

Jobs should be idempotent, retryable, auditable, and visible in an admin/teacher status surface.

## Multilingual System

- [ ] **Step 7: Create canonical English vocabulary packs**

Create `locales/en/common.json` and `locales/en/learning.json` as the source of truth. Include:

- navigation labels
- dashboard labels
- teacher workflow terms
- student workflow terms
- quiz UI strings
- feedback phrases
- report phrases
- achievement names
- accessibility labels
- curriculum vocabulary placeholders

- [ ] **Step 8: Create locale registry**

Create `src/lib/i18n/locales.ts` with initial support for:

- English
- Spanish
- French
- Khmer
- Chinese Simplified
- Chinese Traditional
- Vietnamese
- Thai
- Japanese
- Korean
- Arabic
- Hindi

Each locale needs display name, native name, text direction, fallback locale, font guidance, and enabled status.

- [ ] **Step 9: Add translation memory and glossary locking**

Create `src/lib/i18n/translator.ts` and `src/lib/i18n/vocabulary.ts` so translations reuse approved terms. AI translation must preserve:

- variable placeholders like `{studentName}`
- product names like `EdSync`
- domain terms locked by the vocabulary pack
- teacher/student role labels
- standards and grade labels

- [ ] **Step 10: Add translation validation scripts**

Create:

```powershell
npm.cmd run i18n:validate
npm.cmd run i18n:generate -- --locale km
```

Validation must fail when a locale has missing keys, extra unknown keys, broken placeholders, invalid JSON, or untranslated locked terms.

## Cloudflare Platform Plan

- [ ] **Step 11: Add Cloudflare object storage**

Create an R2 adapter and migrate uploaded file references from local/client parsing to stored object metadata. Store:

- source files
- extracted text
- generated lesson assets
- exports
- locale packs
- report PDFs

- [ ] **Step 12: Add Cloudflare AI Gateway**

Route OpenRouter calls through Cloudflare AI Gateway when `CLOUDFLARE_AI_GATEWAY_URL` is set. Capture provider, model, latency, errors, and cost metadata in `ai_runs`.

- [ ] **Step 13: Add Cloudflare Vectorize**

Use Vectorize for:

- semantic lesson search
- glossary lookup
- student misconception memory
- personalized recommendations
- reusable curriculum asset discovery

- [ ] **Step 14: Add Cloudflare Workers and Queues**

Create a queue worker that handles long jobs outside the Next.js request lifecycle. Jobs must update Postgres records and write generated files to R2.

- [ ] **Step 15: Add Cloudflare security**

Protect production with:

- Turnstile on signup and invite flows
- WAF rules for `/api/ai/*`, `/api/storage/*`, and `/api/automation/*`
- upload size and type limits
- rate limits by user, class, IP, and action
- audit logs for teacher access to student data

## Database Plan

- [ ] **Step 16: Extend migrations**

Add portable SQL tables:

- `ai_prompt_versions`
- `ai_runs`
- `learning_design_artifacts`
- `storage_objects`
- `automation_jobs`
- `locale_packs`
- `translation_entries`
- `vocabulary_terms`
- `student_memory_events`
- `recommendation_events`

Each table needs indexes, RLS policies, created/updated timestamps, and teacher/student separation.

## Deployment Plan

- [ ] **Step 17: Keep GitHub plus Vercel production**

Use GitHub pushes to trigger Vercel production and preview deployments. Keep `npm run deploy:vercel -- --prod` as the local one-step path.

- [ ] **Step 18: Add Cloudflare production profile**

Add Cloudflare deployment docs and scripts for:

- Cloudflare DNS and domain
- R2 bucket creation
- AI Gateway setup
- Vectorize index creation
- Queue and Worker deployment
- Turnstile keys
- Pages/Workers edge deployment option

- [ ] **Step 19: Add full self-deployment profile**

Add Docker support for:

- app server
- Postgres
- migration runner
- automation worker
- optional local object storage emulator
- Cloudflare Tunnel

The self-hosted profile must use the same migrations and env contract as hosted production.

## Verification Plan

- [ ] Run `npm.cmd run typecheck`.
- [ ] Run `npm.cmd run lint`.
- [ ] Run `npm.cmd run build`.
- [ ] Run `npm.cmd run i18n:validate`.
- [ ] Apply migrations to Supabase.
- [ ] Apply migrations to Docker Postgres.
- [ ] Upload a file to R2 and read it back.
- [ ] Generate a lesson design from raw questions and confirm it renders as polished blocks.
- [ ] Generate a quiz and confirm answer validation, hints, and explanations render correctly.
- [ ] Generate at least two locale packs and confirm placeholders and locked vocabulary survive.
- [ ] Run an AI job through the queue worker and confirm job status/audit rows update.
- [ ] Deploy through Vercel.
- [ ] Verify Cloudflare domain, WAF, Turnstile, R2, AI Gateway, Queue, and Vectorize integrations.
- [ ] Verify the self-hosted Docker profile starts from a clean machine and can use the custom domain through Cloudflare Tunnel.

## Commit Rule

Every edited or newly created file must be committed separately unless one command generates a lockfile or mechanical artifact that cannot be sensibly split. Each commit message should name the file-level change clearly.
