# EdSync Comprehensive Improvement Plan

**Goal:** Improve EdSync across workflow, design, architecture, content diversity, AI response handling, lesson generation, slides, discussions, quizzes, activities, templates, imports, and progress tracking.

**Planning Date:** 2026-05-16

**Working Rules:**
- Work directly on `main`.
- Commit each edited, added, or removed file separately.
- Push `main` after every successful commit.
- Keep secrets out of tracked files.
- Preserve EdSync Cloudflare resources separately from AllChess and LEARN.

**Current Foundation:**
- Next.js 14 App Router and TypeScript.
- Cloudflare D1, R2, AI Gateway, Workers, Queues, Vectorize, and Turnstile.
- Role-aware teacher, student, admin, catalog, Studio, lesson, practice, quiz, discussion, notes, docs, sheets, and slides surfaces.
- Studio already supports notes, docs, sheets, slides, practice, drafts, save/publish/archive/delete, content blocks, simple slide themes, transitions, animations, and AI entry points.
- Existing improvement plan: `docs/superpowers/plans/2026-05-16-edsync-lessons-slides-platform.md`.

**Primary Outcomes:**
- Teachers can generate, import, manually build, revise, and publish polished lessons.
- Lessons can become well-designed slides, PPT exports, discussions, quizzes, worksheets, practice sets, activities, rubrics, and review cards.
- Templates are reusable, importable, versioned, tenant-aware, and can update existing lessons without destroying teacher edits.
- AI output is structured, validated, repairable, previewable, and safe to insert selectively.
- Architecture is modular enough for steady expansion without turning Studio into one oversized component.

---

## Phase 1: Product Inventory And Baseline

**Target:** Create a trustworthy map of what EdSync already has before expanding it.

**Mini Phases:**
- 1.1 Catalog all teacher, student, admin, Studio, AI, practice, discussion, and catalog routes.
- 1.2 Map current database tables that support lessons, documents, content blocks, practice, grades, discussions, and assets.
- 1.3 Identify duplicated concepts such as lesson sections, slide summaries, content blocks, activity blocks, and practice items.
- 1.4 Record current verification commands and known local blockers.

**Subtargets:**
- Produce a route inventory grouped by role.
- Produce a data model inventory grouped by feature.
- Mark each existing capability as `keep`, `refactor`, `merge`, or `replace`.
- Record current gaps in `progress.md`.

**Acceptance Checks:**
- `progress.md` contains a baseline inventory link or summary.
- No product area is planned twice under different names.
- Existing user-facing features remain accounted for.

---

## Phase 2: Workflow Map And Navigation Model

**Target:** Make the teacher workflow coherent from idea to published learning experience.

**Mini Phases:**
- 2.1 Define the end-to-end workflow: plan, generate, edit, design, assess, publish, assign, discuss, review, improve.
- 2.2 Standardize navigation between Studio, Lessons, Slides, Practice, Quizzes, Discussions, Notes, Docs, Sheets, and Analytics.
- 2.3 Add clear saved states: local draft, server draft, published, archived, needs review, assigned.
- 2.4 Create handoff points between teacher creation tools and student learning views.

**Subtargets:**
- Teacher can start from a topic, file, URL, blank lesson, template, previous lesson, or content block.
- Teacher can move from lesson to slides, quiz, discussion, worksheet, and assignment without re-entering the topic.
- Student receives a clean assigned view with lesson, activity, discussion, quiz, and practice links.

**Acceptance Checks:**
- Every creation surface has a clear next action.
- The same item title, objective, tags, and audience metadata follow the item through related tools.
- Breadcrumbs or contextual links show where the user came from and where to go next.

---

## Phase 3: Core Learning Object Architecture

**Target:** Introduce a shared content model that can power lessons, slides, quizzes, discussions, and activities.

**Mini Phases:**
- 3.1 Define a `LearningObject` concept with tenant, owner, title, objectives, audience, source, tags, status, version, and metadata.
- 3.2 Define `LearningBlock` types: text, media, callout, example, activity, discussion, quiz, reflection, rubric, table, slide, embed, attachment, and teacher note.
- 3.3 Define conversion rules between blocks and Studio documents, slides, quizzes, discussions, practice sets, and printable worksheets.
- 3.4 Add migration path from existing `studio_documents` and `content_blocks`.

**Subtargets:**
- Shared types live in focused files instead of inside one large UI component.
- Blocks are serializable, versioned, and safe to validate server-side.
- Legacy Studio items continue to load through adapters.

**Acceptance Checks:**
- Existing Studio drafts and saved documents still open.
- New content can be represented without losing lesson structure.
- Tests cover normalization from legacy slide/document data into the new model.

---

## Phase 4: Studio Component Refactor

**Target:** Split Studio into maintainable modules while preserving behavior.

**Mini Phases:**
- 4.1 Extract state and persistence helpers from `src/components/studio/StudioWorkspace.tsx`.
- 4.2 Extract document editor, sheet editor, slide editor, practice picker, template sidebar, history panel, and library panel.
- 4.3 Extract slide-specific helpers into typed utility modules.
- 4.4 Add component-level tests for critical Studio interactions.

**Subtargets:**
- `StudioWorkspace.tsx` becomes an orchestrator, not the home of every feature.
- Each panel has clear props and no hidden cross-panel mutation.
- Draft save and server save logic remain stable.

**Acceptance Checks:**
- `npm.cmd run typecheck` passes.
- Existing Studio save, publish, archive, restore, export, import, and draft behavior still works.
- Large UI files are reduced into focused components.

---

## Phase 5: Template System Foundation

**Target:** Build a real template engine for generated and manual lessons.

