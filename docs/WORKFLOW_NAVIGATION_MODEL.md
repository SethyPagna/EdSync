# EdSync Workflow And Navigation Model

Last updated: 2026-05-16

This document implements Phase 2 of `docs/planning/plan.md`. It defines the canonical product flow, navigation handoffs, saved-state labels, and route responsibilities before the next architecture phases introduce shared learning objects and refactor the large editor/player files.

## Product Spine

The app should feel like one continuous learning loop:

1. Visitor discovers a course through `/catalog` or an organization portal.
2. Visitor signs in or signs up with a remembered return target.
3. User lands in the correct dashboard for their role and active organization.
4. Teacher creates or imports learning content in Studio.
5. Teacher turns the source into a lesson package: lesson, slides, practice, quiz, discussion, worksheet, rubric, and assignment.
6. Student receives a clean assigned view with lesson, activities, practice, discussion, feedback, and progress.
7. Submission and activity events update grades, analytics, recommendations, review cards, and teacher interventions.
8. Teacher improves the content from evidence: missed questions, discussion gaps, completion data, and AI suggestions.

## Visitor And Organization Flow

| Step | Route | User Intent | Required Behavior |
| --- | --- | --- | --- |
| Discover | `/catalog` | Browse public free/paid courses. | Keep copy short, show course cards first, preserve filters in URL, and send enroll clicks through auth when needed. |
| Organization entry | `/org/[portalSlug]` | Enter a known organization portal. | Show only portal-scoped catalog and organization identity; login/signup should keep the portal context. |
| Product detail | `/catalog/[productId]` | Decide whether to enroll. | Show safe preview fields, price/free state, provider, expected duration, and the next step. |
| Sign in | `/auth/login` | Resume selected course or portal. | Preserve `next`, portal slug, and intended enrollment action. |
| Sign up | `/auth/signup` | Join as individual or through organization. | Store organization choice in session context before role routing. |

## Teacher Idea-To-Assignment Workflow

Teachers need one path even when they start from different sources.

| Stage | Starting Points | Canonical Surface | Next Action |
| --- | --- | --- | --- |
| Start | Topic, blank lesson, file, URL, previous lesson, template, content block | `/studio` or `/teacher/lessons/create` | Create a local draft package with title, audience, objectives, tags, duration, and source metadata. |
| Organize | AI cleanup, manual outline, imported notes, sheet cleanup | Studio document/sheet pane | Convert source material into structured blocks and save as server draft. |
| Design | Lesson editor, slide deck, design template, section blocks | Studio slides/lesson panes | Apply template preview, edit blocks, generate slides, add media, and check accessibility. |
| Assess | Quiz, exam, practice, rubric, discussion, activity | `/practice`, Studio practice pane, teacher work tools | Generate or manually create assessment artifacts linked to the same source package. |
| Publish | Lesson package review | Teacher lesson editor | Mark package as published, keeping generated children in draft if not reviewed. |
| Assign | Class, group, individual student, deadline | Teacher work/planner pages | Assign the published lesson package and create gradebook/notification records. |
| Review | Submissions, attempts, discussion, analytics | Teacher gradebook, analytics, reports | Give feedback, override scores, add notes, and send targeted practice/review cards. |
| Improve | Missed concepts, AI suggestions, template updates | Studio package history | Create a new version without overwriting the assigned version. |

## Student Learning Workflow

| Stage | Route | Student Experience | System Output |
| --- | --- | --- | --- |
| Home | `/student/dashboard` | See next work, deadlines, progress, announcements, and recommendations. | Personalized queue from assignments, practice review cards, and due dates. |
| Learn | `/student/lessons/[id]` | Complete lesson sections, slides, activities, media, and checks for understanding. | Progress events and content completion state. |
| Practice | `/practice`, `/quizzes`, `/games` | Choose quiz, exam, flashcards, sprint, matching, retry missed, and review modes. | Practice attempts, mistake cards, explanations, and points. |
| Discuss | `/student/discussions` | Reply to class prompts or lesson-linked discussion threads. | Discussion participation and teacher alerts when needed. |
| Reflect | Student notes/profile/dashboard | Save reflections, goals, and study tasks. | Review recommendations and analytics rollups. |
| Feedback | `/student/grades`, `/student/work` | See scores, comments, rubrics, missing work, and next recommended action. | Closed learning loop back into practice and review. |

## Navigation Rules

