# EdSync Improvement Progress

**Last Updated:** 2026-05-18

**Current Track:** Comprehensive workflow, design, architecture, AI, templates, lessons, slides, discussions, quizzes, activities, and tracking improvements.

**Repository Rules:**
- Branch: `main`
- Commit pattern: one edited/added/removed file per commit
- Push pattern: push `main` after every successful commit
- Secrets: never commit secrets
- Cloudflare resources: keep EdSync separate from AllChess and LEARN

---

## Status Summary

| Phase | Name | Status | Target Outcome |
| --- | --- | --- | --- |
| 1 | Product Inventory And Baseline | Complete | Existing features, routes, and data models are mapped in `docs/BASELINE_INVENTORY.md`. |
| 2 | Workflow Map And Navigation Model | Complete | Teacher workflow, navigation handoffs, and saved states are mapped in `docs/WORKFLOW_NAVIGATION_MODEL.md`. |
| 3 | Core Learning Object Architecture | In progress | Shared content model foundation exists; page and API adoption is next. |
| 4 | Studio Component Refactor | Not started | Studio is split into maintainable modules. |
| 5 | Template System Foundation | Not started | Reusable generated/manual templates are modeled and searchable. |
| 6 | Template Application And Auto Update | Not started | Template changes update full lesson packages while preserving content. |
| 7 | Template Import, Export, And Marketplace Readiness | Not started | Templates can be safely imported/exported. |
| 8 | AI Prompt Contract System | Not started | Every AI tool uses targeted prompts and schemas. |
| 9 | AI Response Validation, Repair, And Selective Import | Not started | AI responses are validated, repaired, previewed, and selectively inserted. |
| 10 | Lesson Builder Upgrade | Not started | Manual and generated lessons share a rich editable structure. |
| 11 | Slide And PPT Design System | Not started | Slides and PPT exports are polished and template-aware. |
| 12 | Discussion Engine | Not started | Lessons generate structured classroom and online discussions. |
| 13 | Quiz And Assessment Engine | Not started | Quizzes support diverse question types and analytics. |
| 14 | Activity And Practice Diversity | Not started | Lessons generate varied activities and practice modes. |
| 15 | Media, Import, And Source Handling | Not started | Diverse source imports generate traceable learning packages. |
| 16 | Collaboration, Versioning, And Review | Not started | Content has snapshots, review states, and restore paths. |
| 17 | Personalization And Accessibility | Not started | Content adapts to learners and passes accessibility checks. |
| 18 | Analytics And Continuous Improvement | Not started | Usage and assessment data improve learning content. |
| 19 | Quality Gates, Testing, And Deployment Workflow | Not started | Tests and deployment checks protect the platform. |
| 20 | Launch Readiness And Operating Rhythm | Not started | Delivery rhythm, docs, and smoke tests are stable. |
| 21 | Public Intro, Workflow Slides, Search, And Launch Motion Redesign | Planned | Intro/workflow/search polish is tracked as the next public launch refinement. |
| 22 | Deep Data Architecture, Schema, And Learning Flow Audit | Complete | Actual D1 schema, code access paths, relationships, risks, and improvement proposal are documented. |

---

## Current Focus

**Next Target:** Phase 3, Core Learning Object Architecture.

**Immediate Tasks:**
- [x] Inventory routes by role and feature.
- [x] Inventory data models and migrations.
- [x] Inventory AI endpoints, prompt contracts, and validators.
- [x] Inventory Studio, lesson, slide, practice, quiz, discussion, and template capabilities.
- [x] Mark capabilities as `keep`, `refactor`, `merge`, or `replace`.
- [x] Define the teacher idea-to-assignment workflow.
- [x] Define canonical handoffs between Studio, Lessons, Slides, Practice, Discussions, and Analytics.
- [x] Define saved-state labels and where they appear in navigation.
- [x] Define shared `LearningObject`, `LearningBlock`, and workflow-state types.
- [x] Add legacy adapters for Studio documents, lesson sections, quiz questions, and content blocks.
- [x] Add tests for normalization from existing records into the shared model.
- [x] Export shared learning-object helpers into the first teacher lesson or Studio integration point.
- [x] Replace duplicated content-block status/type display in Studio with shared adapters.
- [ ] Replace duplicated section and quiz normalization in large lesson page files with shared adapters.
- [x] Add teacher lesson package summary integration using `lessonRowsToLearningObject`.
- [x] Audit D1 schema, serializers, service code, API routes, and legacy client data access.
- [x] Document detailed relationships, JSON/document fields, current flow strengths, weak spots, and schema improvement order.

**Known Starting Context:**
- Studio already contains lessons, notes, docs, sheets, slides, practice, content blocks, local drafts, server save/publish/archive/delete, simple templates, transitions, animations, and AI entry points.
- A related detailed plan already exists at `docs/superpowers/plans/2026-05-16-edsync-lessons-slides-platform.md`.
- Phase 1 inventory is recorded at `docs/BASELINE_INVENTORY.md`.
- Phase 2 workflow and navigation model is recorded at `docs/WORKFLOW_NAVIGATION_MODEL.md`.

---