**Mini Phases:**
- 5.1 Define template records: id, tenantId, ownerId, type, name, description, version, status, theme tokens, layout rules, supported block types, sample content, and compatibility rules.
- 5.2 Support template types: lesson, slide deck, section, activity, quiz, discussion, worksheet, rubric, certificate, course cover, and full course package.
- 5.3 Add global EdSync templates and tenant-owned custom templates.
- 5.4 Add template preview data that shows what will change before applying.

**Subtargets:**
- Teacher can select a template when creating manually.
- AI generation can target a template.
- Template metadata supports age group, subject, tone, pacing, accessibility, and output type.

**Acceptance Checks:**
- Template selection does not overwrite existing content unexpectedly.
- Templates are searchable by type, subject, grade, and purpose.
- Tests cover template parsing and compatibility.

---

## Phase 6: Template Application And Auto Update

**Target:** Applying or changing a template updates the whole lesson package consistently.

**Mini Phases:**
- 6.1 Build a template application engine that maps template slots to learning blocks.
- 6.2 Preserve teacher-authored content while updating layout, theme, spacing, activity framing, and slide styling.
- 6.3 Add a diff preview for template changes.
- 6.4 Support package-wide updates across lesson page, slides, worksheet, quiz styling, discussion prompt framing, and certificate styling.

**Subtargets:**
- Teacher can switch from `corporate` to `kid-friendly` and see the whole package update.
- Teacher can accept all changes or apply selected changes.
- Teacher edits are marked as protected unless explicitly remapped.

**Acceptance Checks:**
- Template changes update every compatible child artifact.
- Protected content survives repeated template changes.
- Tests cover apply, reapply, partial apply, and rollback.

---

## Phase 7: Template Import, Export, And Marketplace Readiness

**Target:** Let teams import and export templates safely.

**Mini Phases:**
- 7.1 Define a portable `.edsync-template.json` format with schema version and integrity metadata.
- 7.2 Add import validation with clear error messages for unsupported fields, missing slots, unsafe HTML, or invalid colors.
- 7.3 Add export for tenant templates and selected built-in templates.
- 7.4 Prepare template sharing rules for future marketplace or district libraries.

**Subtargets:**
- Imported templates can include lesson layouts, slide layouts, theme tokens, prompt contracts, and sample content.
- Unsafe scripts, event handlers, secrets, and external tracking code are rejected.
- Admins can approve imported templates before teacher use.

**Acceptance Checks:**
- Valid template files import and appear in the template library.
- Invalid template files fail with actionable messages.
- Exported templates can be re-imported without data loss.

---

## Phase 8: AI Prompt Contract System

**Target:** Replace loose prompts with targeted prompt contracts for each tool.

**Mini Phases:**
- 8.1 Define prompt contracts for lesson, slide deck, PPT outline, discussion, quiz, worksheet, activity, rubric, flashcards, study guide, reflection, and course package.
- 8.2 Add prompt inputs: topic, source text, grade/audience, language, tone, duration, standards, template, accessibility needs, difficulty, pacing, and assessment type.
- 8.3 Add system prompts with strict JSON schemas and compact fallback instructions.
- 8.4 Add prompt versioning so output changes are traceable.

**Subtargets:**
- Each AI action has a visible purpose and expected output shape.
- Teachers can choose quick, balanced, advanced, scaffolded, exam-style, project-based, or discussion-first generation.
- AI generation records prompt version, model/provider, template id, and source hash.

**Acceptance Checks:**
- No user-facing AI route depends on unstructured prose when structured data is required.
- Prompt contracts are tested with schema fixtures.
- Output metadata can explain how content was generated.

---

## Phase 9: AI Response Validation, Repair, And Selective Import

**Target:** Make AI output reliable enough for classroom content workflows.

**Mini Phases:**
- 9.1 Create strict validators for lesson packages, slide decks, quizzes, discussions, activities, worksheets, rubrics, and template imports.
- 9.2 Add automatic JSON repair only before validation, never after invalid content is accepted.
- 9.3 Add local fallback drafts for common AI failure modes.
- 9.4 Add selective import UI where teachers choose which sections, slides, questions, activities, and prompts to insert.

**Subtargets:**
- Responses can be accepted, repaired, regenerated, partially imported, or rejected.
- Validation errors are grouped by field and shown in teacher-friendly language.
- AI output never silently drops required fields.

**Acceptance Checks:**
- Malformed JSON returns a clear repair path.
- Incomplete AI output cannot publish without review.
- Teachers can import only selected generated artifacts.

---

## Phase 10: Lesson Builder Upgrade

**Target:** Make lessons comprehensive, editable, and presentation-ready.

**Mini Phases:**
- 10.1 Support lesson structures: direct instruction, workshop, flipped classroom, inquiry, project-based, case study, exam review, microlearning, and self-paced module.
- 10.2 Add lesson blocks: objectives, prerequisites, vocabulary, misconception alert, worked example, guided practice, independent practice, discussion, reflection, exit ticket, homework, rubric, and extension.
- 10.3 Add lesson pacing controls with estimated minutes and teacher notes.
- 10.4 Add standards alignment and accessibility checks.

**Subtargets:**
- Manual lessons and generated lessons use the same structure.
- Teachers can reorder, duplicate, hide, lock, and convert blocks.
- Lessons can generate child artifacts without losing source linkage.

**Acceptance Checks:**
- A lesson can be created manually from a blank template.
- A lesson can be generated from source text and then edited manually.
- A lesson can produce slides, quiz, discussion, worksheet, and practice set.

---

## Phase 11: Slide And PPT Design System

**Target:** Produce well-designed slides and exportable PPT-style decks.