| Area | Canonical Role | Stable Routes | Navigation Rule |
| --- | --- | --- | --- |
| Public discovery | Visitor, signed-in learner | `/`, `/catalog`, `/catalog/[productId]`, `/org/[portalSlug]` | Catalog is the default public experience; organization pages are scoped catalog entries. |
| Studio authoring | Teacher, admin view mode | `/studio`, `/notes`, `/docs`, `/sheets`, `/slides` | `/studio` owns the workspace; aliases open the matching Studio tab. |
| Practice | Student, teacher preview | `/practice`, `/quizzes`, `/games` | `/practice` owns the engine; aliases apply mode filters. |
| Lessons | Teacher, student | `/teacher/lessons/*`, `/student/lessons/[id]` | Teacher routes edit and assign; student routes consume assigned published versions. |
| Work and grades | Teacher, student | `/teacher/work`, `/teacher/gradebook`, `/student/work`, `/student/grades` | Work owns assignment/submission status; grades own scoring and feedback. |
| Governance | Platform admin, scoped org manager | `/admin/settings`, `/admin/governance`, focused admin pages | Settings is the entry point; focused pages remain direct routes for deep links. |

## Handoff Contracts

Every handoff should carry the same core metadata:

- `tenantId`
- `ownerId`
- `sourceType`
- `sourceId`
- `title`
- `audience`
- `objectives`
- `tags`
- `language`
- `estimatedMinutes`
- `difficulty`
- `status`
- `version`

| From | To | Handoff Payload | UI Cue |
| --- | --- | --- | --- |
| Catalog product | Auth | `next`, `productId`, `portalSlug`, `enrollmentMode` | Return-to-course message after login. |
| Studio document | Lesson package | Source block ids, title, objectives, tags, audience, duration | "Create lesson from this" action. |
| Studio slides | Lesson player | Slide deck id, layout tokens, transition settings, speaker notes | "Preview as student" action. |
| Lesson package | Practice | Selected blocks, objectives, difficulty, question count, duration target | "Generate practice" action. |
| Lesson package | Discussion | Prompt block, participation rubric, due date | "Start discussion" action. |
| Lesson package | Work item | Published version id, class targets, due date, point value | "Assign" action. |
| Student attempt | Gradebook | Attempt id, score event, item-level results, late/missing state | Grade event audit row. |
| Gradebook | Recommendations | Missed objectives, review cards, next practice mode | Dashboard recommendation. |
| Analytics | Studio | Low-completion sections, common mistakes, unread discussions | "Improve next version" action. |

## Saved-State Labels

Use the same wording everywhere so users can trust what happened.

| Label | Meaning | Where It Appears |
| --- | --- | --- |
| `Local draft` | Stored only in browser draft storage and not yet on the server. | Studio tabs, sidebar dirty badge, route-exit warning, editor status chip. |
| `Server draft` | Saved to D1/R2 but not visible to students. | Studio library, teacher lesson list, lesson editor header. |
| `Needs review` | Generated/imported content requires human approval before publish/assign. | AI output preview, lesson package checklist, child artifact cards. |
| `Published` | Approved version is visible to eligible viewers or ready for assignment. | Lesson list, catalog controls, product detail when public. |
| `Assigned` | Published version has at least one active assignment. | Teacher work, student dashboard, lesson header. |
| `Archived` | Hidden from active lists but restorable. | Studio library filters, teacher lessons archive, admin audit. |
| `Conflict` | Local draft or stale version differs from server version. | Studio tab chip, save modal, conflict inspector. |

Dirty badges should be numeric when multiple unsaved items exist in a section, for example `Studio 2` or `Slides 1`. The badge counts local unsaved records, not server drafts.

## Page-Level Next Actions

| Page | Primary Action | Secondary Actions |
| --- | --- | --- |
| `/catalog` | Browse or search courses. | Sign in, start, filter by language/duration/difficulty. |
| `/auth/login` | Sign in and return to intended page. | Find organization, create account. |
| `/teacher/dashboard` | Continue the next teaching task. | Create lesson, review submissions, open planner. |
| `/teacher/lessons` | Open or create a lesson package. | Filter by status, duplicate, archive, assign. |
| `/teacher/lessons/create` | Start a package from source or template. | Import file/text, AI outline, blank lesson. |
| `/studio` | Compatibility redirect into role-aware workspace tools. | Practice + AI, generate practice, create slides, export. |
| `/practice` | Start selected practice mode. | Retry missed, save review cards, adjust duration. |
| `/student/dashboard` | Continue next assigned work. | Practice review, check deadlines, open grades. |
| `/student/lessons/[id]` | Continue lesson. | Practice, discuss, ask tutor, view resources. |
| `/admin/settings` | Configure platform/tenant behavior. | AI providers, security, governance, portals, feature flags. |

## Phase 3 Implementation Handoff

The next code phase should introduce shared types and adapters before UI expansion:

- `LearningObject` for the package-level record.
- `LearningBlock` for lesson/slide/practice/discussion/rubric fragments.
- `LearningWorkflowState` for saved-state labels.
- Conversion helpers from `studio_documents`, `lesson_sections`, `quiz_questions`, and `content_blocks`.
- Route adapters that keep existing URLs stable while reducing page-owned logic.
