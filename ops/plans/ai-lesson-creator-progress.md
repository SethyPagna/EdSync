# AI Lesson Creator Engine Progress

## Goal

Build EdSync's AI lesson creator as a structured slide-deck generator that produces ready-to-render lesson slides for the studio, while preserving compatibility with existing course and lesson workflows.

## Required Defaults

- Lesson type: slide deck.
- Complexity: intermediate unless the user chooses beginner or advanced.
- Socratic questioning: enabled.
- Speaker notes: enabled.
- Default slide count: 10.
- Default audience: adult learners.

## Required Slide Contract

Each generated lesson must be a JSON array of slide objects with:

- `slideNumber`
- `title`
- `type`
- `onScreenText`
- `speakerNotes`
- `visualSuggestion`
- `navigation.previous`
- `navigation.next`

The first slide must use `navigation.previous: null`; the final slide must use `navigation.next: null`.

## Required Lesson Flow

1. Title slide.
2. Learning objectives.
3. Key concept slides.
4. Example or walkthrough.
5. At least two Socratic question slides.
6. Interactive activity.
7. Summary.
8. Assessment or exit ticket.

## Progress

- [x] Identified that the studio page-preview three-dot menu was clipped by the scrollable preview tray.
- [x] Moved the page-preview menu into a viewport-level portal so it is no longer blocked by the tray overflow.
- [x] Add a slide-deck output mode to `/api/ai/create-lesson`.
- [x] Normalize AI output into the exact slide-array contract.
- [x] Convert slide-array output back into EdSync's existing lesson object for compatibility.
- [x] Wire the studio AI lesson builder to request slide-deck output.
- [x] Render generated slide objects as editable studio pages with live previews.
- [x] Verify generation fallback returns valid slides when the AI provider truncates or malforms JSON.
- [x] Add route coverage for slide-deck output normalization and lesson compatibility.
- [x] Add route coverage for local fallback slide-deck generation.
- [x] Preserve AI slide metadata on studio pages so notes, visuals, navigation, and slide type survive editing.
- [x] Add a deterministic EdSync template resolver that maps slide `type` and `visualSuggestion` into render-ready layouts.
- [x] Render AI slides with distinct template recipes instead of one generic title/body layout.
- [x] Keep the model output schema exact by computing design choices inside EdSync, not in the AI JSON contract.
- [x] Add focused tests for template selection, navigation normalization, and slide metadata preservation.
- [x] Add focused tests that convert AI slides into editable studio pages with preview seed text and preserved notes/navigation metadata.
- [x] Add focused tests for slide preview three-dot menu placement so it stays anchored to the preview and inside the viewport.
- [x] Infer EdSync interaction formats from AI slide text and notes: discussion, quiz/test, fill-in-the-blank, matching, reflection, practice, and poll.
- [x] Render inferred interaction labels on generated studio slides without changing the exact AI JSON schema.
- [x] Prompt and fallback-generate AI decks with explicit interaction formats for activities and assessments.
- [x] Build structured interaction templates from AI slides with a prompt, action items, and teacher hint/answer key.
- [x] Render structured interaction cards in the studio instead of raw bullet lists for activity and assessment slides.
- [x] Add named AI slide render templates for discussion, matching, polls, reflection, fill-in-the-blank, and quiz pages.
- [x] Persist the resolved AI template on generated Studio pages so saved lessons keep their design intent.
- [x] Repair vague AI activity and assessment slide output into template-ready cues before Studio rendering.
- [x] Add compact AI focus options and template markers to the Studio builder/preview UI.
- [x] Centralize AI focus options so builder chips, prompt preview, and generation request share the same template cues.
- [x] Guarantee selected Studio focus cues create matching lesson slides when provider output omits them.
- [x] Open AI lesson creation as a focused Studio modal with explicit close, Escape close, source-import opening, and generation dismissal.
- [ ] Verify the studio AI builder creates editable pages with live previews, no console errors, and no blocked menus.

## Verification Log