## Decision Log

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-05-16 | Use `plan.md` for the comprehensive roadmap and `progress.md` for execution tracking. | The user requested simple root-level tracking files for better continuity. |
| 2026-05-16 | Treat generated and manual lessons as the same editable learning package model. | This avoids separate workflows that drift apart and makes templates reusable. |
| 2026-05-16 | Protect teacher-authored content when templates are reapplied. | Template changes should improve design without destroying classroom edits. |
| 2026-05-16 | Require schema validation and selective import for AI output. | AI content should be useful drafts, not unchecked writes into lessons. |
| 2026-05-16 | Treat `/studio` as the canonical authoring workspace and keep `/notes`, `/docs`, `/sheets`, `/slides`, `/practice`, `/quizzes`, and `/games` as stable entry routes. | The inventory shows these routes already exist and can converge around one workflow without breaking links. |
| 2026-05-16 | Start architecture work by extracting large teacher lesson, student lesson, and Studio files before adding more heavy UI. | The largest files are 2355, 2111, 1782, and 1394 lines and concentrate too much logic. |
| 2026-05-16 | Use one product spine from catalog or organization portal through Studio, assignment, student practice, grade events, feedback, and content improvement. | The app has many capable pages; the main maturity gap is making them behave like one learning loop. |
| 2026-05-16 | Standardize saved states as local draft, server draft, needs review, published, assigned, archived, and conflict. | Users need consistent status language across Studio, lessons, practice, assignments, and catalog publishing. |
| 2026-05-16 | Keep the first learning-object layer as adapters over current tables instead of a schema-breaking rewrite. | Existing routes and D1 data stay stable while Studio, lessons, quizzes, and content blocks converge through shared contracts. |
| 2026-05-16 | Compose legacy lesson rows into learning packages before changing database schema. | Teacher/student lesson pages can adopt the shared model incrementally while current D1 rows remain compatible. |
| 2026-05-18 | Treat `docs/DATA_SCHEMA_AUDIT.md` as the current source for schema and data-flow improvement priorities. | The audit verifies migrations against serializers and API/page access paths, then orders the next architecture work around tenant context, feature APIs, Studio as source, and event-derived grades. |

---

## Verification Log

| Date | Scope | Command | Result |
| --- | --- | --- | --- |
| 2026-05-16 | Planning docs | Manual Markdown review | Passed |
| 2026-05-16 | Phase 1 inventory | Route, migration, schema, API, Studio, and large-file scan | Passed |
| 2026-05-16 | Phase 2 workflow model | Workflow, navigation, handoff, saved-state, and next-action review | Passed |
| 2026-05-16 | Phase 3 learning-object foundation | `npm.cmd run typecheck`; `npm.cmd run test -- src/lib/learning/objects.test.ts` | Passed |
| 2026-05-16 | Phase 3 lesson-package composer and Studio integration | `npm.cmd run typecheck`; `npm.cmd run test -- src/lib/learning/objects.test.ts src/lib/learning/lesson-package.test.ts`; `npm.cmd run lint` | Passed |
| 2026-05-16 | Phase 3 teacher lesson package summary | `npm.cmd run typecheck`; `npm.cmd run lint`; `npm.cmd run test -- src/lib/learning/lesson-package.test.ts` | Passed |
| 2026-05-16 | Public intro launch redesign | `npm.cmd run typecheck`; `npm.cmd run lint`; `npm.cmd run test`; `npm.cmd run build`; headless Chrome and Playwright screenshots at desktop/mobile/gallery viewports | Passed |
| 2026-05-16 | Interactive workflow showcase redesign | `npm.cmd run typecheck`; `npm.cmd run lint`; Playwright screenshots at hero, workflow desktop, and workflow mobile viewports | Passed |
| 2026-05-16 | Public intro performance pass | `npm.cmd run typecheck`; `npm.cmd run lint`; `npm.cmd run test`; `npm.cmd run build`; desktop/mobile workflow smoke review | Passed |
| 2026-05-17 | Intro-to-workflow gallery refinement | `npm.cmd run typecheck`; `npm.cmd run lint`; `npm.cmd run test`; `npm.cmd run build`; browser screenshots at hero, transition, workflow desktop, and workflow mobile viewports | Passed |
| 2026-05-17 | Concrete EdSync slide-scenes redesign | `npm.cmd run typecheck`; `npm.cmd run lint`; `npm.cmd run test`; `npm.cmd run build`; browser screenshots at hero, workflow, search, results, and mobile viewports | Passed |
| 2026-05-17 | Dark reference-style catalog hero | `npm.cmd run typecheck`; `npm.cmd run lint`; `npm.cmd run test`; `npm.cmd run build`; browser screenshot review for hero and workflow contrast | Passed |
| 2026-05-17 | LEARN-style intro link and workflow gallery pass | `npm.cmd run typecheck`; `npm.cmd run lint`; `npm.cmd run test`; `npm.cmd run build`; browser screenshots for `/`, `/showcase`, and mobile intro links | Passed |
| 2026-05-17 | LEARN-style public launch redo | `npm.cmd run typecheck`; `npm.cmd run lint`; `npm.cmd run test`; `npm.cmd run build`; in-app browser hero/workflow/theme/language QA; Chrome desktop/mobile screenshots | Passed locally |
| 2026-05-18 | Phase 22 schema and learning-flow audit | Migration, serializer, API route, tenant helper, event helper, generic data access, and `edsync.from(...)` sweep | Passed |
| 2026-05-18 | Phase 22 hot-path index migration | Manual SQL review for additive `CREATE INDEX IF NOT EXISTS` migration on lesson, assignment, progress, submission, catalog, tenant link, and notification paths | Passed |
| 2026-05-18 | Cloudflare D1 remote migration | `npm.cmd run db:migrate` against `edsync-dev-d1`; final index migration processed 10 queries and wrote 10 index changes | Passed |
| 2026-05-18 | Worker-native D1 adapter | `npm.cmd run typecheck`; `npm.cmd run lint`; `npm.cmd run test`; `npm.cmd run build`; `npm.cmd run deploy:cloudflare:app`; live `/catalog` and `/api/catalog` smoke | Passed |
| 2026-05-18 | Active tenant context | `npm.cmd run typecheck`; `npm.cmd run lint`; `npm.cmd run test`; `npm.cmd run build`; `npm.cmd run deploy:cloudflare:app`; live `/catalog` and `/api/catalog` smoke | Passed |

---

## Blockers

- None for Phase 2.

## Risks To Watch