**Mini Phases:**
- 11.1 Define slide layouts: title, agenda, objective, section divider, concept, two-column, image focus, quote, timeline, process, comparison, quiz, activity, discussion, summary, exit ticket, and closing.
- 11.2 Add design tokens for typography, color, spacing, contrast, background, accent, badge, and notes.
- 11.3 Add slide quality rules for text density, contrast, hierarchy, image fit, title length, and speaker note completeness.
- 11.4 Add PPT export through `pptxgenjs` with template-aware layout mapping.

**Subtargets:**
- AI-generated slides use layouts instead of plain text dumps.
- Teacher can apply one deck template and update all slides.
- PPT export matches the web preview closely enough for classroom use.

**Acceptance Checks:**
- Generated deck includes speaker notes and activity prompts where relevant.
- PPT export opens with correct slide count, titles, and theme styling.
- Slide validation flags overcrowded slides before export.

---

## Phase 12: Discussion Engine

**Target:** Turn lessons into structured discussions that fit classroom and online learning.

**Mini Phases:**
- 12.1 Add discussion templates: debate, Socratic seminar, think-pair-share, case response, peer review, reflection, misconception check, and exit discussion.
- 12.2 Generate prompts with roles, timing, grouping, sentence starters, moderation guidance, and teacher look-fors.
- 12.3 Add discussion links back to lesson objectives and evidence blocks.
- 12.4 Add student response summaries and teacher analytics.

**Subtargets:**
- Teachers can generate a discussion from any lesson section.
- Discussions can include rubric criteria and participation expectations.
- AI can suggest follow-up prompts based on student responses.

**Acceptance Checks:**
- Discussion prompts include objective, prompt, student action, teacher notes, and assessment criteria.
- Student discussion view is clean and role-appropriate.
- Teacher can review participation without leaving the lesson context.

---

## Phase 13: Quiz And Assessment Engine

**Target:** Expand quizzes beyond basic multiple choice.

**Mini Phases:**
- 13.1 Support question types: multiple choice, multi-select, true/false, fill blank, short answer, matching, ordering, numeric, image-based, code/text analysis, and rubric-scored response.
- 13.2 Add diagnostic, micro-check, practice, final quiz, exam, and mastery review modes.
- 13.3 Add feedback rules: immediate explanation, delayed feedback, hints, retry, partial credit, and remediation.
- 13.4 Add item analytics for difficulty, discrimination, missed concepts, and recommended reteach blocks.

**Subtargets:**
- Generated quizzes are Bloom-balanced and tied to objectives.
- Teachers can manually edit every question and explanation.
- Students can retry weak concepts through practice review cards.

**Acceptance Checks:**
- Quiz validation enforces correct answers and scoring rules.
- Generated quizzes include explanations and difficulty.
- Gradebook receives accurate score and attempt data.

---

## Phase 14: Activity And Practice Diversity

**Target:** Add varied learning activities rather than only reading and quizzes.

**Mini Phases:**
- 14.1 Add activities: sorting, matching, drag sequence, flashcards, timed sprint, mistake retry, worksheet, lab, role play, case study, simulation prompt, peer critique, project checkpoint, and reflection journal.
- 14.2 Add group formats: solo, pairs, small group, whole class, asynchronous, and teacher-led.
- 14.3 Add activity metadata: duration, materials, grouping, evidence, scoring, accessibility, and classroom management notes.
- 14.4 Add conversion from lesson blocks into activity sets.

**Subtargets:**
- Teachers can generate activities from source lessons.
- Activities can become student assignments.
- Practice engine reuses generated activity and quiz data when appropriate.

**Acceptance Checks:**
- Activity library includes at least twelve distinct activity types.
- Each activity has teacher instructions and student instructions.
- Activities can be assigned and tracked.

---

## Phase 15: Media, Import, And Source Handling

**Target:** Let EdSync ingest diverse sources safely.

**Mini Phases:**
- 15.1 Improve import flows for text, URL, PDF, document, slides, CSV, images, video links, and existing EdSync content.
- 15.2 Extract source metadata, citations, attachments, and suggested objectives.
- 15.3 Add source chunking and retrieval for long materials.
- 15.4 Preserve source references when generating lessons, slides, quizzes, and discussions.

**Subtargets:**
- Teachers can import a source and generate a lesson package from it.
- Extracted content is sanitized and bounded.
- Generated outputs can show source traceability where available.

**Acceptance Checks:**
- Large source input is chunked rather than silently truncated.
- Unsafe uploaded content is rejected or sanitized.
- Source references remain attached to generated artifacts.

---

## Phase 16: Collaboration, Versioning, And Review

**Target:** Support professional lesson development workflows.

**Mini Phases:**
- 16.1 Add version snapshots for lessons, templates, slides, quizzes, and discussions.
- 16.2 Add change history with author, time, action, and affected blocks.
- 16.3 Add review states: draft, needs review, approved, published, assigned, archived.
- 16.4 Add teacher/admin comments for content review.

**Subtargets:**
- Teachers can compare versions and restore prior versions.
- Admins can approve shared templates and published content.
- Version history supports AI-generated and manual changes.

**Acceptance Checks:**
- Each save creates meaningful history metadata.
- Restore does not corrupt linked child artifacts.
- Review workflow can block publishing when required.

---

## Phase 17: Personalization And Accessibility

**Target:** Make content adaptable for different learners and contexts.

**Mini Phases:**
- 17.1 Add learner profile inputs: reading level, language, accommodations, interest themes, pacing, and support level.
- 17.2 Add teacher controls for simplify, extend, translate, scaffold, add examples, add visuals, and add checks for understanding.
- 17.3 Add accessibility checks for contrast, heading structure, alt text, captions, keyboard use, and cognitive load.
- 17.4 Add differentiated versions of lessons, quizzes, activities, and slides.