- `npm.cmd run typecheck`: passed after the page-preview menu fix.
- `npx.cmd eslint --config config/eslint/eslint.config.mjs src/components/studio/FabricLessonStudio.tsx`: passed after the page-preview menu fix.
- `npm.cmd run typecheck`: passed after adding slide-deck output and studio AI wiring.
- `npx.cmd eslint --config config/eslint/eslint.config.mjs src/app/api/ai/create-lesson/route.ts`: passed after adding slide-deck output.
- `npx.cmd eslint --config config/eslint/eslint.config.mjs src/components/studio/FabricLessonStudio.tsx`: passed after studio AI wiring.
- `npm.cmd test -- src/app/api/ai/create-lesson/route.test.ts`: passed after adding slide-deck route coverage.
- `npx.cmd eslint --config config/eslint/eslint.config.mjs src/app/api/ai/create-lesson/route.test.ts`: passed after adding slide-deck route coverage.
- `npm.cmd test -- src/app/api/ai/create-lesson/route.test.ts`: passed with 2 tests after fallback coverage.
- `npm.cmd test -- src/lib/studio/ai-slide-design.test.ts`: passed with 4 tests after adding the deterministic template resolver.
- `npm.cmd test -- src/app/api/ai/create-lesson/route.test.ts src/lib/studio/ai-slide-design.test.ts`: passed with 7 tests after clarification handling and studio template wiring.
- `npx.cmd eslint --config config/eslint/eslint.config.mjs src/app/api/ai/create-lesson/route.ts src/app/api/ai/create-lesson/route.test.ts src/components/studio/FabricLessonStudio.tsx src/lib/studio/ai-slide-design.ts src/lib/studio/ai-slide-design.test.ts`: passed after route and studio integration.
- `npm.cmd run typecheck`: passed after route and studio integration.
- `npm.cmd test`: passed with 62 files and 260 tests after AI lesson template wiring.
- `npm.cmd run lint`: passed after AI lesson template wiring.
- `npm.cmd run typecheck`: passed after AI lesson template wiring.
- `npm.cmd run build`: passed after AI lesson template wiring; Next still reports the known middleware deprecation warning.
- `npm.cmd run deploy:cloudflare`: deployed `edsync` to `https://edsync.learn-app.workers.dev` as version `76b0d8af-8b7f-41ec-ba87-49b24a445ab5`.
- Live route smoke: `/studio?adminView=organization-teacher` returned HTTP 200 instead of 503, and headless Chrome rendered the unauthenticated sign-in page without the previous minified React error.
- `npm.cmd test -- src/lib/studio/ai-slide-pages.test.ts src/lib/studio/ai-slide-design.test.ts src/app/api/ai/create-lesson/route.test.ts`: passed with 9 tests after extracting the AI slide-to-studio-page conversion.
- `npx.cmd eslint --config config/eslint/eslint.config.mjs src/lib/studio/ai-slide-pages.ts src/lib/studio/ai-slide-pages.test.ts src/components/studio/FabricLessonStudio.tsx`: passed after extracting the AI slide-to-studio-page conversion.
- `npm.cmd run typecheck`: passed after extracting the AI slide-to-studio-page conversion.
- `npm.cmd test`: passed with 63 files and 262 tests after the tested slide-to-studio-page conversion.
- `npm.cmd run lint`: passed after the tested slide-to-studio-page conversion.
- `npm.cmd run typecheck`: passed after the tested slide-to-studio-page conversion.
- `npm.cmd run build`: passed after the tested slide-to-studio-page conversion; Next still reports the known middleware deprecation warning.
- `npm.cmd run deploy:cloudflare`: deployed `edsync` to `https://edsync.learn-app.workers.dev` as version `a45a00cf-b87a-4ca7-953c-3bf811389f13`.
- Live route smoke: `/studio?adminView=organization-teacher` returned HTTP 200, and headless Chrome rendered the unauthenticated sign-in page without 503 or the minified React error.
- `npm.cmd test -- src/lib/studio/page-menu-placement.test.ts src/lib/studio/ai-slide-pages.test.ts`: passed with 6 tests after extracting page preview menu placement.
- `npx.cmd eslint --config config/eslint/eslint.config.mjs src/lib/studio/page-menu-placement.ts src/lib/studio/page-menu-placement.test.ts src/components/studio/FabricLessonStudio.tsx`: passed after extracting page preview menu placement.
- `npm.cmd run typecheck`: passed after extracting page preview menu placement.
- `npm.cmd test`: passed with 64 files and 266 tests after page preview menu placement coverage.
- `npm.cmd run lint`: passed after page preview menu placement coverage.
- `npm.cmd run typecheck`: passed after page preview menu placement coverage.
- `npm.cmd run build`: passed after page preview menu placement coverage; Next still reports the known middleware deprecation warning.
- `npm.cmd run deploy:cloudflare`: deployed `edsync` to `https://edsync.learn-app.workers.dev` as version `c1e0c264-6e5c-48e6-a713-4dc306dac101`.
- Live route smoke: `/studio?adminView=organization-teacher` returned HTTP 200, and headless Chrome rendered the unauthenticated sign-in page without 503 or the minified React error.
- `npm.cmd test -- src/lib/studio/ai-slide-design.test.ts src/lib/studio/ai-slide-pages.test.ts src/app/api/ai/create-lesson/route.test.ts`: passed with 12 tests after adding interaction inference and fill-in-the-blank assessment coverage.
- `npx.cmd eslint --config config/eslint/eslint.config.mjs src/lib/studio/ai-slide-design.ts src/lib/studio/ai-slide-design.test.ts src/lib/studio/ai-slide-pages.ts src/lib/studio/ai-slide-pages.test.ts src/app/api/ai/create-lesson/route.ts src/components/studio/FabricLessonStudio.tsx`: passed after adding interaction inference.
- `npm.cmd run typecheck`: passed after adding interaction inference.
- `npm.cmd test`: passed with 64 files and 269 tests after AI interaction template support.
- `npm.cmd run lint`: passed after AI interaction template support.
- `npm.cmd run typecheck`: passed after AI interaction template support.
- `npm.cmd run build`: passed after AI interaction template support; Next still reports the known middleware deprecation warning.
- `npm.cmd run deploy:cloudflare`: deployed `edsync` to `https://edsync.learn-app.workers.dev` as version `a4f66ac7-a776-4796-9592-5c88f84e49ae`.
- Live route smoke: `/studio?adminView=organization-teacher` returned HTTP 200, and headless Chrome rendered the unauthenticated sign-in page without 503 or the minified React error.
- `npm.cmd test -- src/lib/studio/ai-slide-design.test.ts src/lib/studio/ai-slide-pages.test.ts`: passed with 11 tests after adding structured interaction templates.
- `npx.cmd eslint --config config/eslint/eslint.config.mjs src/lib/studio/ai-slide-design.ts src/lib/studio/ai-slide-design.test.ts src/lib/studio/ai-slide-pages.test.ts src/components/studio/FabricLessonStudio.tsx`: passed after adding structured interaction templates.
- `npm.cmd run typecheck`: passed after adding structured interaction templates.
- `npm.cmd test`: passed with 64 files and 271 tests after structured interaction template rendering.
- `npm.cmd run lint`: passed after structured interaction template rendering.
- `npm.cmd run typecheck`: passed after structured interaction template rendering.
- `npm.cmd run build`: passed after structured interaction template rendering; Next still reports the known middleware deprecation warning.
- `npm.cmd run deploy:cloudflare`: deployed `edsync` to `https://edsync.learn-app.workers.dev` as version `063d330d-7c7d-4ac5-9662-46fc2ad21804`.
- Live route smoke: `/studio?adminView=organization-teacher` returned HTTP 200, and headless Chrome rendered the unauthenticated sign-in page without 503 or the minified React error.
- `npm.cmd test -- src/lib/studio/ai-slide-design.test.ts src/lib/studio/ai-slide-pages.test.ts`: passed with 12 tests after adding named AI slide render templates.
- `npx.cmd eslint --config config/eslint/eslint.config.mjs src/lib/studio/ai-slide-design.ts src/lib/studio/ai-slide-design.test.ts src/components/studio/FabricLessonStudio.tsx`: passed after adding named AI slide render templates.
- `npm.cmd run typecheck`: passed after adding named AI slide render templates.
- `npm.cmd test`: passed with 64 files and 272 tests after named AI slide render templates.
- `npm.cmd run lint`: passed after named AI slide render templates.
- `npm.cmd run typecheck`: passed after named AI slide render templates.
- `npm.cmd run build`: passed after named AI slide render templates; Next still reports the known middleware deprecation warning.
- `npm.cmd run deploy:cloudflare`: deployed `edsync` to `https://edsync.learn-app.workers.dev` as version `9d5e501e-093d-4bd5-a187-4d0568de407c`.
- Live route smoke: `/studio?adminView=organization-teacher` returned HTTP 200 with no `Service Unavailable` or minified React error text.
- Playwright screenshots: captured desktop 1440x900 and mobile 390x844 live Studio sign-in renders; both showed normal EdSync UI without the previous mobile field overlap.
- `npm.cmd test -- src/lib/studio/ai-slide-pages.test.ts src/lib/studio/ai-slide-design.test.ts`: passed with 12 tests after persisting resolved AI page templates.
- `npx.cmd eslint --config config/eslint/eslint.config.mjs src/lib/studio/ai-slide-pages.ts src/lib/studio/ai-slide-pages.test.ts src/components/studio/FabricLessonStudio.tsx`: passed after persisting resolved AI page templates.
- `npm.cmd run typecheck`: passed after persisting resolved AI page templates.
- `npm.cmd test`: passed with 64 files and 272 tests after persisting resolved AI page templates.
- `npm.cmd run lint`: passed after persisting resolved AI page templates.
- `npm.cmd run typecheck`: passed after persisting resolved AI page templates.
- `npm.cmd run build`: passed after persisting resolved AI page templates; Next still reports the known middleware deprecation warning.
- `npm.cmd run deploy:cloudflare`: deployed `edsync` to `https://edsync.learn-app.workers.dev` as version `605d07d9-0f35-4ea5-86ad-3560425fa450`.
- Live route smoke: `/studio?adminView=organization-teacher` returned HTTP 200 with no `Service Unavailable` or minified React error text, and a mobile 390x844 screenshot rendered the sign-in UI without overlap.
- `npm.cmd test -- src/app/api/ai/create-lesson/route.test.ts src/lib/studio/ai-slide-design.test.ts`: passed with 12 tests after adding template-ready activity and assessment repair.
- `npx.cmd eslint --config config/eslint/eslint.config.mjs src/app/api/ai/create-lesson/route.ts src/app/api/ai/create-lesson/route.test.ts`: passed after adding template-ready activity and assessment repair.
- `npm.cmd run typecheck`: passed after adding template-ready activity and assessment repair.
- `npm.cmd test`: passed with 64 files and 273 tests after template-ready cue repair.
- `npm.cmd run lint`: passed after template-ready cue repair.
- `npm.cmd run typecheck`: passed after template-ready cue repair.
- `npm.cmd run build`: passed after template-ready cue repair; Next still reports the known middleware deprecation warning.
- `npm.cmd run deploy:cloudflare`: deployed `edsync` to `https://edsync.learn-app.workers.dev` as version `d7323c8d-58da-4c96-b466-61bfbe072740`.
- Live route smoke: `/studio?adminView=organization-teacher` returned HTTP 200 with no `Service Unavailable` or minified React error text, and a mobile 390x844 screenshot rendered the sign-in UI without overlap.
- `npx.cmd eslint --config config/eslint/eslint.config.mjs src/components/studio/FabricLessonStudio.tsx`: passed after adding compact AI focus options and preview template markers.
- `npm.cmd run typecheck`: passed after adding compact AI focus options and preview template markers.
- `npm.cmd test`: passed with 64 files and 273 tests after compact AI focus options and preview template markers.
- `npm.cmd run lint`: passed after compact AI focus options and preview template markers.
- `npm.cmd run typecheck`: passed after compact AI focus options and preview template markers.
- `npm.cmd run build`: passed after compact AI focus options and preview template markers; Next still reports the known middleware deprecation warning.
- `npm.cmd run deploy:cloudflare`: deployed `edsync` to `https://edsync.learn-app.workers.dev` as version `ed169062-0458-453c-8039-fe3b932a2d8f`.
- Live route smoke: `/studio?adminView=organization-teacher` returned HTTP 200 with no `Service Unavailable` or minified React error text, and a mobile 390x844 screenshot rendered the sign-in UI without overlap.
- `npm.cmd test -- src/lib/studio/ai-focus-templates.test.ts src/app/api/ai/create-lesson/route.test.ts`: passed with 8 tests after centralizing AI focus template cues.
- `npx.cmd eslint --config config/eslint/eslint.config.mjs src/lib/studio/ai-focus-templates.ts src/lib/studio/ai-focus-templates.test.ts src/components/studio/FabricLessonStudio.tsx`: passed after centralizing AI focus template cues.
- `npm.cmd run typecheck`: passed after centralizing AI focus template cues.
- `npm.cmd test`: passed with 65 files and 277 tests after centralizing AI focus template cues.
- `npm.cmd run lint`: passed after centralizing AI focus template cues.
- `npm.cmd run typecheck`: passed after centralizing AI focus template cues.
- `npm.cmd run build`: passed after centralizing AI focus template cues; Next still reports the known middleware deprecation warning.
- `npm.cmd run deploy:cloudflare`: deployed `edsync` to `https://edsync.learn-app.workers.dev` as version `e7623eb4-73c1-4397-83fa-41ebcd5cafd8`.
- Live route smoke: `/studio?adminView=organization-teacher` returned HTTP 200 with no `Service Unavailable` or minified React error text, and a mobile 390x844 screenshot rendered the sign-in UI without overlap.
- `npm.cmd test -- src/app/api/ai/create-lesson/route.test.ts`: passed with 5 tests after guaranteeing selected Studio focus cues create matching slides.
- `npx.cmd eslint --config config/eslint/eslint.config.mjs src/app/api/ai/create-lesson/route.ts src/app/api/ai/create-lesson/route.test.ts`: passed after selected focus cue guarantees.
- `npm.cmd run typecheck`: passed after selected focus cue guarantees.
- `npm.cmd test`: passed with 65 files and 278 tests after selected focus cue guarantees.
- `npm.cmd run lint`: passed after selected focus cue guarantees.
- `npm.cmd run typecheck`: passed after selected focus cue guarantees.
- `npm.cmd run build`: passed after selected focus cue guarantees; Next still reports the known middleware deprecation warning.
- `npm.cmd run deploy:cloudflare`: deployed `edsync` to `https://edsync.learn-app.workers.dev` as version `6f5e49e4-ea0d-4ed7-bab1-6c60ed7f1667`.
- Live route smoke: `/studio?adminView=organization-teacher` returned HTTP 200 with no `Service Unavailable` or minified React error text, and a mobile 390x844 screenshot rendered the sign-in UI without overlap.
- `npx.cmd eslint --config config/eslint/eslint.config.mjs src/components/studio/FabricLessonStudio.tsx`: passed after making the AI lesson builder a focused Studio modal.
- `npm.cmd run typecheck`: passed after making the AI lesson builder a focused Studio modal.
- `npm.cmd run build`: passed after making the AI lesson builder a focused Studio modal; Next still reports the known middleware deprecation warning.
- Local route smoke: `/studio?adminView=organization-teacher` rendered the protected mobile sign-in gate at 390x844 without overlap while local dev ran on `127.0.0.1:3000`.
- `npm.cmd test`: passed with 65 files and 278 tests after the focused AI builder modal.
- `npm.cmd run lint`: passed after the focused AI builder modal.
- `npm.cmd run typecheck`: passed after the focused AI builder modal.
- `npm.cmd run build`: passed after the focused AI builder modal; Next still reports the known middleware deprecation warning.
- `npm.cmd run deploy:cloudflare`: deployed `edsync` to `https://edsync.learn-app.workers.dev` as version `4ffd29ff-68d2-419f-866e-df6a6dc2bfe1`.
- Live route smoke: `/studio?adminView=organization-teacher` returned HTTP 200 with no `Service Unavailable` or minified React error text, and a mobile 390x844 screenshot rendered the sign-in UI without overlap.

## Current Implementation Pass

### Files

- `src/lib/studio/ai-slide-design.ts`: shared template resolver and metadata helpers for AI slide rendering.
- `src/lib/studio/ai-slide-design.test.ts`: focused coverage for layout selection and navigation repair.
- `src/components/studio/FabricLessonStudio.tsx`: studio integration that stores AI slide metadata and renders type-aware layouts.
- `src/app/api/ai/create-lesson/route.ts`: strict AI lesson prompt and response handling, if the existing route needs contract tightening.
- `src/app/api/ai/create-lesson/route.test.ts`: route coverage for clarification and exact schema behavior, if the route contract changes.

### Acceptance Checks

- AI output remains a JSON array using only `slideNumber`, `title`, `type`, `onScreenText`, `speakerNotes`, `visualSuggestion`, and `navigation`.
- Title, objectives, content, example, Socratic, activity, summary, and assessment slides render with visibly different EdSync layouts.
- Studio page previews use actual generated page content.
- Speaker notes and linear previous/next navigation remain attached to each page for presentation/export flows.
- `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run typecheck`, and `npm.cmd run build` pass before deployment.