- Studio is already large; implementation should refactor before adding heavy new UI.
- AI generation can truncate or return malformed JSON; validators and repair paths must come before broader generation features.
- Template auto-update can overwrite teacher intent unless protected fields and previews are implemented early.
- PPT export can diverge from web preview unless slide layout tokens are shared.
- Analytics must remain tenant-safe and role-safe.
- Public language copy currently includes mojibake in several non-English entries and should be corrected during the i18n polish pass.
- Generic data access and tenant read scoping remain architecture risks for later phases.

## Phase 1 Baseline Summary

- Route inventory is grouped by public/auth, admin, teacher, student, Studio/tooling, and API groups in `docs/BASELINE_INVENTORY.md`.
- Data model inventory is grouped by identity/tenancy, lessons/progress, work/grades/discussions, Studio/practice, media/import/standards, AI/automation/security, and billing/certifications/offline/analytics.
- Capability decisions are marked as `keep`, `refactor`, or `merge`.
- Major overlap areas are lesson sections vs Studio documents/content blocks, slide summaries vs lesson slides, practice items vs quiz/work questions, prompt contracts vs workflow prompts, and public org selection vs auth organization mode.
- The first refactor candidates are `src/app/teacher/lessons/[id]/page.tsx`, `src/app/student/lessons/[id]/page.tsx`, `src/app/teacher/lessons/create/page.tsx`, and `src/components/studio/StudioWorkspace.tsx`.

## Phase 2 Workflow Summary

- The canonical product spine is visitor discovery, auth/organization context, role dashboard, Studio authoring, lesson package creation, assignment, student learning, grade events, feedback, recommendations, and content improvement.
- Teacher creation flows now have a defined path from topic/file/template/previous lesson to Studio source, lesson package, slides, practice, discussion, publish, assign, review, and improve.
- Student flows are grouped into home, learn, practice, discuss, reflect, and feedback.
- Handoff payloads require shared metadata such as tenant, owner, source, title, audience, objectives, tags, language, duration, difficulty, status, and version.
- Saved states are standardized as `Local draft`, `Server draft`, `Needs review`, `Published`, `Assigned`, `Archived`, and `Conflict`.

## Phase 3 Foundation Summary

- Added `src/lib/learning/objects.ts` with `LearningObject`, `LearningBlock`, `LearningWorkflowState`, source types, block types, state labels, and normalization helpers.
- Added adapters for legacy Studio documents, lesson sections, quiz questions, and content blocks.
- Added focused tests in `src/lib/learning/objects.test.ts` for state labels, tag normalization, Studio conversion, lesson section conversion, quiz conversion, content block conversion, and composed legacy objects.
- Added `src/lib/learning/lesson-package.ts` to compose legacy lesson rows, lesson sections, and quiz questions into a package-level `LearningObject`.
- Added `src/lib/learning/lesson-package.test.ts` for package composition and UI summary counts.
- Updated Studio's saved block library to use shared learning-object state labels and block type mapping.
- Updated the teacher lesson editor header to summarize the current lesson through `lessonRowsToLearningObject`, including shared state, block count, and package duration.
- Phase 3 remains in progress until large teacher/student lesson pages consume the shared layer and duplicated section/quiz normalization is removed.

## Phase 22 Schema Audit Summary

- Added `docs/DATA_SCHEMA_AUDIT.md` with the current D1 schema grouped by identity/auth, tenancy, lessons, Studio, work/grades, engagement, media/security, AI, automation, analytics, billing, and offline sync.
- Verified the schema against `src/lib/db/schema.ts`, the tenant helpers, D1 REST adapter, learning event helpers, and key APIs for Studio, work, submissions, grades, billing, catalog, content blocks, standards, practice, and generic data access.
- The strongest current pattern is the tenant-scoped API layer for newer features plus `learning_events` as the future replay/audit spine.
- The main architecture risks are broad legacy `edsync.from(...)` reads/writes, generic allowed-table reads through `/api/data`, implicit default tenant membership creation, REST-only D1 access on Cloudflare runtime, and gradebook materialization that is not fully replay-derived yet.
- Recommended next order: explicit active tenant context, feature-owned APIs for teacher/student lesson/dashboard flows, tenant enforcement for legacy lesson/progress records, Studio as canonical authoring source, hot-path indexes, grade replay service, Worker-native D1 adapter, and a richer offline queue/replay UX.
- Added `database/migrations/0008_hot_path_indexes.sql` with additive indexes for lesson dashboards, lesson ordering, quiz ordering, student assignments, progress lookups, work submissions, catalog products, tenant object links, and notification lists.
- Applied the migration set to remote Cloudflare D1 database `edsync-dev-d1`; the final hot-path index migration completed successfully.
- Added a D1 query adapter boundary so Cloudflare Workers can use the native `EDSYNC_DB` binding while Vercel/local/Docker keep the existing REST fallback.
- Deployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `cb7a1cb3-4d42-4c3e-a4fb-f1dc8b75422c`.
- Added an HTTP-only `edsync_active_tenant` cookie for organization login/signup, clear it on logout, and made tenant resolution prefer a validated active tenant after custom-domain routing.
- Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `9375ee85-c8d1-40b1-bd38-905ff76b3319`.

## Public Intro Redesign Summary

