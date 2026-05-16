# EdSync Lessons And Slides Platform Plan

## Summary
Refine EdSync Studio into an LMS-native lesson and slide platform: a Rise 360-style lesson structure with Google Slides-like editing, reusable lesson templates, slide transitions and element animation controls, AI co-creator import flow, CRUD-safe cards/thumbnails, and live verification.

## Current Status
- Existing Studio has notes, docs, sheets, slides, practice, content blocks, local drafts, server save/publish/archive/delete, theme presets, slideshow preview, and Cloudflare deployment.
- Current gap: slide authoring is too shallow. Slides need explicit type, layout, body, speaker notes, theme, transition, animation, and lesson structure controls.

## Implementation Slices
- Add richer slide metadata and safe helper functions.
- Add visible slide thumbnails with type/layout badges and compact CRUD actions.
- Add a lesson structure strip: Modules > Lessons > Slides.
- Add toolbar controls for text, image, video, shapes, quiz, and interactive slide actions.
- Add template application so themes change deck styling while preserving content.
- Add transition and animation controls for preview mode.
- Add AI co-creator entry points using strict JSON output expectations.
- Add tests for slide CRUD, template application, and animation metadata.

## Verification
- Run `npm.cmd run test`, `npm.cmd run lint`, `npm.cmd run typecheck`, and `npm.cmd run build`.
- Deploy Cloudflare after passing local gates.
- Smoke-test live `/studio`, `/slides`, `/auth/login`, and worker health where the local network allows.

## Notes
- Keep heavy Office-like functionality isolated inside Studio and AI routes so dashboards and auth stay fast.
- Keep TypeScript/Next.js as the app layer. Add other languages only for measured CPU-heavy workers such as extraction, scanning, or analytics transforms.
