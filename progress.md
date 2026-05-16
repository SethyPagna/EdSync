# EdSync Improvement Progress

**Last Updated:** 2026-05-16

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
- [ ] Export shared learning-object helpers into the first teacher lesson or Studio integration point.
- [ ] Replace duplicated section/quiz/content-block normalization in large page files with shared adapters.

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

---

## Verification Log

| Date | Scope | Command | Result |
| --- | --- | --- | --- |
| 2026-05-16 | Planning docs | Manual Markdown review | Passed |
| 2026-05-16 | Phase 1 inventory | Route, migration, schema, API, Studio, and large-file scan | Passed |
| 2026-05-16 | Phase 2 workflow model | Workflow, navigation, handoff, saved-state, and next-action review | Passed |
| 2026-05-16 | Phase 3 learning-object foundation | `npm.cmd run typecheck`; `npm.cmd run test -- src/lib/learning/objects.test.ts` | Passed |

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
- Phase 3 remains in progress until large Studio/lesson pages consume the shared layer and duplicated normalization is removed.

## Update Protocol

After each implementation pass:
- Update the relevant phase status.
- Add verification results.
- Add decisions that affect architecture, prompts, templates, or data models.
- Record blockers with the next concrete action.
- Commit `progress.md` separately and push `main`.
