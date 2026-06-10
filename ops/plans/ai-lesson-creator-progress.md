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

## Verification Log

- `npm.cmd run typecheck`: passed after the page-preview menu fix.
- `npx.cmd eslint --config config/eslint/eslint.config.mjs src/components/studio/FabricLessonStudio.tsx`: passed after the page-preview menu fix.
- `npm.cmd run typecheck`: passed after adding slide-deck output and studio AI wiring.
- `npx.cmd eslint --config config/eslint/eslint.config.mjs src/app/api/ai/create-lesson/route.ts`: passed after adding slide-deck output.
- `npx.cmd eslint --config config/eslint/eslint.config.mjs src/components/studio/FabricLessonStudio.tsx`: passed after studio AI wiring.
- `npm.cmd test -- src/app/api/ai/create-lesson/route.test.ts`: passed after adding slide-deck route coverage.
- `npx.cmd eslint --config config/eslint/eslint.config.mjs src/app/api/ai/create-lesson/route.test.ts`: passed after adding slide-deck route coverage.