**Subtargets:**
- Teachers can generate multiple versions without losing the master version.
- Student-facing content follows accessibility basics.
- AI prompts include accommodations only when appropriate and safe.

**Acceptance Checks:**
- Differentiated versions keep objective alignment.
- Accessibility warnings are shown before publish.
- Translated or simplified content remains editable.

---

## Phase 18: Analytics And Continuous Improvement

**Target:** Use student and teacher activity to improve lessons.

**Mini Phases:**
- 18.1 Track engagement with lessons, slides, discussions, quizzes, practice, and assignments.
- 18.2 Add objective-level analytics and weak concept detection.
- 18.3 Recommend reteach blocks, practice sets, discussion prompts, and slide revisions.
- 18.4 Add teacher-facing review summaries after assignments.

**Subtargets:**
- Analytics connect learning outcomes to lesson components.
- Teachers can see which slide, section, or question caused confusion.
- AI recommendations are optional and explainable.

**Acceptance Checks:**
- Events are tenant-safe and role-safe.
- Analytics screens avoid exposing private student data unnecessarily.
- Recommendations link back to specific evidence.

---

## Phase 19: Quality Gates, Testing, And Deployment Workflow

**Target:** Make changes safer as EdSync becomes broader.

**Mini Phases:**
- 19.1 Standardize unit tests for validators, template application, AI contracts, conversion helpers, and scoring.
- 19.2 Add browser tests for Studio creation, template switching, slide preview, selective AI import, quiz creation, discussion creation, and publish flow.
- 19.3 Add build verification: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, `npm.cmd run build`.
- 19.4 Add deployment checks for Vercel and Cloudflare app/worker paths.

**Subtargets:**
- Every phase that changes behavior includes targeted tests.
- Browser-level workflows cover the most important teacher and student paths.
- Deployment scripts keep EdSync resources separate from AllChess and LEARN.

**Acceptance Checks:**
- Verification commands pass before deployment.
- Failed AI/provider/deployment checks produce actionable logs.
- New migrations include rollback or forward-fix notes.

---

## Phase 20: Launch Readiness And Operating Rhythm

**Target:** Turn the improvements into a repeatable delivery system.

**Mini Phases:**
- 20.1 Define release slices: foundation, templates, AI contracts, lesson builder, slides/PPT, activities, analytics, and polish.
- 20.2 Update `progress.md` after every implementation pass.
- 20.3 Keep a decision log for architecture, data model, AI prompt contracts, and template rules.
- 20.4 Run final smoke tests for teacher, student, admin, Studio, lesson, slide, quiz, discussion, and deployment flows.

**Subtargets:**
- Each release slice has a visible user outcome.
- Progress is understandable without reading every commit.
- Future agents can continue from the tracker without rediscovering the whole system.

**Acceptance Checks:**
- `progress.md` reflects completed phases, blockers, next target, and verification status.
- Documentation names the current architecture and major tradeoffs.
- Main is pushed after successful commits.

---

## Phase 21: Public Intro, Workflow Slides, Search, And Launch Motion Redesign

**Target:** Rebuild the visitor launch experience so it behaves like a polished slide-led product intro instead of a page with separated stacked sections.

**Immediate Screenshot Fix Pass:**
- Remove the separate public topbar from the visitor intro. Put the EdSync brand, theme toggle, language menu, sign-in/start action, and compact direct-jump controls inside the hero product line/rectangle area.
- Remove the visible "public catalog to classroom evidence" watermark/status copy from the first viewport.
- Remove the outer frame around the hero app preview and use a larger, clearer product mockup that directly shows EdSync catalog, Studio, AI, practice, assignment, and grade evidence.
- Minimize the hero function tags so they support the hook instead of competing with it.
- Merge the old "Scroll into the workflow" transition card into workflow slide 1, with more padding, cleaner typography, shorter copy, and better frame spacing.
- Match intro, workflow, and catalog/search backgrounds in both light and dark mode so there are no mismatched strips or hard color breaks.
- Make scroll feel normal while each scroll up/down action triggers a slide-like workflow transition. Do not use jittery progress-scrubbed animation tied to every scroll pixel.
- Make `View workflow`, `Start`, and direct-jump buttons scroll or transition smoothly to the relevant section.
- Merge Search and Available/Courses into one catalog availability surface with filters, counts, results, and empty state in the same polished section.
- Apply public language labels and dark/light contrast across the hero, workflow, controls, catalog search, and empty/result states.

**Mini Phases:**
- 21.1 Redesign the main intro surface:
  - Remove the outer frame from the hero app preview.
  - Move the app name, theme toggle, language menu, sign-in/start control, direct-jump control, and core functions into the single product rectangle/line treatment.
  - Remove the visible watermark/status text currently reading like “public catalog to classroom evidence.”
  - Make tags compact and minimized so the first viewport has a stronger hook and less visual clutter.
- 21.2 Merge the workflow intro into the first workflow slide:
  - The sequence starts with one merged `Intro + Workflow` slide.
  - Existing workflow slides follow as product-function slides.
  - Improve padding, margins, line length, and spacing from frame edges.
  - Keep copy short and concrete; move supporting detail into product mockups, controls, or hover/secondary states.
- 21.3 Fix background and transition continuity:
  - Match background colors exactly across intro, workflow, and search surfaces in light and dark mode.
  - Remove mismatched strips, hard color breaks, and unintended scroll gaps.
  - Ensure the intro-to-workflow transition is animated, not a plain section jump.
  - Scrolling down/up should trigger the next slide-like transition automatically; avoid scrubbed scroll-progress animations that feel jittery or tied to every pixel.
- 21.4 Implement slide-like workflow behavior:
  - User scroll triggers the next or previous slide transition.
  - Manual controls and gallery dots still change slides in place without moving the page down.
  - `View Workflow`, `Start`, and direct-jump buttons trigger smooth animated transitions.
  - Reduced-motion users get immediate non-jittery section changes.