- Replaced the word-heavy catalog intro with a compact launch-style hook and animated product-preview deck.
- Added a horizontal product gallery that previews Studio, teacher workflow, student practice, admin command, and discussion surfaces.
- Tightened mobile header behavior so the public topbar keeps theme/language controls visible without clipping.
- Added responsive motion and overflow safeguards for desktop and mobile.
- Split the workflow showcase into a dedicated interactive component with sticky overlay-style scrolling, clickable slide dots, previous/next controls, and concrete screen previews for Studio, AI, teacher dashboard, student practice, admin command, and discussion.
- Refined the intro again after live browser review: the hook now maps to the real EdSync spine, the first preview shows catalog, organization, Studio, practice, admin, assignment, AI review, and grade-event states without clipping, and the scroll bridge now previews actual route handoffs instead of generic labels.
- Verification for this pass: local Chrome screenshots covered light desktop, dark desktop, mobile, workflow bridge, and the dedicated showcase page with no horizontal overflow. `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed.
- Refined the intro/workflow connection so `View workflow` stays on the catalog page, the product preview is larger and clearer, organization/teacher labels no longer collide, and workflow gallery controls change slides in place instead of scrolling the page.
- Browser verification for this pass confirmed dot navigation changes active slides with `jump: 0`, autoplay advances slides without moving scroll, and desktop/mobile intro views have no horizontal overflow. `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed.
- Reworked the public intro/workflow style closer to the LEARN reference: transparent launch header controls, dark cinematic workflow stage, left narrative panel, realistic app window preview, and bottom tab navigation for Dashboard/Studio/AI/Practice/Admin/Catalog style slides.
- Verification for this pass: local browser smoke confirmed no horizontal overflow, transparent public header in dark mode, in-place workflow tab switching with no scroll jump, and successful `typecheck`, `lint`, `test`, and `build`.
- Replaced the public catalog topbar on `/catalog` and `/showcase` with a floating launch chrome, rebuilt the hero around a larger concrete EdSync workspace preview, set the public launch surface to dark-first, reordered workflow slides around Catalog, Studio, AI, Review, Practice, and Progress, and made language selection fall back to clean English public copy while preserving full language names.
- Verification for this pass: local in-app browser QA confirmed no conventional public topbar, dark/light toggle persistence, language menu full-name options, in-place workflow tab switching, and no desktop horizontal overflow. Headless Chrome desktop/mobile screenshots were reviewed; mobile headless Chrome appears to enforce a wider CSS layout than the captured bitmap, so final live smoke should still check a real narrow browser viewport after deploy.
- Continued public launch polish on 2026-05-17: tightened the workflow story into shorter product-specific slide copy, replaced the workflow mini nav with a compact auto-playing gallery label, widened the app preview area, shortened the intro-to-workflow bridge, and moved mobile theme/language/sign-in controls into a compact top-right cluster.
- Verification for this pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed. Local desktop, mobile, and workflow screenshots were reviewed after restarting the Next dev server.
- Continued public language and performance polish on 2026-05-17: replaced mojibake public translations with clean UTF-8 copy, made `/catalog?language=...` render localized public copy, made the language menu update the catalog language query, split lightweight language metadata away from the full translation table to keep the client bundle small, and tuned mobile hero type for longer translated hooks.
- Verification for this pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed. Build output kept `/catalog` at `104 kB` first-load JS, and local Spanish desktop/mobile screenshots plus workflow-anchor screenshots were reviewed.
- Continued screenshot-directed public launch fixes on 2026-05-18: removed the separate visitor topbar from `/catalog`, moved EdSync brand/actions/theme/language/direct jumps into the hero line area, removed the public-catalog watermark/status copy, replaced the hero browser frame with an open EdSync workspace preview, compacted the function tags, merged the workflow intro into slide 1, and combined catalog search/results into one availability surface.
- Verification for this pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed. Local production preview on `http://127.0.0.1:3300/catalog` returned 200, and headless Chrome desktop/mobile screenshots were reviewed for hero spacing, mobile controls, preview contrast, and no clipped top controls. Remaining visual risk: hash screenshots for sticky workflow/search anchors in headless Chrome are unreliable, so final deployed browser smoke should still check real scroll behavior manually.
- Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `4b886979-2340-4c55-91b6-64ff2e0d4d4d`. Live smoke checks returned 200 for `/catalog` and `/showcase`, and `/api/catalog` returned an empty catalog payload without errors.
- Continued public launch refinement on 2026-05-18: added discrete wheel/touch workflow slide stepping while preserving normal page scroll, reduced workflow height and the workflow-to-catalog gap, tightened mobile hero/preview spacing, and cropped the mobile preview so the first viewport stays cleaner.
- Verification for this pass: initial parallel typecheck raced with `.next` regeneration and failed on missing generated `.next/types` files; after `npm.cmd run build` regenerated `.next`, sequential `npm.cmd run typecheck` and `npm.cmd run lint` passed. `npm.cmd run test` and `npm.cmd run build` also passed. Local production preview on `http://127.0.0.1:3400/catalog` returned 200, and desktop/mobile headless Chrome screenshots were reviewed.
- Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `9969daee-461d-490a-a7b0-3475d5b625d0`. Live smoke checks returned 200 for `/catalog` and `/showcase`, and `/api/catalog` returned an empty catalog payload without errors.
- Continued public launch i18n/showcase polish on 2026-05-18: added lightweight localized language-menu labels, made `/catalog?language=...` drive the hero controls as well as the main headline/body, shortened long translated hero hooks, added language-specific hero sizing for Korean/Khmer/Thai, and removed the leftover public topbar chrome from `/showcase`.
- Verification for this pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed. Local production preview on `http://127.0.0.1:3500/catalog?language=Korean` returned 200, and desktop/mobile Korean screenshots plus `/showcase` screenshots were reviewed for localized controls, no topbar, and better mobile headline scale.
- Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `696d27fd-d722-4208-a9eb-a5427bb72eb3`. Live smoke checks returned 200 for `/catalog`, `/catalog?language=Korean`, and `/showcase`, and `/api/catalog` returned an empty catalog payload without errors.
- Continued public launch refinement on 2026-05-19: localized the hero preview mockup labels for public languages, including the preview nav, lesson studio status, slide label, linked-media line, loop actions, and metric labels. Simplified the mobile preview by hiding the mini preview rail and extra loop/proof rows so the first phone viewport reads cleaner.
- Verification for this pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed. Local production preview on `http://127.0.0.1:3501/catalog?language=Korean` returned 200, and desktop/mobile Korean screenshots were reviewed for localized preview labels and reduced mobile clutter.
- Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `c79ac9bd-385c-4125-bbd9-5f7e2d6df033`. Live smoke checks returned 200 for `/catalog?language=Korean` and `/showcase`, and `/api/catalog` returned an empty catalog payload without errors.
- Added Phase 23 to `plan.md` for source organization, folder grouping, compatibility shims, runtime language strategy, and cleanup. Decision: keep TypeScript/React as the primary request-path language for Next.js/Cloudflare/Vercel compatibility; consider Rust/WASM only for profiled CPU-heavy isolated utilities such as standards parsing, document conversion, media signature checks, or large import normalization.
- Began Phase 23 with a safe public helper grouping slice: moved public language metadata to `src/lib/public/languages.ts`, moved public copy/i18n data to `src/lib/public/i18n.ts`, updated public UI/tests to import from the grouped paths, and removed the old flat shim files after `rg` confirmed no references remained.
- Verification for this organization pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed. Build output kept `/catalog` at `105 kB` first-load JS, so the grouping did not add public bundle weight.
- Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `23403c89-5101-4a2a-a268-4b79e286af47`. Live smoke checks returned 200 for `/catalog` and `/showcase`, and `/api/catalog` returned an empty catalog payload without errors.
- Continued workspace shell refinement on 2026-05-19: removed misleading hardcoded sidebar markers such as fake counts and the Studio `S`, wrapped shared tool routes (`/studio`, `/ai`, `/practice`, `/notes`, `/docs`, `/sheets`, `/slides`, `/quizzes`, `/games`) in the role-aware workspace shell, made protected mobile auth redirects narrower and icon-only, quieted empty notification status, added role-aware shell accent color, added desktop gutters between sidebar and page content, and replaced Studio's fake unsaved count with a draft dot.
- Verification for this shell pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed. Local production preview on `http://127.0.0.1:3502/auth/login` returned 200, and a mobile headless Chrome screenshot confirmed the login card and theme/language icons no longer clip.
- Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `4d1310c1-87ed-4eaf-aabb-95a21c15713e`. Live smoke checks returned 200 for `/catalog` and `/auth/login`, `/studio` returned the expected unauthenticated 307 redirect, and `/api/catalog` returned an empty catalog payload without errors.
- Continued shell responsiveness on 2026-05-19: compacted the protected mobile header to keep the brand icon, theme, language, and notifications from crowding narrow screens; clamped the mobile drawer to the viewport; and restored focused admin Governance links for Standards, Certifications, and Automation so those pages remain visibly connected in the sidebar.
- Verification for this follow-up: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed.
- Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `3bf2f508-dcc4-4c92-b9d4-9463c3bfde6b`. Live smoke checks returned 200 for `/catalog` and `/auth/login`, `/admin/dashboard` returned the expected unauthenticated 307 redirect, and `/api/catalog` returned an empty catalog payload without errors.
- Continued public launch refinement on 2026-05-19: replaced the static hero mockup with an auto-playing, dot-controlled EdSync preview gallery for Catalog, Studio, AI, Practice, and Proof/Admin surfaces; each slide now uses concrete route labels and app-like panels for catalog products, lesson slides, AI output, timed practice, and grade evidence. Tightened small-screen public launch controls so EdSync, theme, language, and sign-in remain on one compact line, and simplified the mobile preview rail to keep the first viewport cleaner.
- Verification for this launch gallery pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed. Local production preview on `http://127.0.0.1:3504/catalog` returned 200, and desktop/mobile headless Chrome screenshots were reviewed for gallery dots, auto-advance-ready layout, compact controls, and no clipped top actions.
- Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `eb9aa90f-e770-4f95-a55d-5dae522538dd`. Live smoke checks returned 200 for `/catalog`, `/showcase`, and `/auth/login`, and `/api/catalog` returned an empty catalog payload without errors.
- Continued gallery interaction cleanup on 2026-05-19: hero preview dots and side preview buttons now pause autoplay after manual interaction or focus/hover so the gallery does not immediately jump away from the user-selected slide; selected dots expose `aria-current`, and stale unused workflow bridge props were removed from `/showcase` and the shared workflow component.
- Verification for this cleanup pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed.
- Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `d35f1e6f-3e85-4333-bc4c-0c8d335666d2`. Live smoke checks returned 200 for `/catalog`, `/showcase`, and `/auth/login`, and `/api/catalog` returned an empty catalog payload without errors.
- Continued mobile gallery refinement on 2026-05-19: added swipe gestures and left/right keyboard support to the hero preview gallery, disabled autoplay for `prefers-reduced-motion`, and added a polished focus-visible state for keyboard users.
- Verification for this interaction pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed. Local production preview on `http://127.0.0.1:3505/catalog` returned 200, and desktop/mobile screenshots were reviewed for compact controls, readable gallery content, and no clipped launch actions.
- Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `eb6ad0ce-010f-4df7-9f41-9de7d67a06dd`. Live smoke checks returned 200 for `/catalog`, `/showcase`, and `/auth/login`, and `/api/catalog` returned an empty catalog payload without errors.
- Continued public i18n refinement on 2026-05-19: changed the launch preview gallery to accept server-provided preview copy, kept a compatibility path for existing labels, and wired the catalog hero so preview nav labels, ready/start state, key metrics, and compact block labels reuse the selected public language strings instead of staying fully English.
- Verification for this i18n pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed. Local production preview on `http://127.0.0.1:3506/catalog?language=Spanish` returned 200, and a mobile screenshot was reviewed for localized hero text, compact controls, and localized preview labels without clipping.
- Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `3ba9584b-dc82-4424-b759-907469f4ab60`. Live smoke checks returned 200 for `/catalog?language=Spanish`, `/showcase`, and `/auth/login`, and `/api/catalog` returned an empty catalog payload without errors.
- Continued public preview localization on 2026-05-19: reduced the remaining English-heavy hero preview titles and block summaries by using selected-language public labels for Catalog, Studio, AI, Practice, Grades, Courses, Search, Filters, Duration, Difficulty, Free, and Start across the gallery.
- Verification for this preview label pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed. Local production preview on `http://127.0.0.1:3507/catalog?language=Spanish` returned 200, and a mobile screenshot confirmed the preview uses shorter localized labels without clipping.
- Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `08d9b1d7-ca81-4a45-b251-37ad555e3383`. Live smoke checks returned 200 for `/catalog?language=Spanish`, `/showcase`, and `/auth/login`, and `/api/catalog` returned an empty catalog payload without errors.
- Continued public workflow localization/responsiveness on 2026-05-19: made the workflow showcase consume selected-language public labels, passed catalog/showcase language query values into the workflow, replaced the remaining public intro divider line, compressed the mobile hero/workflow copy, and changed narrow workflow side panels into compact horizontal chips to reduce overflow risk.
- Verification for this pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` passed when run sequentially. A parallel typecheck/build attempt hit the known `.next/types` generation race, then standalone `typecheck` passed after build regeneration. Local production preview on `http://127.0.0.1:3509/catalog?language=Spanish` returned 200, and desktop/mobile/workflow screenshots were reviewed for localized labels, no intro divider line, compact controls, and no visible horizontal overflow.
- Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `dc759a07-1acf-44a7-82a9-6fe52e7a0c02`. Live smoke checks returned 200 for `/catalog?language=Spanish` and `/showcase?language=Spanish`; `/api/catalog` initially had a transient connection failure, then retried successfully with `{"data":{"items":[],"portals":[]},"error":null}`.
- Continued public mockup cleanup on 2026-05-19: removed the old English fallback story from the launch preview gallery, tightened the workflow mockup labels away from specific fake classroom text, added localized utility labels for media/provider/review/security/health, and reduced remaining demo wording in the Spanish workflow view. Remaining i18n depth: technical product terms such as quiz/rubric/slides can be moved into the public copy table in a later pass.
- Verification for this pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed. Local production preview on `http://127.0.0.1:3510/catalog?language=Spanish` returned 200, and mobile/workflow screenshots were reviewed for compact layout, localized Progreso/Medios/Proveedor/Revisión labels, and no horizontal overflow.
- Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `fb9583b7-3e06-4e7d-a4ac-21b379ec83e5`. Live smoke checks returned 200 for `/catalog?language=Spanish` and `/showcase?language=Spanish`; `/api/catalog` initially had a transient connection failure, then retried successfully with `{"data":{"items":[],"portals":[]},"error":null}`.
- Continued public workflow localization on 2026-05-19: expanded workflow mockup utility labels for route, events, audit, slides, quiz, rubric, retry, scoring, submissions, media checks, and admin terms across the supported public languages; replaced the remaining hardcoded English fragments in the workflow slides with those labels.
- Verification for this pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed. Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `2e2c2a4d-1cfe-40c8-8855-680a95723ad1`. Live smoke checks returned 200 for `/catalog?language=Spanish`, `/showcase?language=Spanish`, and `/api/catalog`.
- Continued public catalog localization on 2026-05-19: made catalog cards accept localized labels, passed selected-language labels into global and organization catalog cards, localized the global catalog quick-search chips, removed English-only launch preview metric labels, localized organization catalog filter controls, and fixed the product detail duration copy so flexible courses no longer render as "Flexible minutes."
- Verification for this pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed. Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `1552f9e9-10a4-49a0-9701-3ff037378bda`. Live smoke checks returned 200 for `/catalog?language=Spanish`, `/showcase?language=Spanish`, and `/api/catalog`.
- Continued public org/detail cleanup on 2026-05-19: shortened and localized organization portal hero copy, organization CTAs, side panels, and empty states using existing public language labels; made catalog product detail read selected-language labels for catalog return, duration, difficulty, language, enrollment/status blocks, organization link, and the safe-preview note.
- Verification for this pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed. Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `a234e9d8-c7c1-42a4-b71b-8bdb660bc833`. Live smoke checks returned 200 for `/catalog?language=Spanish`, `/showcase?language=Spanish`, and `/api/catalog`.
- Continued public language-flow cleanup on 2026-05-19: catalog cards now preserve the selected language in course-detail links, free course price badges use localized free labels, global and organization catalogs pass language into cards, and product detail reads the language query or language cookie before linking back to catalog or organization pages.
- Verification for this pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed. Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `d3ef6886-86cc-40a6-b226-aa675ed79649`. Live smoke checks returned 200 for `/catalog?language=Spanish`, `/showcase?language=Spanish`, and `/api/catalog`.
- Continued public navigation continuity on 2026-05-19: added catalog URL helpers so clear-filter links, quick-search chips, category chips, academy cards, organization clear links, and empty-state back-to-catalog links preserve the selected public language instead of silently returning to English.
- Verification for this pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed. Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `5f60e41e-0f30-4325-92d7-e45e9554e6e4`. Live smoke checks returned 200 for `/catalog?language=Spanish`, `/showcase?language=Spanish`, and `/api/catalog`.
- Continued public enrollment localization on 2026-05-19: made `CatalogEnrollButton` accept localized labels and language, localized free price display on product detail, passed selected-language labels into the enroll button, and preserved the language query through enrollment login, success, and cancellation redirects.
- Verification for this pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed. Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `d21618d4-a61f-4cb9-b194-2c1e8d22a5de`. Live smoke checks returned 200 for `/catalog?language=Spanish`, `/showcase?language=Spanish`, and `/api/catalog`.
- Continued public auth-link localization on 2026-05-19: launch hero sign-in/start links, the reusable public topbar, organization portals, and catalog detail pages now preserve the selected public language when sending visitors into login/signup or workspace actions.
- Verification for this pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed. Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `9e370153-ad33-4bda-aa24-b11a73664a80`. Live smoke checks returned 200 for `/catalog?language=Spanish`, `/showcase?language=Spanish`, and `/api/catalog`.
- Continued public auth language handoff on 2026-05-19: the shared language menu now reads `?language=` on any route, persists that preference to local storage/cookies, updates `<html lang>`, and login/signup now preserve the selected language through auth links, signup redirects, organization portal links, and localized public action labels.
- Verification for this pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed. Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `470ba0e4-9a53-46e9-aa34-0293b501db51`. Live smoke checks returned 200 for `/catalog?language=Spanish`, `/showcase?language=Spanish`, `/auth/login?language=Spanish`, `/auth/signup?language=Spanish`, and `/api/catalog`.
- Continued auth localization depth on 2026-05-19: added a focused public auth copy layer and connected login/signup organization controls, account type cards, role cards, form labels, status messages, loading labels, and auth cross-links to selected-language copy with English fallbacks.
- Verification for this pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed. Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `875e5255-9fe4-4114-84a1-60506fa3dc71`. Live smoke checks returned 200 for `/catalog?language=Spanish`, `/showcase?language=Spanish`, `/auth/login?language=Spanish`, `/auth/signup?language=Spanish`, `/auth/login?language=Korean`, and `/api/catalog`.
- Continued auth flow localization completion on 2026-05-19: expanded auth labels for validation/success states, organization-found summaries, email confirmation text, side-panel copy, and organization-benefit copy; login/signup now use those labels for toasts, panel text, and status messages instead of reverting to English mid-flow.
- Verification for this pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed. Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `98488cd1-5710-4e14-94d4-6fe686b3ffdb`. Live smoke checks returned 200 for `/catalog?language=Spanish`, `/showcase?language=Spanish`, `/auth/login?language=Spanish`, `/auth/signup?language=Spanish`, `/auth/login?language=Korean`, and `/api/catalog`.
- Continued public language URL cleanup on 2026-05-19: auth language state now initializes from stored preferences before first paint when no query language is present, and launch/topbar auth links omit redundant `?language=English` while preserving non-default languages.
- Verification for this pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed. Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `015f3425-25ca-4bf4-ae68-e5986300e45f`. Live smoke checks returned 200 for `/catalog`, `/auth/login`, `/catalog?language=Spanish`, `/auth/login?language=Spanish`, `/showcase?language=Spanish`, and `/api/catalog`.
- Continued public i18n hardening on 2026-05-19: added a shared `publicLanguageQuerySuffix` helper, reused it in the auth language hook and launch hero, and strengthened `public-i18n` tests to assert readable Spanish/Korean copy, auth fallback behavior, and default-language URL omission.
- Verification for this pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed; public i18n coverage now reports 65 total tests. Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `f76c8419-a492-4305-a90e-eecd46f5cbbd`. Live smoke checks returned 200 for `/catalog`, `/auth/login`, `/catalog?language=Spanish`, `/auth/login?language=Spanish`, `/showcase?language=Spanish`, and `/api/catalog`.
- Continued catalog language URL consolidation on 2026-05-19: reused the shared public language query helper in catalog cards, the enrollment button, catalog detail links, organization portal links, and enrollment API redirects so default English stays clean while non-default languages remain consistent through public browsing and login/enrollment handoff.
- Verification for this pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed; focused `public-i18n` coverage also passed. Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `e2a0bea1-96e5-4630-8df3-acc31dd55c7f`. Live smoke checks returned 200 for `/catalog`, `/auth/login`, `/catalog?language=Spanish`, `/auth/login?language=Spanish`, `/showcase?language=Spanish`, and `/api/catalog`.
- Continued public catalog link normalization on 2026-05-19: added a reusable public language query value helper, used it in catalog quick/search/category/academy links, and kept organization links on the shared suffix helper so English no longer propagates as a noisy public query while supported non-default languages stay intact.
- Verification for this pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed with 65 tests. Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `5391355d-7eda-4f6e-a904-ca8901b5df41`. Live smoke checks returned 200 for `/catalog`, `/catalog?language=English`, `/catalog?language=Spanish`, `/auth/login?language=Spanish`, `/showcase?language=Spanish`, and `/api/catalog`.
- Continued public catalog filter cleanup on 2026-05-19: split public UI language from catalog course-language filtering by adding `courseLanguage`, preserving the selected UI language through catalog and organization search forms, and keeping the catalog API backward-compatible with legacy `language` course filters while the UI uses `language` only for public copy.
- Verification for this pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed with 66 tests. Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `435232b3-6696-45ca-820d-71409f498130`. Live smoke checks returned 200 for `/catalog?language=Spanish`, `/catalog?language=Spanish&courseLanguage=English`, `/api/catalog?courseLanguage=English`, `/api/catalog?language=English`, `/showcase?language=Spanish`, and `/auth/login?language=Spanish`.
- Continued public auth CTA continuity on 2026-05-19: preserved selected public language through empty-catalog workspace creation, organization portal sign-in/sign-up CTAs, the legacy launch chrome login action, and the standalone workflow back-to-intro link so the visitor flow no longer drops back to English at these entry points.
- Verification for this pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed with 66 tests. Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `6a56912f-df64-4eef-a4d3-f735be5f18a6`. Live smoke checks returned 200 for `/catalog?language=Spanish`, `/showcase?language=Spanish`, `/auth/signup?language=Spanish`, `/auth/login?language=Spanish`, and `/api/catalog`.
- Continued public URL helper consolidation on 2026-05-19: added a reusable `publicLanguageHref` helper and moved public topbar, launch hero, legacy launch chrome, organization auth CTAs, catalog empty-state signup, and workflow return links onto the shared helper so language-aware public links are easier to keep consistent.
- Verification for this pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed with 66 tests; focused public i18n tests cover the new helper. Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `588bd053-c548-4c79-8986-ee11b615b553`. Live smoke checks returned 200 for `/catalog?language=Spanish`, `/showcase?language=Spanish`, `/auth/signup?language=Spanish`, `/auth/login?language=Spanish`, and `/api/catalog`.
- Continued public surface cleanup on 2026-05-19: removed the unused legacy `landing.tsx` surface and the unused `PublicLaunchChrome` component so the codebase no longer carries older topbar-style public UI that conflicts with the current LEARN-style launch/catalog experience.
- Verification for this cleanup pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed with 66 tests. Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `18bf4013-4918-4e37-b586-6f24554b716f`. Live smoke checks returned 200 for `/catalog`, `/catalog?language=Spanish`, `/showcase?language=Spanish`, `/auth/login?language=Spanish`, and `/api/catalog`.
- Continued public CSS cleanup on 2026-05-19: removed stale `.edsync-launch-chrome`, `.edsync-launch-brand`, and `.edsync-launch-actions` rules and mobile overrides left behind by the deleted legacy launch chrome while preserving the shared mark/icon/sign-in styles used by the current inline launch header.
- Verification for this stylesheet pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed with 66 tests. Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `0b1a2574-d14f-451b-b01f-4165c5ca3311`. Live smoke checks returned 200 for `/catalog`, `/catalog?language=Spanish`, `/showcase?language=Spanish`, `/auth/login?language=Spanish`, and `/api/catalog`.
- Continued root public entry cleanup on 2026-05-19: expanded the root catalog search parameter shape to include price, category, difficulty, public language, course language, and duration, and preserved selected public language when root-domain tenant resolution redirects visitors into an organization portal.
- Verification for this root pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed with 66 tests. Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `e76d72b6-dbee-4796-8816-887b4246ccdc`. Live smoke checks returned 200 for `/`, `/?language=Spanish`, `/catalog?language=Spanish&courseLanguage=English`, `/showcase?language=Spanish`, and `/api/catalog`.
- Continued catalog parameter typing cleanup on 2026-05-19: moved the public catalog/root search parameter shape into `CatalogSearchParams` in `catalog-filters`, and reused it from `/` and `/catalog` so language, course-language, and filter routing stay aligned without duplicate page-local types.
- Verification for this typing pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed with 66 tests. Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `b147c578-a9af-471f-a4b4-2c8939ee9e7f`. Live smoke checks returned 200 for `/`, `/?language=Spanish`, `/catalog?language=Spanish&courseLanguage=English`, `/showcase?language=Spanish`, and `/api/catalog`.
- Continued public route typing cleanup on 2026-05-19: reused the shared catalog search type for organization portals and added a shared public-language search type for showcase and catalog detail pages, reducing one-off public route shapes while preserving current URLs.
- Verification for this route-typing pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed with 66 tests. Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `e3e26ffe-3c78-4702-9098-f42491c708ff`. Live smoke checks returned 200 for `/`, `/?language=Spanish`, `/catalog?language=Spanish&courseLanguage=English`, `/showcase?language=Spanish`, and `/api/catalog`.
- Continued Practice runtime hardening on 2026-05-19: added a shared practice-mode validator, normalized `/practice?mode=` before rendering the workspace, and rejected unsupported practice attempt modes in the API so malformed URLs or payloads cannot create invalid attempt records.
- Verification for this Practice pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed with 69 tests. Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `78518b31-aa5d-437e-84ca-9212590425aa`. Live smoke checks returned 200 for `/`, `/catalog?language=Spanish&courseLanguage=English`, `/showcase?language=Spanish`, and `/api/catalog`; protected `/practice?mode=sprint` and `/practice?mode=bad-mode` both redirected to auth as expected.
- Continued AI prompt route hardening on 2026-05-19: added a shared AI prompt task normalizer, reused it on `/ai?task=`, and covered valid, invalid, and fallback task ids so malformed prompt links open the default guided workflow instead of carrying arbitrary task state.
- Verification for this AI route pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed with 72 tests. Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `1e18ede0-e083-4b9c-b9cf-2b4143854fd3`. Live smoke checks returned 200 for `/`, `/catalog?language=Spanish&courseLanguage=English`, `/showcase?language=Spanish`, and `/api/catalog`; protected `/ai?task=generate-practice` and `/ai?task=bad-task` both redirected to auth as expected.
- Continued Studio API hardening on 2026-05-19: added server-side Studio document status validation and reused it in Studio create/update writes so only `draft`, `published`, and `archived` can be stored, with archived blocked on create and publishing still permission-guarded.
- Verification for this Studio status pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed with 73 tests. Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `3eaba12f-aa33-45cc-8569-f187a3c741d5`. Live smoke checks returned 200 for `/`, `/catalog?language=Spanish&courseLanguage=English`, `/showcase?language=Spanish`, and `/api/catalog`; unauthenticated `/api/studio` returned 401 as expected.
- Continued content block API hardening on 2026-05-19: added explicit content-block status validation and reused it in create/update writes so invalid statuses no longer silently downgrade to `draft`; archived remains blocked on create while publish checks remain permission-gated.
- Verification for this content-block status pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` all passed with 74 tests. Redeployed the existing Cloudflare Worker `edsync-dev`; live URL is `https://edsync-dev.learn-app.workers.dev` and Version ID is `0321be8a-88f1-44a0-bdee-1a1dd33b8e75`. Live smoke checks returned 200 for `/`, `/catalog?language=Spanish&courseLanguage=English`, `/showcase?language=Spanish`, and `/api/catalog`; unauthenticated `/api/content-blocks` returned 401 as expected.

## Update Protocol

After each implementation pass:
- Update the relevant phase status.
- Add verification results.
- Add decisions that affect architecture, prompts, templates, or data models.
- Record blockers with the next concrete action.
- Commit `progress.md` separately and push `main`.
