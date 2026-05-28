# EdSync Baseline Inventory

Last updated: 2026-05-16

This inventory implements Phase 1 of `docs/archive/planning/plan.md`. It maps the current routes, data model, capabilities, duplicate concepts, and verification baseline before the next architecture and feature work begins.

## Route Inventory

### Public And Auth
- `/` and `/catalog`: public catalog entry, current first visitor page, course search, public product listing, and empty catalog state.
- `/catalog/[productId]`: public product detail and enrollment CTA.
- `/org/[portalSlug]`: organization portal landing/catalog.
- `/auth/login`, `/auth/signup`: shared individual/organization sign-in and signup flows.

### Admin
- `/admin/dashboard`: platform owner command center.
- `/admin/users`: global user management.
- `/admin/ai`: provider configuration and provider tests.
- `/admin/settings`: platform settings and feature flags.
- `/admin/permissions`: permissions and role profile visibility.
- `/admin/portals`: tenant portal/domain/catalog management.
- `/admin/billing`: catalog and billing controls.
- `/admin/governance`: governance hub.
- `/admin/standards`, `/admin/certifications`, `/admin/automation`, `/admin/security`: focused governance/system pages.
- `/admin/email`: email/outbox console.
- `/admin/view/teacher`, `/admin/view/student`: audited read-only view modes.

### Teacher
- `/teacher/dashboard`: teacher summary and next actions.
- `/teacher/lessons`, `/teacher/lessons/create`, `/teacher/lessons/[id]`: lesson library, lesson creation, and lesson editor.
- `/teacher/students`: roster and student views.
- `/teacher/work`: work item management.
- `/teacher/gradebook`: gradebook.
- `/teacher/discussions`: class discussion management.
- `/teacher/notes`: student notes.
- `/teacher/planner`: deadlines, announcements, and schedule.
- `/teacher/analytics`, `/teacher/reports`: progress and reporting.
- `/teacher/profile`: teacher profile/account.

### Student
- `/student/dashboard`: learning home.
- `/student/lessons/[id]`: lesson player.
- `/student/work`: assigned work.
- `/student/grades`: grade view.
- `/student/discussions`: discussion participation.
- `/student/notes`: teacher notes.
- `/student/profile`: student profile/account.

### Studio And Learning Tools
- `/studio`: canonical creation workspace.
- `/notes`, `/docs`, `/sheets`, `/slides`: stable aliases into Studio tabs.
- `/ai`: AI prompt builder and generation workflows.
- `/practice`: unified practice surface.
- `/quizzes`, `/games`: stable aliases into Practice.

### API Groups
- Auth/session: `/api/auth/*`.
- Catalog/enrollment: `/api/catalog/*`.
- Admin: `/api/admin/*`.
- AI: `/api/ai/*`.
- Studio/content: `/api/studio`, `/api/content-blocks`, `/api/content/extract`.
- Work/grades/practice: `/api/work`, `/api/work/submissions`, `/api/grades`, `/api/grades/lesson-quiz`, `/api/practice/attempts`, `/api/reviews`.
- Engagement: `/api/discussions`, `/api/notes`, `/api/notifications`, `/api/email/send`, `/api/planner`.
- Platform: `/api/tenants`, `/api/permissions`, `/api/portals`, `/api/billing`, `/api/automation-rules`, `/api/certifications`, `/api/standards`, `/api/events`, `/api/offline-sync`, `/api/storage/upload`, `/api/data`.

## Data Model Inventory

### Identity, Auth, Tenancy, And Permissions
- `auth_users`, `auth_sessions`, `auth_tokens`, `profiles`.
- `tenants`, `tenant_portals`, `tenant_memberships`, `tenant_domains`, `tenant_runtime_bindings`, `tenant_object_links`.
- `permission_catalog`, `role_profiles`, `admin_users`, `admin_audit_logs`, `feature_flags`.

### Classes, Lessons, And Student Progress
- `classes`, `class_enrollments`, `lessons`, `lesson_sections`, `lesson_assignments`.
- `student_progress`, `quiz_questions`, `quiz_attempts`.
- `lesson_analytics`, `teacher_alerts`, `learning_reflections`, `learning_goals`, `knowledge_nodes`, `glossary_terms`.

### Work, Gradebook, Discussions, And Notes
- `learning_work_items`, `learning_work_questions`, `learning_submissions`.
- `gradebook_categories`, `gradebook_scores`, `learning_events`, `gradebook_replay_runs`.
- `discussion_threads`, `discussion_posts`, `student_notes`.

### Studio, Content Blocks, Practice, And Reviews
- `studio_documents`, `studio_assets`, `content_blocks`, `course_versions`.
- `practice_attempts`, `practice_attempt_items`, `practice_review_cards`.

### Media, Storage, Import, And Standards
- `storage_objects`, `media_assets`, `content_extractions`.
- `standards_packages`, `standards_launches`, `xapi_statements`.

### AI, Automation, Notifications, And Security
- `ai_provider_configs`, `ai_runs`, `automation_jobs`, `automation_rules`.
- `notifications`, `email_messages`, `email_outbox_events`.
- `rate_limits`, `security_events`.

### Catalog, Billing, Certifications, Offline, And Analytics
- `billing_customers`, `billing_products`, `billing_prices`, `billing_bundles`, `billing_subscriptions`, `billing_invoices`, `billing_transactions`, `entitlements`, `billing_coupons`, `billing_webhook_events`.
- `certification_rules`, `learner_certifications`.
- `offline_sync_items`, `analytics_rollups`.

## Capability Map