- 21.5 Merge Search and Available:
  - Combine “Search” and “Available” into one polished catalog availability surface.
  - Reduce vertical distance between workflow and catalog/search.
  - Use a smooth transition from workflow into the combined catalog function.
  - Keep empty results, filters, price/free/paid counts, language, duration, and organization context readable on mobile.
- 21.6 Finish language and theme coverage:
  - Apply light/dark contrast rules to hero, workflow, slide controls, catalog search, buttons, overlays, and language menu.
  - Make all public copy respect selected language where translation exists.
  - Keep full language names in the menu.
  - Fall back to English cleanly when a translation is missing.

**Subtargets:**
- `/catalog`, `/showcase`, and `/` share one coherent public launch system.
- The first screen feels spacious, simple, and product-relevant.
- Workflow slides show concrete EdSync functionality: catalog, Studio, AI co-creator, teacher review, practice, progress/admin evidence.
- Direct links such as `/catalog#showcase` land cleanly with no topbar offset or background mismatch.
- Mobile intro has less visible text, compact controls, no clipped preview, and no horizontal overflow.

**Acceptance Checks:**
- `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` pass.
- Desktop screenshots verify light mode, dark mode, workflow slide, and combined search/available section.
- Mobile screenshots verify hero, merged workflow slide, controls, language menu, and search/available section.
- Manual slide controls and scroll-triggered transitions do not jump the page unexpectedly.
- Public language URLs such as `/catalog?language=Spanish` and `/catalog?language=Korean` render localized public copy with readable contrast.
- First-load JS does not increase from language or animation changes without a measured reason.

---

## Phase 22: Deep Data Architecture, Schema, And Learning Flow Audit

**Target:** Build a complete relational schema map that mirrors the actual EdSync data architecture, then propose safer organization and extensibility improvements.

**Mini Phases:**
- 22.1 Full directory and entity sweep:
  - Inspect `src/app`, `src/components`, `src/lib`, `src/types`, `migrations`, `database`, `scripts`, worker files, and tests.
  - Inventory educational entities: tenants, portals, users, memberships, roles, courses, catalog products, billing records, modules, lessons, sections, slides, content blocks, Studio documents, media/object links, enrollments, assignments, work items, quizzes, attempts, submissions, grades, discussions, notes, reviews, automation, notifications, AI providers, AI audits, security events, and progress records.
  - Record which files read, write, serialize, validate, or display each entity.
- 22.2 Build the detailed relational schema:
  - List every table with columns, metadata fields, inferred types, nullable fields, primary keys, unique keys, indexes, foreign-key-like relationships, tenant ownership, role ownership, and lifecycle state.
  - Include D1 migrations and any code-created or seed-created tables.
  - Include document-store-like JSON fields and nested structures used inside D1 rows.
  - Include R2 object metadata relationships and object key conventions.
- 22.3 Verification loops:
  - Verify schema against migrations.
  - Verify schema against D1 query helpers and API route read/write code.
  - Verify schema against serializers/adapters such as Studio, lesson package, content block, quiz/practice, and catalog mapping helpers.
  - Verify schema against tests, seed scripts, admin tools, and worker/queue handlers.
  - Re-run the sweep after edits until the schema document matches actual code paths.
- 22.4 Learning flow and ownership analysis:
  - Map the canonical flow: public catalog or org portal -> auth/signup/login -> tenant context -> teacher/course/Studio creation -> lesson/package assignment -> student learning/practice -> submission/attempt -> grade event/progress -> feedback/recommendation/report.
  - Identify where content management records are mixed with learning records.
  - Identify where tenant scoping, ownership checks, or role permissions are implicit instead of explicit.
  - Identify generic data access risks and routes that should move behind feature APIs.
- 22.5 Optimization and extensibility proposal:
  - Propose a cleaner separation between content authoring, delivery/enrollment, assessment, learning records, analytics rollups, media library, AI/audit, and tenant/admin configuration.
  - Propose materialized progress summaries, gradebook summaries, attempt summaries, and dashboard rollups.
  - Propose indexes for high-traffic reads: tenant-scoped lists, user dashboards, class rosters, assigned work, catalog search, lesson sections, submissions, grade rows, discussion threads, media links, and audit logs.
  - Propose JSON field normalization only where it improves querying, access control, migrations, or reporting.
  - Propose D1 Worker-binding usage where Cloudflare runtime can avoid REST latency, while keeping REST fallback for Vercel/local.
- 22.6 Output schema improvement proposal:
  - Create a schema report that includes current schema, relationship map, data ownership map, query/flow map, risks, and prioritized improvements.
  - Include concrete migration candidates, API boundary candidates, indexes, test coverage gaps, and no-regret cleanup tasks.
  - Distinguish immediate fixes from larger migration work.

**Subtargets:**
- The schema report is detailed enough for a new engineer to understand how EdSync stores and connects learning data.
- Every major feature has a named data owner, read path, write path, and tenant boundary.
- The proposal identifies ways to make EdSync faster, safer, and easier to extend without breaking existing data.

**Acceptance Checks:**
- Schema report cross-references actual migrations, serializers, API routes, and key UI flows.
- No table or JSON document shape found in code is missing from the schema report.
- Proposed improvements are ranked by impact, risk, and implementation cost.
- Verification commands pass after any code/doc changes made during the audit.
- `progress.md` records the audit status, findings, and remaining open questions.

---

## Phase 23: Source Organization, Runtime Language Strategy, And Cleanup

**Target:** Make the codebase easier to navigate without breaking existing routes, APIs, or Cloudflare/Vercel/local deployments. Group related files into feature folders, keep compatibility shims during moves, and only introduce additional programming languages where measured hot paths justify the complexity.

