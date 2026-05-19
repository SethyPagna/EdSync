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

## Update Protocol

After each implementation pass:
- Update the relevant phase status.
- Add verification results.
- Add decisions that affect architecture, prompts, templates, or data models.
- Record blockers with the next concrete action.
- Commit `progress.md` separately and push `main`.