| Area | Current State | Decision |
| --- | --- | --- |
| Public catalog | Live route with simplified intro, search, detail, org portal support, and enrollment APIs. | Keep |
| Auth | D1 sessions, password auth, organization lookup, role redirects. | Keep |
| Tenancy | Tenant tables and host/default resolution exist, but active organization context needs stronger explicit session/source-of-truth handling. | Refactor |
| Admin shell | Broad platform owner tools exist, including users, AI, settings, portals, governance, billing, email, security. | Keep |
| Tenant/org admin model | Organization manager scope exists conceptually through tenant permissions but UI still looks close to platform admin in places. | Refactor |
| Studio | Canonical creation workspace exists with notes/docs/sheets/slides/practice, drafts, save/publish/archive/delete, content blocks, templates, transitions, animations, AI entry points. | Keep |
| Studio implementation | `StudioWorkspace.tsx` is still large and owns too many panels/actions. | Refactor |
| Teacher lesson creation | Lesson editor and create flow are rich but very large page-owned implementations. | Merge |
| Student lesson player | Feature-complete direction, but large page-owned implementation. | Refactor |
| Practice/quizzes/games | `/practice` is the canonical surface; `/quizzes` and `/games` are stable aliases. | Keep |
| Discussions | APIs and teacher/student pages exist. Needs tighter lesson-object linkage and templates. | Refactor |
| Gradebook | Categories, scores, work items, submissions, and learning events exist; gradebook is not yet fully event-derived. | Refactor |
| Templates | Studio catalog has design templates, blocks, slide themes, and lesson presets; no full import/export/apply diff engine yet. | Refactor |
| AI providers | Groq, Mistral, Cerebras, Google, Cohere provider layer exists with admin configs and fallback gateway. | Keep |
| AI prompt contracts | Contracts exist in `src/lib/studio/catalog.ts`, but generation still relies on broad course workflow output and needs stricter schemas per tool. | Refactor |
| AI response validation | Some content and upload validators exist; generated learning package validation is not yet comprehensive. | Refactor |
| Media/security | Upload, media URL, malware, HTML, rate-limit, and data-access helpers exist. | Keep |
| Offline/PWA | Offline sync table and API exist; full lesson/practice queue/replay UX is shallow. | Refactor |
| Billing/catalog | Billing tables, manual provider mode, catalog mapping, and entitlement paths exist. | Keep |
| Standards/certifications/automation | Tables, validation helpers, and admin pages exist. Need tighter user-friendly integration into lesson/workflow context. | Refactor |

## Duplicate Or Overlapping Concepts

| Concept | Current Locations | Direction |
| --- | --- | --- |
| Lesson sections vs Studio documents vs content blocks | `lessons`, `lesson_sections`, `studio_documents`, `content_blocks`, `src/components/studio/StudioWorkspace.tsx`, teacher lesson pages | Merge under future `LearningObject`/`LearningBlock` adapters while preserving legacy load/save. |
| Slide summaries vs lesson slides vs PPT export payloads | `src/lib/studio/workspace-actions.ts`, `src/lib/studio/catalog.ts`, `StudioWorkspace.tsx`, teacher lesson editor | Merge typed slide helpers and use shared slide layout tokens. |
| Practice items vs quiz questions vs work questions | `quiz_questions`, `learning_work_questions`, `practice_attempt_items`, `practice_review_cards` | Keep storage separate for now, add conversion helpers and shared validation. |
| AI generation contracts vs course workflow prompts | `src/lib/studio/catalog.ts`, `src/lib/ai/course-workflow.ts`, `/api/ai/create-lesson`, `/api/ai/course-workflow` | Refactor toward prompt contracts with strict output validators. |
| Public organization selection vs auth organization mode | `/catalog`, `/org/[portalSlug]`, `/auth/login`, `/auth/signup`, `src/lib/tenancy.ts` | Refactor to explicit active tenant/org context with audited transitions. |
| Admin governance pages | `/admin/governance`, standards, certifications, automation, security, permissions, settings | Keep routes, merge shared primitives and settings entry points. |

## Large File Baseline

These are the first refactor candidates because they concentrate too much workflow logic:

- `src/app/teacher/lessons/[id]/page.tsx`: 2355 lines.
- `src/app/student/lessons/[id]/page.tsx`: 2111 lines.
- `src/app/teacher/lessons/create/page.tsx`: 1782 lines.
- `src/components/studio/StudioWorkspace.tsx`: 1394 lines.
- `src/app/teacher/analytics/page.tsx`: 1080 lines.
- `src/app/admin/ai/page.tsx`: 799 lines.
- `src/app/teacher/students/page.tsx`: 704 lines.
- `src/app/student/dashboard/page.tsx`: 692 lines.
- `src/app/student/profile/page.tsx`: 641 lines.
- `src/app/admin/billing/page.tsx`: 601 lines.

## Verification Baseline

Default verification commands remain:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
npm.cmd run build
```

Known command notes:
- Use `npm.cmd` and `npx.cmd` on Windows.
- Use `Get-Content -LiteralPath` for bracketed routes such as `[id]` and `[productId]`.
- Rebuild OpenNext before deploying Cloudflare: `npm.cmd run build:cloudflare`.
- Deploy the existing Cloudflare app worker with `npx.cmd opennextjs-cloudflare deploy --config infra/cloudflare/wrangler.app.jsonc -- --env production --keep-vars`.

## Phase 1 Gaps To Carry Forward

- Tenant/org context needs an explicit active selection model and stronger API-level read scoping.
- Studio should become an orchestrator with feature modules for panels, editors, drafts, import/export, and slide helpers.
- Teacher lesson creation should consume Studio/LearningBlock primitives rather than parallel section logic.
- AI prompt contracts need schema-specific validators before expanding generation.
- Template application needs preview/diff/protected-field behavior before broad template auto-update.
- Gradebook should move further toward event-derived materialized views.
- Offline learning needs a visible queue/replay UX, not only backend sync records.