**Mini Phases:**
- 23.1 Directory ownership audit:
  - Inventory root-level `src/lib` and `src/components` files that now belong to clearer domains such as public launch/catalog, auth, tenancy, admin, learning, Studio, practice, media, billing, AI, and security.
  - Identify duplicate folders, thin wrappers, legacy compatibility files, and files that are imported from too many unrelated domains.
  - Mark every move as `safe now`, `needs shim`, or `defer until feature API exists`.
- 23.2 Safe grouping and compatibility shims:
  - Move public visitor helpers into `src/lib/public/*` and public visitor UI into `src/components/public/*` where practical.
  - Move catalog helpers into `src/lib/catalog/*` only after stable re-export shims preserve old import paths.
  - Keep old import paths as short re-export files until all internal imports are migrated and tests pass.
  - Commit each moved file, shim, and import update separately.
- 23.3 Folder cleanup:
  - Merge folders only when they represent the same domain and have no conflicting ownership.
  - Rename folders only when the new name improves domain clarity and can be updated mechanically with tests.
  - Keep app-route folders stable unless a route-preserving redirect or wrapper is already in place.
  - Delete dead files only after `rg` confirms no imports, routes, scripts, docs, or tests still reference them.
- 23.4 Runtime language strategy:
  - Keep TypeScript/React as the primary app and UI language because it matches Next.js, Cloudflare Workers, Vercel, shared types, and existing tests.
  - Use SQL for D1 schema, indexes, and data-heavy filtering where the database can do less work in application code.
  - Consider Rust compiled to WASM only for isolated CPU-heavy utilities such as SCORM ZIP manifest parsing, document conversion, media signature inspection, or large import normalization after profiling shows TypeScript is a bottleneck.
  - Avoid Python, background services, or mixed-language runtime calls in request paths unless they are isolated workers with clear deployment and observability contracts.
  - Do not rewrite working TypeScript features into another language without a benchmark, rollback path, and Cloudflare compatibility check.
- 23.5 Optimization pass:
  - Reduce duplicate map/filter passes in hot dashboard, catalog, practice, and Studio list paths.
  - Prefer `Map`/`Set` lookups for repeated joins and membership checks.
  - Keep large editors behind dynamic route boundaries and avoid pulling Studio-only libraries into public/auth/dashboard bundles.
  - Add or update tests for moved helpers and any compatibility shims.
- 23.6 Verification and rollout:
  - Run `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` after each grouping slice.
  - Browser-check public intro, catalog, auth, Studio, teacher dashboard, student dashboard, and admin shell after visible import changes.
  - Redeploy the existing Cloudflare Worker only after local verification passes.

**Acceptance Checks:**
- New folders express domain ownership more clearly than the previous flat structure.
- Existing routes, API routes, tests, and deploy scripts keep working.
- Re-export shims preserve compatibility during gradual import migration.
- Mixed-language decisions are documented with performance reasoning, not implemented as a blanket rewrite.
- `progress.md` records every organization slice, verification result, and remaining cleanup candidate.

---

## Phase 24 - Portal Workflow, Notes, Practice AI, And Canva-Style Lesson Editing

**Goal:** Make the teacher, student, individual, and admin portals feel like one working learning product instead of separate partially connected pages. Notes become a personal multimedia workspace, practice and AI tutor become one guided support surface, lesson creation moves away from raw HTML editing, and work/planner/discussion/deadline flows stay tied to the class or course they were created for.

**Requirements From Latest Review:**
- Notes:
  - Treat notes as personal for every user type, not teacher-only.
  - Support add/edit/delete/duplicate/archive, design presets, images, videos, links, safe media validation, and AI cleanup/formatting.
  - Keep teacher-to-student feedback notes as a separate connected feedback lane rather than mixing them with personal notes.
- Grades, work, and feedback:
  - Teachers can provide feedback for assignments, projects, quizzes, practice attempts, grades, and discussions.
  - Students can see feedback by work item and decide whether grades, feedback, deadlines, notifications, and new-content widgets appear on their dashboard.
  - Replace XP with real time-spent/activity signals that exclude idle/offline time.
  - Work items distinguish possible score, earned score, and gradebook contribution.
  - A work item can be points-based, weighted into the course grade by a fixed percent, completion-only, or participation-based.
  - Completion and participation work can still collect submissions, feedback, and audit evidence without changing the averaged grade.
  - Weighted work shows both score percent and contribution to the whole course grade, for example 80/100 on a 5% item contributes 4% course credit.
- Student portal:
  - Rename announcements to notifications.
  - Add dashboard toggles for notifications, assignments, deadlines, new content, grades, practice, and feedback.
  - Compact the join-class card so the join button does not leave large empty whitespace.
  - Keep Practice and AI Tutor available, but merge them into one support surface and place Practice/AI/Grades under the Support sidebar group.
  - Ensure student lesson, practice, AI, grades, and notes pages always render the student sidebar, including when a platform admin is viewing as a student.
- Teacher portal:
  - Keep lesson creation, work, planner, discussions, deadlines, assignments, projects, quizzes, and activities class-scoped.
  - Connect planner events, notifications, deadlines, and work items so one class action can appear in the correct student dashboard and lesson/work surfaces.
  - Add teacher notes as a personal multimedia workspace plus a feedback-management lane for students.
- Individual learner and course marketplace:
  - Signup/signin supports individual and organization paths without creating disconnected experiences.
  - Individual users get a combined learner/creator-friendly surface for browsing, buying/free-enrolling in public courses, personal notes, practice, progress, and optional teaching tools.
  - Course-for-sale pages avoid traditional class-only language where marketplace language is more appropriate.
