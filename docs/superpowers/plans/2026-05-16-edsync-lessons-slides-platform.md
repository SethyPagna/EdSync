# EdSync Lessons And Slides Platform Plan

## Summary
Refine EdSync Studio into an LMS-native lesson and slide platform: a Rise 360-style lesson structure with Google Slides-like editing, reusable lesson templates, slide transitions and element animation controls, AI co-creator import flow, CRUD-safe cards/thumbnails, and live verification.

## Current Status
- Existing Studio has notes, docs, sheets, slides, practice, content blocks, local drafts, server save/publish/archive/delete, theme presets, slideshow preview, and Cloudflare deployment.
- Added richer slide catalog presets for content, quiz, interactive slides, layouts, transitions, animations, and lesson templates.
- Added slide action helpers for metadata normalization, slide updates, and template application while preserving content.
- Added test coverage for slide metadata and template application.
- Upgraded Studio slide editing with thumbnails, lesson structure, toolbar actions, body editing, speaker notes, template controls, transition controls, animation controls, AI co-creator entry, and animated preview.

## Implementation Slices
- [x] Add richer slide metadata and safe helper functions.
- [x] Add visible slide thumbnails with type/layout badges and compact CRUD actions.
- [x] Add a lesson structure strip: Modules > Lessons > Slides.
- [x] Add toolbar controls for text, image, video, shapes, quiz, and interactive slide actions.
- [x] Add template application so themes change deck styling while preserving content.
- [x] Add transition and animation controls for preview mode.
- Add AI co-creator entry points using strict JSON output expectations.
- [x] Add tests for slide CRUD, template application, and animation metadata.
- [ ] Add strict AI lesson JSON validator and import-all/selective-import UI.
- [ ] Split the large Studio workspace into focused slide/editor/sidebar modules.
- [ ] Add browser-level Studio slide workflow tests.

## Verification
- Run `npm.cmd run test`, `npm.cmd run lint`, `npm.cmd run typecheck`, and `npm.cmd run build`.
- Deploy Cloudflare after passing local gates.
- Smoke-test live `/studio`, `/slides`, `/auth/login`, and worker health where the local network allows.

## Notes
- Keep heavy Office-like functionality isolated inside Studio and AI routes so dashboards and auth stay fast.
- Keep TypeScript/Next.js as the app layer. Add other languages only for measured CPU-heavy workers such as extraction, scanning, or analytics transforms.