- Admin and layout:
  - Admin portal pages need consistent sidebar-aware margins, responsive spacing, and readable dark mode.
  - Admin view-as teacher/student must keep the proper app sidebar and a visible return path.
  - Profile becomes Profile & Settings, with reorderable dashboard/section preferences for admin, teacher, student, and individual modes.
- Lesson editor:
  - The first creation screen must expose three clear start modes: AI draft, Full AI, and Blank lesson.
  - AI draft generates a designed outline that teachers can selectively review and refine before publishing.
  - Full AI generates the complete lesson package: slide sections, quiz/practice blocks, rubric, feedback prompts, review cards, language/tone variants, and teacher-review metadata.
  - Blank lesson opens the visual editor immediately with no generated content, ready for manual section/block creation.
  - Remove raw HTML-style section editing from teacher lesson creation/editing.
  - Use a Canva-style visual section editor: compact mini-sidebar/tools, content blocks, safe media insert, practice blocks, callouts, slide/deck blocks, and clear block previews.
  - Lesson sections should feel like editable design blocks, not forms: each section has visible layout/type controls, block insert chips, template styling, safe media/link inserts, AI refine/insert actions, and page-thumbnail navigation.
  - AI-generated lesson responses should insert into designed blocks and templates rather than dumping markup into textareas.
  - Lesson player may use a mini-sidebar or a dedicated lesson page shell with a back button, but it must preserve portal navigation context.
  - The lesson creation and edit surfaces should follow the preferred Canva references: left vertical tool rail, contextual side panel, center page canvas, compact floating toolbar, page title rows, bottom thumbnails, zoom/page controls, animation/position/effects panels, and download/share/export menus.
  - The standalone Studio route remains only as compatibility/history tooling; teacher-facing creation happens through Lessons and Create Lesson.
- Practice and AI:
  - Remove the standalone Studio page from primary navigation.
  - Merge Practice with AI Tutor into a single learning support loop: generate, attempt, explain missed, retry, review, and recommend.
  - Keep `/practice`, `/ai`, `/quizzes`, and `/games` route compatibility by redirecting or aliasing into the merged support surface.
  - Add Kahoot-style modes where useful: colorful activity cards, join flow, speed/accuracy points, retry missed, and teacher-controlled publishing.
- Canva/Kahoot-inspired design system:
  - Use Canva-style side tools, panels, property controls, share/download menus, template libraries, color/font pickers, animation/position panels, and bottom page thumbnails where they fit EdSync.
  - Keep EdSync native; do not depend on Canva as a required editor.
  - Practice activities can use more playful color, pacing, points, speed, accuracy, and class-join design.

**Implementation Slices:**
- 24.1 Update navigation and route wrappers so student/teacher/admin shared pages never lose the correct sidebar.
- 24.2 Replace raw lesson section snippets with clean readable block text and add a visual block adapter for existing legacy HTML sections.
- 24.3 Add the merged Practice + AI support shell and route aliases.
- 24.4 Connect planner, work, discussions, deadlines, notifications, and lesson assignments through shared class-scoped helpers.
- 24.5 Expand personal notes and feedback notes with safe media/design actions for all relevant roles.
- 24.6 Add dashboard visibility preferences and Profile & Settings section ordering.
- 24.7 Add Canva-style lesson editor panels, template controls, slide thumbnails, and safe insert menus.
- 24.8 Add Kahoot-style activity presentation and join/play polish for class practice.
- 24.9 Add explicit work scoring semantics: points possible, earned score, grade weight percent, completion-only evidence, participation criteria, release controls, and student-facing labels.
- 24.10 Continue replacing old Studio-first wording in user-facing creation paths with Lessons, Notes, Practice + AI Tutor, and Canva-style lesson creation language while preserving route compatibility.
- 24.11 Harden the Create Lesson start flow so AI draft, Full AI, and Blank lesson each land in the same Canva-style editor with consistent templates, section controls, and AI insert-back behavior.

**Verification:**
- Run `npm.cmd run typecheck`, `npm.cmd run lint`, focused tests, and `npm.cmd run build`.
- Browser-test student dashboard toggles, teacher lesson create/edit, notes add/edit/delete, admin view-as routes, portals spacing, merged Practice/AI, planner/work/discussion class scoping, and dark/light menu contrast.
- Live-test the Cloudflare Worker after deployment and record the URL/version in `progress.md`.

**Master UX Contract:**
- Visual system:
  - Canva is the primary editor metaphor: block-based editing, drag/drop, template libraries, asset panels, compact property controls, color/font pickers, bottom page thumbnails, smooth animations, and no raw HTML/CSS editing.
  - Kahoot is the activity metaphor: vivid answer states, points, speed, accuracy, celebratory feedback, class join/play moments, and teacher-controlled publishing.
  - AI is a co-creator that reads prompts, filters, grade level, language, output length, and selected template, then injects content into designed blocks that can be restyled without losing content.
- Role model:
  - Student: lessons, work, Practice + AI Tutor, grades, discussions, planner, notifications, personal notes.
  - Teacher: courses, lesson creation studio, assignments, gradebook and feedback, discussions, planner, Practice + AI preview, students, notifications, personal notes.
  - Individual: marketplace-first course buyer plus personal learning dashboard, self-paced courses, personal multimedia notes, Practice + AI, progress, optional creator tools.
  - Admin: platform oversight, portals, all role previews with persistent sidebar and visible exit-view affordance.
- Sign-in/signup:
  - Use a two-step identity path: Individual or Organization.
  - Individual users can stay independent or later join an organization.
  - Organization users use org/portal/SSO-ready entry without creating a disconnected product.
- Global navigation:
  - Every authenticated page has a main sidebar except intentional full-screen editors, which still expose a collapse/expand or return control.
  - Main sidebar subareas can open a mini-sidebar for contextual tabs.
  - Student Lessons mini-sidebar: Content, Discussions, Planner, My Work, with a back button on subpages.
  - Multi-page content uses a Canva-style bottom thumbnail strip with slide/page numbers, jump, drag-reorder in edit mode, and fit-width/fit-height/actual-size controls.
  - Content keeps at least 24px spacing from the main sidebar, with admin Portals using at least 32px and a responsive 12-column grid.
- Student dashboard:
  - No hero image and no XP.
  - Show active time spent only when the tab/window is active and the user has recent interaction; ignore idle/offline time.
  - Notifications replace announcements and expose toggles for New content, Assignments, Deadlines, Grades posted, Practice, and Feedback.
  - If all notification toggles are off, collapse into a slim "Notifications are paused" state.
  - Join Class stays compact with input and Join button in one row, max width 400px, and minimal vertical padding.
- Student sidebar target:
  - Dashboard, Lessons with mini-sidebar, Teachers & Classes, Discussions, Planner, Support, Notifications, Profile & Settings.
  - Support contains Practice + AI Tutor and Grades.
- Teacher sidebar target:
  - Dashboard, My Courses, Create Lesson, Assignments, Gradebook & Feedback, Discussions, Planner, Practice + AI Tutor preview, Students, Notifications, Profile & Settings.
- Individual sidebar target:
  - Explore Courses, My Courses, Notes, Practice + AI Tutor, Progress, Profile & Settings.
- Notes:
  - Notes are personal across roles and can optionally link to lessons.
  - Notes support headings, images, safe videos/embeds, links, tables, sketches/drawings, rich text, grid/list views, AI cleanup, and design presets.
- Practice + AI Tutor:
  - One merged page.
  - Left side is AI copilot/chat/prompting/upload.
  - Right side is generated practice and attempts.
  - Include filters for subject, difficulty, question type, and mode.
  - Include points, speed meter, accuracy ring, color transitions, attempt summary, retry missed, and AI next-topic/difficulty suggestion.
- Lesson Creation Studio:
  - Replaces old standalone Studio as the primary teacher creation path.
  - Uses Canva-style editor: left tool rail, templates/assets/uploads/text/brand/tools panels, center canvas, top compact toolbar, bottom slide/page strip, preview, export/share menus, and property panels for font, color, spacing, animation, position, and media.
  - Start modes are AI draft, Full AI, and Blank lesson; all three converge into the same editor instead of separate disconnected flows.
  - Blocks include text, image, video, quiz, poll, embed, shape, table, flashcard, audio, callout, practice card, discussion prompt, and exit ticket.
  - AI prompt bar can generate full lessons by topic, grade level, slide count, language, quiz inclusion, style, and template.
  - AI output appears as selectable slides/blocks with placeholders for media and quizzes; Apply Template reflows content without losing it.
- Feedback and grades:
  - Teachers can leave rich feedback on all work types.
  - Feedback panel supports bold, color, links/media, voice-note placeholder, and visibility controls.
  - Grade visibility can be toggled per student/per item.
- Profile & Settings:
  - Single merged entry everywhere.
  - Account, Notifications, Privacy, Appearance, Dashboard Sections, and Role Preferences appear as draggable/reorderable cards with persisted order.

---

## Cross-Phase Architecture Targets

- Keep AI contracts, validators, template engines, and conversion helpers outside UI components.
- Keep tenant-aware database access server-side.
- Use typed adapters when reading older Studio content.
- Treat generated content as drafts until validated and accepted.
- Prefer reusable block transformations over one-off conversion code.
- Keep prompt versions and template versions visible in metadata.
- Maintain EdSync-specific Cloudflare resources and never reuse AllChess or LEARN bindings.

## Cross-Phase Design Targets

- Use the real working experience as the first screen, not a marketing shell.
- Keep creation tools dense, scannable, and teacher-focused.
- Use icons for tool actions and concise labels for modes.
- Avoid nested cards and oversized decorative surfaces in operational tools.
- Make slide, PPT, lesson, quiz, discussion, and activity outputs feel intentionally designed.
- Ensure text fits in panels, buttons, cards, slides, and mobile layouts.
- Add accessibility checks before publish and export.

## Cross-Phase AI Targets

- Every generation feature has a prompt contract, schema, validator, and repair path.
- Responses are previewed before insertion.
- Teachers can accept all, accept selected parts, regenerate, or discard.
- AI should generate complete classroom-ready packages, not disconnected fragments.
- Fallback drafts should keep teachers moving when a provider truncates or fails.
- Store enough metadata to audit generated content without storing secrets.

## Cross-Phase Template Targets

- Templates define structure, layout, style, prompt behavior, sample content, and compatibility.
- Templates can be applied to blank manual lessons and generated lessons.
- Template changes update all compatible child artifacts.
- Teacher-authored content is protected by default.
- Imported templates are validated before use.
- Templates are versioned so published content can remain stable.

## Recommended Release Order

1. Finish baseline inventory and Studio refactor planning.
2. Build shared learning object types and validators.
3. Build template foundation and template application engine.
4. Build AI prompt contracts and response validation.
5. Upgrade lesson builder and selective import.
6. Upgrade slides and PPT export.
7. Expand discussions, quizzes, and activities.
8. Add source import depth, collaboration, accessibility, analytics, and release hardening.

## Default Verification Commands

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
npm.cmd run build
```

## Tracking Files

- `plan.md`: comprehensive roadmap and targets.
- `progress.md`: phase status, current target, blockers, verification, and decision log.
- `docs/superpowers/plans/2026-05-16-edsync-lessons-slides-platform.md`: existing detailed implementation plan for the Studio lesson and slide slice.
